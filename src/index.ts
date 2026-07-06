// ============================================================
//  src/index.ts — Point d'entrée Worker MonAdmissionMaster
//
//  LOGIQUE DE CRON DIFFÉRENCIÉE :
//  ─────────────────────────────────────────────────────────
//  Objectif : ENCG et Universités ne se déclenchent JAMAIS
//  le même jour, avec 2 jours d'écart entre eux, cycle de 5j.
//
//  Fonctionnement :
//    On calcule "jour d'époque" = floor(timestamp / 86400000)
//    ENCG      : se déclenche si (epochDay % 5) == 0
//    Universités : se déclenche si (epochDay % 5) == 2
//    Autres jours (1, 3, 4) : pas d'action, log uniquement
//
//  Exemple de cycle (en partant du J0 arbitraire) :
//    J0  → ENCG
//    J2  → Universités
//    J5  → ENCG
//    J7  → Universités
//    J10 → ENCG
//    ...
//
//  → 2 jours d'écart garantis entre ENCG et Universités.
//  → Chaque module attend 5 jours avant de se redéclencher.
//  → Les deux ne se déclenchent jamais le même jour.
//
//  ISOLATION DES ERREURS :
//    Chaque module est dans son propre try/catch.
//    L'échec de l'un n'interrompt jamais l'autre.
//    Notification email envoyée en cas d'erreur.
// ============================================================

import type { Env, WatchResult, ExecutionSummary } from "./shared/types.js";
import { runEncgWatch } from "./modules/encg.js";
import { runUniversitesWatch } from "./modules/universites.js";
import {
  sendSummaryEmail,
  sendDetectionAlertEmail,
  sendErrorAlertEmail,
} from "./shared/mailer/index.js";

// ────────────────────────────────────────────────────────────
// Logique de décision cron
// ────────────────────────────────────────────────────────────

/** Retourne le "jour d'époque" (nombre de jours depuis Unix epoch) */
function getEpochDay(date: Date = new Date()): number {
  return Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
}

type CronDecision = "encg" | "universites" | "none";

/**
 * Détermine quel module doit s'exécuter aujourd'hui.
 *
 * Cycle de 5 jours :
 *   epochDay % 5 == 0 → ENCG
 *   epochDay % 5 == 2 → Universités
 *   autres             → aucun (jour de repos)
 *
 * Forceable via l'URL pour les tests (/trigger?module=encg|universites|both).
 */
export function decideCronAction(date: Date = new Date()): CronDecision {
  const day = getEpochDay(date);
  const mod = day % 5;

  if (mod === 0) return "encg";
  if (mod === 2) return "universites";
  return "none";
}

// ────────────────────────────────────────────────────────────
// Exécution d'un module avec isolation d'erreur
// ────────────────────────────────────────────────────────────

async function runModule(
  name: "encg" | "universites",
  env: Env
): Promise<{ status: "ok" | "error"; result?: WatchResult; error?: string }> {
  try {
    let result: WatchResult;

    if (name === "encg") {
      result = await runEncgWatch(env);
    } else {
      result = await runUniversitesWatch(env);
    }

    // Envoyer email d'alerte si nouvelles détections
    if (result.newDetections > 0) {
      const moduleName =
        name === "encg" ? "ENCG" : "Universités publiques";
      await sendDetectionAlertEmail(env, moduleName, result);
    }

    return { status: "ok", result };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[${name}] ERREUR CRITIQUE :`, err);

    // Notification email d'erreur
    try {
      await sendErrorAlertEmail(env, name, errorMessage);
    } catch (mailErr) {
      console.error(`[${name}] Échec envoi email d'erreur :`, mailErr);
    }

    return { status: "error", error: errorMessage };
  }
}

// ────────────────────────────────────────────────────────────
// Handler HTTP (fetch) — pour tests manuels et monitoring
// ────────────────────────────────────────────────────────────

