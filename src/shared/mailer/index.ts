// ============================================================
//  shared/mailer/index.ts — Couche d'abstraction mail unifiée
//
//  Sélectionne le fournisseur actif via ENV.EMAIL_PROVIDER.
//  Gère le dry-run et les secrets manquants.
// ============================================================

import type { Env, ExecutionSummary, DetectedMaster, WatchResult } from "../types.js";
import { sendViaResend } from "./resend.js";
import { sendViaBrevo } from "./brevo.js";

export interface SendEmailOptions {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  ok: boolean;
  provider: string;
  id?: string;
  error?: string;
  dryRun?: boolean;
}

/**
 * Envoie un email via le fournisseur configuré.
 * En dry-run : log uniquement, ne pas envoyer.
 */
export async function sendEmail(
  env: Env,
  opts: SendEmailOptions
): Promise<SendResult> {
  const isDryRun = env.DRY_RUN === "true";
  const provider = (env.EMAIL_PROVIDER ?? "resend").toLowerCase();

  if (isDryRun) {
    console.log(`[DRY-RUN] Email qui aurait été envoyé :`);
    console.log(`  To: ${opts.to}`);
    console.log(`  From: ${opts.from}`);
    console.log(`  Subject: ${opts.subject}`);
    console.log(`  Provider: ${provider}`);
    return { ok: true, provider, dryRun: true };
  }

  if (provider === "resend") {
    if (!env.RESEND_API_KEY) {
      return { ok: false, provider, error: "Secret RESEND_API_KEY manquant" };
    }
    const result = await sendViaResend({
      apiKey: env.RESEND_API_KEY,
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return { ...result, provider };
  }

  if (provider === "brevo") {
    if (!env.BREVO_API_KEY) {
      return { ok: false, provider, error: "Secret BREVO_API_KEY manquant" };
    }
    const result = await sendViaBrevo({
      apiKey: env.BREVO_API_KEY,
      from: { email: opts.from, name: "MonAdmissionMaster" },
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.html,
      textContent: opts.text,
    });
    return { ok: result.ok, provider, id: result.messageId, error: result.error };
  }

  return {
    ok: false,
    provider,
    error: `Fournisseur inconnu : "${provider}". Valeurs acceptées : "resend" ou "brevo"`,
  };
}

// ────────────────────────────────────────────────────────────
// Templates HTML des emails
// ────────────────────────────────────────────────────────────

/** Génère le HTML de l'email d'alerte de détection */
export function buildAlertEmailHtml(
  module: "ENCG" | "Universités publiques",
  detections: DetectedMaster[]
): string {
  const surDossier = detections.filter((d) => d.admissionType === "sans_concours");
  const avecConcours = detections.filter((d) => d.admissionType === "avec_concours");
  const autres = detections.filter((d) => d.admissionType === "inconnu");

  const renderDetection = (d: DetectedMaster): string => `
    <div style="border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:16px;background:#fafafa;">
      <h3 style="margin:0 0 8px;color:#1a1a2e;font-size:16px;">
        ${d.etablissement} — ${d.ville}
      </h3>
      <p style="margin:4px 0;"><strong>Intitulé :</strong> ${d.intituleExact}</p>
      <p style="margin:4px 0;">
        <strong>Catégorie :</strong>
        <span style="background:#e8f4fd;padding:2px 8px;border-radius:4px;font-size:13px;">
          ${d.categoryLabel}
        </span>
      </p>
      <p style="margin:4px 0;">
        <strong>Mode d'admission :</strong>
        <span style="background:${d.surDossier ? "#e8f8e8" : "#fff3e0"};padding:2px 8px;border-radius:4px;">
          ${d.surDossier ? "✅ Sur dossier (sans concours)" : d.admissionType === "avec_concours" ? "📝 Avec concours" : "❓ À vérifier"}
        </span>
      </p>
      ${d.dateLimite ? `<p style="margin:4px 0;"><strong>Date limite :</strong> <span style="color:#c0392b;font-weight:bold;">${d.dateLimite}</span></p>` : ""}
      ${d.fraisDossier !== null ? `<p style="margin:4px 0;"><strong>Frais de dossier :</strong> ${d.fraisDossier} MAD</p>` : "<p style='margin:4px 0;color:#777;'><em>Frais de dossier : non confirmé</em></p>"}
      ${d.fraisScolarite !== null ? `<p style="margin:4px 0;"><strong>Frais de scolarité/an :</strong> ${d.fraisScolarite} MAD</p>` : "<p style='margin:4px 0;color:#777;'><em>Frais de scolarité : non confirmé</em></p>"}
      ${d.fraisEtranger !== null ? `<p style="margin:4px 0;"><strong>Tarif étudiant étranger :</strong> ${d.fraisEtranger} MAD</p>` : "<p style='margin:4px 0;color:#e67e22;'><em>⚠ Tarif étranger : non confirmé — vérifier conditions spécifiques carte de séjour</em></p>"}
      ${d.conditionsAcces ? `<p style="margin:4px 0;"><strong>Conditions d'accès :</strong> ${d.conditionsAcces}</p>` : ""}
      ${d.concoursDates ? `<p style="margin:4px 0;"><strong>Concours/dates :</strong> ${d.concoursDates}</p>` : ""}
      <p style="margin:8px 0 4px;">
        <strong>Extrait source :</strong><br>
        <span style="font-size:12px;color:#555;font-style:italic;">${d.extractExact}</span>
      </p>
      <p style="margin:4px 0;">
        <strong>Confiance :</strong>
        <span style="background:${d.confidenceScore >= 70 ? "#d4edda" : "#fff3cd"};padding:2px 6px;border-radius:4px;font-size:12px;">
          ${d.confidenceLevel.toUpperCase()} (${d.confidenceScore}/100)
        </span>
        ${d.requiresManualCheck ? " ⚠ <strong>À vérifier manuellement</strong>" : ""}
      </p>
      ${d.warnings.length > 0 ? `<p style="margin:4px 0;color:#856404;font-size:12px;">⚠ ${d.warnings.join(" | ")}</p>` : ""}
      <p style="margin:8px 0 0;">
        <a href="${d.sourceUrl}" style="color:#007bff;text-decoration:none;">🔗 Source officielle</a>
      </p>
    </div>
  `;

  return `
  <!DOCTYPE html>
  <html lang="fr">
  <head><meta charset="UTF-8"><title>Alerte MonAdmissionMaster</title></head>
  <body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#333;">
    <div style="background:#1a1a2e;color:white;padding:20px;border-radius:8px;margin-bottom:24px;">
      <h1 style="margin:0;font-size:22px;">📋 MonAdmissionMaster</h1>
      <p style="margin:6px 0 0;opacity:0.85;">Alerte détection — ${module}</p>
      <p style="margin:4px 0 0;font-size:12px;opacity:0.7;">${new Date().toLocaleString("fr-FR")}</p>
    </div>

    <div style="background:#e8f4fd;border-left:4px solid #007bff;padding:12px;margin-bottom:20px;border-radius:4px;">
      <strong>${detections.length} Master(s) Finance détecté(s)</strong> — Source : ${module}
    </div>

    ${surDossier.length > 0 ? `
    <h2 style="color:#27ae60;font-size:18px;">✅ Admission sans concours (sur dossier) — PRIORITAIRE</h2>
    ${surDossier.map(renderDetection).join("")}
    ` : ""}

    ${avecConcours.length > 0 ? `
    <h2 style="color:#e67e22;font-size:18px;">📝 Admission avec concours</h2>
    ${avecConcours.map(renderDetection).join("")}
    ` : ""}

    ${autres.length > 0 ? `
    <h2 style="color:#7f8c8d;font-size:18px;">❓ Mode d'admission à vérifier</h2>
    ${autres.map(renderDetection).join("")}
    ` : ""}

    <div style="background:#fff3cd;border:1px solid #ffc107;padding:12px;border-radius:4px;margin-top:24px;">
      <strong>⚠ Rappel important :</strong> Vérifiez toujours directement sur le site officiel de l'établissement.
      Les informations sur les frais et les conditions pour les étudiants étrangers (carte de séjour marocaine)
      doivent être confirmées auprès du service de scolarité. Les données "non confirmées" ci-dessus
      n'ont pas été trouvées dans le texte analysé.
    </div>

    <p style="color:#777;font-size:11px;margin-top:20px;">
      Généré automatiquement par MonAdmissionMaster — Ne pas répondre à cet email.
    </p>
  </body>
  </html>`;
}

/** Génère le HTML de l'email de synthèse d'exécution */
export function buildSummaryEmailHtml(summary: ExecutionSummary): string {
  const statusIcon = (s: string) =>
    s === "ok" ? "✅" : s === "error" ? "❌" : "⚠";

  return `
  <!DOCTYPE html>
  <html lang="fr">
  <head><meta charset="UTF-8"><title>Rapport MonAdmissionMaster</title></head>
  <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
    <div style="background:#1a1a2e;color:white;padding:20px;border-radius:8px;margin-bottom:24px;">
      <h1 style="margin:0;font-size:20px;">📊 Rapport d'exécution</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.8;">${summary.executedAt}</p>
      ${summary.isDryRun ? '<p style="margin:4px 0 0;background:#f39c12;padding:4px 8px;border-radius:4px;font-size:12px;">MODE DRY-RUN — Aucun email réellement envoyé</p>' : ""}
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr style="background:#f8f9fa;">
          <th style="padding:10px;text-align:left;border-bottom:2px solid #dee2e6;">Module</th>
          <th style="padding:10px;text-align:left;border-bottom:2px solid #dee2e6;">Statut</th>
          <th style="padding:10px;text-align:right;border-bottom:2px solid #dee2e6;">Nouvelles détections</th>
        </tr>
      </thead>
      <tbody>
        ${summary.modules
          .map(
            (m) => `
        <tr style="border-bottom:1px solid #dee2e6;">
          <td style="padding:10px;">${m.service.toUpperCase()}</td>
          <td style="padding:10px;">${statusIcon(m.status)} ${m.status}${m.error ? ` — <span style="color:red;font-size:12px;">${m.error}</span>` : ""}</td>
          <td style="padding:10px;text-align:right;">${m.result?.newDetections ?? 0}</td>
        </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <div style="background:${summary.hasErrors ? "#f8d7da" : summary.totalNewDetections > 0 ? "#d4edda" : "#f8f9fa"};
                border-radius:6px;padding:14px;margin-bottom:16px;">
      <strong>Total nouvelles détections : ${summary.totalNewDetections}</strong>
      ${summary.hasErrors ? "<br><span style='color:#721c24;'>⚠ Au moins un module a rencontré une erreur.</span>" : ""}
    </div>

    <p style="color:#777;font-size:11px;">Généré automatiquement par MonAdmissionMaster.</p>
  </body>
  </html>`;
}

/** Génère le HTML de l'email d'erreur / alerte d'échec */
export function buildErrorEmailHtml(
  service: string,
  errorMessage: string,
  executedAt: string
): string {
  return `
  <!DOCTYPE html>
  <html lang="fr">
  <head><meta charset="UTF-8"><title>Erreur MonAdmissionMaster</title></head>
  <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
    <div style="background:#c0392b;color:white;padding:20px;border-radius:8px;margin-bottom:24px;">
      <h1 style="margin:0;font-size:20px;">🚨 Erreur d'exécution — MonAdmissionMaster</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.8;">${executedAt}</p>
    </div>
    <div style="background:#f8d7da;border:1px solid #f5c6cb;padding:16px;border-radius:6px;">
      <p><strong>Module en échec :</strong> ${service}</p>
      <p><strong>Erreur :</strong></p>
      <pre style="background:#fff;padding:10px;border-radius:4px;overflow-x:auto;font-size:12px;">${errorMessage}</pre>
    </div>
    <p style="color:#777;font-size:11px;margin-top:16px;">
      L'autre module a continué son exécution normalement (isolation par try/catch).
      Vérifiez les logs Cloudflare Workers pour plus de détails.
    </p>
  </body>
  </html>`;
}

/**
 * Envoie l'email de synthèse après exécution complète.
 * Envoie aussi un email d'alerte séparé pour les erreurs.
 */
export async function sendSummaryEmail(
  env: Env,
  summary: ExecutionSummary
): Promise<void> {
  const totalNew = summary.totalNewDetections;
  const hasErrors = summary.hasErrors;

  const subjectParts: string[] = [];
  if (totalNew > 0) subjectParts.push(`${totalNew} détection(s)`);
  if (hasErrors) subjectParts.push("⚠ erreur(s)");
  if (subjectParts.length === 0) subjectParts.push("Aucune détection");

  const subject = `[MonAdmissionMaster] ${subjectParts.join(" | ")} — ${new Date(summary.executedAt).toLocaleDateString("fr-FR")}`;

  const result = await sendEmail(env, {
    to: env.ALERT_EMAIL_TO,
    from: env.ALERT_EMAIL_FROM,
    subject,
    html: buildSummaryEmailHtml(summary),
    text: `Rapport MonAdmissionMaster — ${totalNew} détection(s) — ${hasErrors ? "ERREURS DÉTECTÉES" : "OK"}`,
  });

  if (!result.ok) {
    console.error("[mailer] Échec envoi email de synthèse:", result.error);
  } else {
    console.log(`[mailer] Email de synthèse envoyé via ${result.provider}${result.dryRun ? " (DRY-RUN)" : ""}`);
  }
}

/**
 * Envoie un email d'alerte pour les détections d'un module.
 */
export async function sendDetectionAlertEmail(
  env: Env,
  module: "ENCG" | "Universités publiques",
  result: WatchResult
): Promise<void> {
  if (result.detections.length === 0) return;

  const subject = `[MonAdmissionMaster] ${result.newDetections} nouveau(x) Master Finance — ${module}`;

  const sendResult = await sendEmail(env, {
    to: env.ALERT_EMAIL_TO,
    from: env.ALERT_EMAIL_FROM,
    subject,
    html: buildAlertEmailHtml(module, result.detections),
    text: result.detections
      .map(
        (d) =>
          `${d.etablissement} (${d.ville}) — ${d.intituleExact} — ${d.admissionType} — ${d.sourceUrl}`
      )
      .join("\n"),
  });

  if (!sendResult.ok) {
    console.error(`[mailer] Échec alerte détections ${module}:`, sendResult.error);
  }
}

/**
 * Envoie un email d'alerte d'erreur pour un module en échec.
 */
export async function sendErrorAlertEmail(
  env: Env,
  service: string,
  errorMessage: string
): Promise<void> {
  const executedAt = new Date().toISOString();
  const result = await sendEmail(env, {
    to: env.ALERT_EMAIL_TO,
    from: env.ALERT_EMAIL_FROM,
    subject: `[MonAdmissionMaster] 🚨 Échec module ${service}`,
    html: buildErrorEmailHtml(service, errorMessage, executedAt),
    text: `ERREUR module ${service}: ${errorMessage}`,
  });

  if (!result.ok) {
    console.error(`[mailer] Échec envoi email d'erreur pour ${service}:`, result.error);
  }
}
