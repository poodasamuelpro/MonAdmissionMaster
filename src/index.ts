// ============================================================
//  src/index.ts — Point d'entrée Worker MonAdmissionMaster
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

function getEpochDay(date: Date = new Date()): number {
  return Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
}

type CronDecision = "encg" | "universites" | "none";

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
    if (result.newDetections > 0) {
      const moduleName = name === "encg" ? "ENCG" : "Universités publiques";
      await sendDetectionAlertEmail(env, moduleName, result);
    }
    return { status: "ok", result };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[${name}] ERREUR CRITIQUE :`, err);
    try {
      await sendErrorAlertEmail(env, name, errorMessage);
    } catch (mailErr) {
      console.error(`[${name}] Échec envoi email d'erreur :`, mailErr);
    }
    return { status: "error", error: errorMessage };
  }
}

// ────────────────────────────────────────────────────────────
// Page de contrôle HTML
// ────────────────────────────────────────────────────────────

function renderControlPage(decision: string, epochDay: number, nextEncg: number, nextUniv: number): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MonAdmissionMaster - Dashboard</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 min-h-screen flex items-center justify-center p-4">
      <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h1 class="text-2xl font-bold text-gray-800 mb-6 text-center">🎓 MonAdmissionMaster</h1>
        
        <div class="space-y-4 mb-8">
          <div class="p-4 bg-blue-50 rounded-lg">
            <p class="text-sm text-blue-600 font-semibold uppercase">État du cycle</p>
            <p class="text-lg text-blue-900 font-bold">Aujourd'hui : ${decision.toUpperCase()}</p>
          </div>
          
          <div class="grid grid-cols-2 gap-4 text-center">
            <div class="p-3 bg-gray-50 rounded-lg">
              <p class="text-xs text-gray-500">Prochain ENCG</p>
              <p class="font-bold">J-${nextEncg}</p>
            </div>
            <div class="p-3 bg-gray-50 rounded-lg">
              <p class="text-xs text-gray-500">Prochain Univ</p>
              <p class="font-bold">J-${nextUniv}</p>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <p class="text-sm text-gray-600 mb-2 font-medium">Lancer un scan manuel :</p>
          <button onclick="trigger('encg')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition">Scanner ENCG</button>
          <button onclick="trigger('universites')" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition">Scanner Universités</button>
        </div>

        <div id="status" class="mt-6 p-4 rounded-lg hidden text-sm"></div>

        <script>
          async function trigger(mod) {
            const status = document.getElementById('status');
            const secret = new URLSearchParams(window.location.search).get('secret');
            
            status.className = "mt-6 p-4 rounded-lg bg-gray-100 text-gray-600";
            status.innerHTML = "Scan en cours...";
            status.classList.remove('hidden');

            try {
              const res = await fetch(\`/trigger?module=\${mod}\${secret ? '&secret=' + secret : ''}\`);
              const data = await res.json();
              
              if (res.ok) {
                status.className = "mt-6 p-4 rounded-lg bg-green-100 text-green-700";
                status.innerHTML = "<b>Succès !</b> Scan terminé. " + (data.summary.totalNewDetections > 0 ? "Nouveautés trouvées !" : "Rien de neuf.");
              } else {
                status.className = "mt-6 p-4 rounded-lg bg-red-100 text-red-700";
                status.innerHTML = "<b>Erreur :</b> " + (data.error || "Échec du scan");
              }
            } catch (e) {
              status.className = "mt-6 p-4 rounded-lg bg-red-100 text-red-700";
              status.innerHTML = "Erreur réseau.";
            }
          }
        </script>
      </div>
    </body>
    </html>
  `;
}

// ────────────────────────────────────────────────────────────
// Handler HTTP (fetch)
// ────────────────────────────────────────────────────────────

async function handleHttpRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);

  // ── Route /health (JSON) ──────────────────────────────────
  if (url.pathname === "/health") {
    return Response.json({ status: "ok", service: "MonAdmissionMaster" });
  }

  // ── Page d'accueil / Dashboard ────────────────────────────
  if (url.pathname === "/") {
    const today = new Date();
    const decision = decideCronAction(today);
    const epochDay = getEpochDay(today);
    return new Response(
      renderControlPage(decision, epochDay, computeNextIn(epochDay, 0), computeNextIn(epochDay, 2)),
      { headers: { "Content-Type": "text/html; charset=UTF-8" } }
    );
  }

  // ── Route /trigger — déclenchement manuel ──────────────
  if (url.pathname === "/trigger") {
    const module = url.searchParams.get("module") ?? "auto";
    const secret = url.searchParams.get("secret");

    const triggerSecret = (env as any).TRIGGER_SECRET;
    if (triggerSecret && secret !== triggerSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    const decision = module === "auto" ? decideCronAction(today) : (module as CronDecision);
    const summaryModules: ExecutionSummary["modules"] = [];

    if (decision === "encg" || (decision as any) === "both") {
      const r = await runModule("encg", env);
      summaryModules.push({ service: "encg", ...r });
    }
    if (decision === "universites" || (decision as any) === "both") {
      const r = await runModule("universites", env);
      summaryModules.push({ service: "universites", ...r });
    }

    if (summaryModules.length === 0) {
      return Response.json({ message: "Aucun module planifié", decision });
    }

    const totalNew = summaryModules.reduce((acc, m) => acc + (m.result?.newDetections ?? 0), 0);
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
// Handler Cron (scheduled)
// ────────────────────────────────────────────────────────────

async function handleScheduled(
  _event: ScheduledEvent,
  env: Env
): Promise<void> {
  const today = new Date();
  const decision = decideCronAction(today);
  if (decision === "none") return;

  const summaryModules: ExecutionSummary["modules"] = [];
  if (decision === "encg") {
    const r = await runModule("encg", env);
    summaryModules.push({ service: "encg", ...r });
  }
  if (decision === "universites") {
    const r = await runModule("universites", env);
    summaryModules.push({ service: "universites", ...r });
  }

  const totalNew = summaryModules.reduce((acc, m) => acc + (m.result?.newDetections ?? 0), 0);
  const summary: ExecutionSummary = {
    executedAt: today.toISOString(),
    modules: summaryModules,
    totalNewDetections: totalNew,
    hasErrors: summaryModules.some((m) => m.status === "error"),
    isDryRun: env.DRY_RUN === "true",
  };

  await sendSummaryEmail(env, summary);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleHttpRequest(request, env);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(event, env));
  },
};

function computeNextIn(currentEpochDay: number, targetMod: number): number {
  const current = currentEpochDay % 5;
  if (current === targetMod) return 5;
  let diff = (targetMod - current + 5) % 5;
  if (diff === 0) diff = 5;
  return diff;
}