async function handleHttpRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);

  // ── Route /health ──────────────────────────────────────
  if (url.pathname === "/health" || url.pathname === "/") {
    const today = new Date();
    const decision = decideCronAction(today);
    const epochDay = getEpochDay(today);

    return Response.json({
      status: "ok",
      service: "MonAdmissionMaster",
      version: "1.0.0",
      timestamp: today.toISOString(),
      cronDecision: {
        today: decision,
        epochDay,
        epochDayMod5: epochDay % 5,
        nextEncgIn: computeNextIn(epochDay, 0),
        nextUniversitesIn: computeNextIn(epochDay, 2),
      },
    });
  }

  // ── Route /trigger — déclenchement manuel ──────────────
  if (url.pathname === "/trigger") {
    const module = url.searchParams.get("module") ?? "auto";
    const secret = url.searchParams.get("secret");

    // Protection minimale : vérifier un secret optionnel
    // (configurer TRIGGER_SECRET comme wrangler secret)
    const triggerSecret = (env as Env & { TRIGGER_SECRET?: string })
      .TRIGGER_SECRET;
    if (triggerSecret && secret !== triggerSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    const decision =
      module === "auto" ? decideCronAction(today) : (module as CronDecision);

    const summaryModules: ExecutionSummary["modules"] = [];

    if (decision === "encg" || decision === "both" as CronDecision) {
      const r = await runModule("encg", env);
      summaryModules.push({ service: "encg", ...r });
    }

    if (decision === "universites" || decision === "both" as CronDecision) {
      const r = await runModule("universites", env);
      summaryModules.push({ service: "universites", ...r });
    }

    if (summaryModules.length === 0) {
      return Response.json({
        message: "Aucun module planifié pour aujourd'hui",
        decision,
        module,
      });
    }

    const totalNew = summaryModules.reduce(
      (acc, m) => acc + (m.result?.newDetections ?? 0),
      0
    );

    const summary: ExecutionSummary = {
      executedAt: today.toISOString(),
      modules: summaryModules,
      totalNewDetections: totalNew,
      hasErrors: summaryModules.some((m) => m.status === "error"),
      isDryRun: env.DRY_RUN === "true",
    };

    await sendSummaryEmail(env, summary);

    return Response.json({ ok: true, summary });
  }

  return Response.json({ error: "Not Found" }, { status: 404 });
}

// ────────────────────────────────────────────────────────────
// Handler Cron (scheduled) — déclenchement automatique
// ────────────────────────────────────────────────────────────

async function handleScheduled(
  _event: ScheduledEvent,
  env: Env
): Promise<void> {
  const today = new Date();
  const epochDay = getEpochDay(today);
  const decision = decideCronAction(today);

  console.log(
    `[cron] Déclenchement — ${today.toISOString()} — epochDay=${epochDay} mod5=${epochDay % 5} → action="${decision}"`
  );

  if (decision === "none") {
    console.log(
      "[cron] Jour de repos — aucun module à exécuter aujourd'hui."
    );
    return;
  }

  const summaryModules: ExecutionSummary["modules"] = [];

  // ── Module ENCG (isolé) ──────────────────────────────────
  if (decision === "encg") {
    console.log("[cron] → Exécution module ENCG");
    const r = await runModule("encg", env);
    summaryModules.push({ service: "encg", ...r });
  }

  // ── Module Universités (isolé) ──────────────────────────
  if (decision === "universites") {
    console.log("[cron] → Exécution module Universités");
    const r = await runModule("universites", env);
    summaryModules.push({ service: "universites", ...r });
  }

  // ── Email de synthèse ───────────────────────────────────
  const totalNew = summaryModules.reduce(
    (acc, m) => acc + (m.result?.newDetections ?? 0),
    0
  );
  const hasErrors = summaryModules.some((m) => m.status === "error");

  const summary: ExecutionSummary = {
    executedAt: today.toISOString(),
    modules: summaryModules,
    totalNewDetections: totalNew,
    hasErrors,
    isDryRun: env.DRY_RUN === "true",
  };

  await sendSummaryEmail(env, summary);

  console.log(
    `[cron] Fin — ${totalNew} nouvelle(s) détection(s) — ${hasErrors ? "ERREURS" : "OK"}`
  );
}

// ────────────────────────────────────────────────────────────
// Export Worker
// ────────────────────────────────────────────────────────────

export default {
  /**
   * Handler HTTP : tests manuels, monitoring, déclenchement forcé.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleHttpRequest(request, env);
  },

  /**
   * Handler cron : exécution automatique quotidienne.
   * La logique interne décide quel module exécuter selon le jour.
   */
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(handleScheduled(event, env));
  },
};

// ────────────────────────────────────────────────────────────
// Utilitaire : calcul des jours restants avant prochain run
// ────────────────────────────────────────────────────────────

function computeNextIn(currentEpochDay: number, targetMod: number): number {
  const current = currentEpochDay % 5;
  if (current === targetMod) return 5; // prochain dans 5 jours
  let diff = (targetMod - current + 5) % 5;
  if (diff === 0) diff = 5;
  return diff;
}
