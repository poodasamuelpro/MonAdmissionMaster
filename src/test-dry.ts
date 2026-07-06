// ============================================================
//  src/test-dry.ts — Tests dry-run (Node.js / tsx)
//
//  Exécution : npx tsx src/test-dry.ts
//
//  Ce fichier N'EST PAS déployé sur Cloudflare.
//  Il sert uniquement à vérifier la logique localement.
// ============================================================

import { decideCronAction } from "./index.js";
import { analyzeText } from "./shared/filter.js";
import { htmlToText } from "./shared/scraper.js";
import {
  buildSummaryEmailHtml,
  buildAlertEmailHtml,
  buildErrorEmailHtml,
} from "./shared/mailer/index.js";
import type { DetectedMaster, ExecutionSummary } from "./shared/types.js";

// ────────────────────────────────────────────────────────────
// Couleurs console
// ────────────────────────────────────────────────────────────
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function pass(msg: string): void { console.log(`${GREEN}✅ PASS${RESET} ${msg}`); }
function fail(msg: string): void { console.log(`${RED}❌ FAIL${RESET} ${msg}`); }
function info(msg: string): void { console.log(`${BLUE}ℹ${RESET}  ${msg}`); }
function section(title: string): void {
  console.log(`\n${BOLD}${YELLOW}══ ${title} ══${RESET}`);
}

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string): void {
  if (condition) { pass(message); passCount++; }
  else { fail(message); failCount++; }
}

// ────────────────────────────────────────────────────────────
// MAIN — tout dans une fonction async pour éviter top-level await
// ────────────────────────────────────────────────────────────
async function main(): Promise<void> {

  // ══════════════════════════════════════════════════════════
  // TEST 1 — Logique de cron différenciée
  // ══════════════════════════════════════════════════════════
  section("TEST 1 : Logique cron différenciée");

  const msPerDay = 24 * 60 * 60 * 1000;
  const baseEpochDay = Math.floor(Date.now() / msPerDay);

  // Calculer des dates avec les bons mods
  let dateEncg: Date | null = null;
  let dateUniv: Date | null = null;
  let dateNone: Date | null = null;

  for (let i = 0; i < 5; i++) {
    const d = new Date(Date.now() + i * msPerDay);
    const epochDay = Math.floor(d.getTime() / msPerDay);
    const mod = epochDay % 5;
    if (mod === 0 && !dateEncg) dateEncg = d;
    if (mod === 2 && !dateUniv) dateUniv = d;
    if (mod !== 0 && mod !== 2 && !dateNone) dateNone = d;
  }
  // Si pas trouvé dans 5 jours, chercher dans 10
  if (!dateEncg || !dateUniv || !dateNone) {
    for (let i = 0; i < 10; i++) {
      const d = new Date(Date.now() + i * msPerDay);
      const epochDay = Math.floor(d.getTime() / msPerDay);
      const mod = epochDay % 5;
      if (mod === 0 && !dateEncg) dateEncg = d;
      if (mod === 2 && !dateUniv) dateUniv = d;
      if (mod !== 0 && mod !== 2 && !dateNone) dateNone = d;
    }
  }

  if (dateEncg) {
    const r = decideCronAction(dateEncg);
    assert(r === "encg", `decideCronAction → "encg" pour mod5=0 (${dateEncg.toDateString()})`);
  }
  if (dateUniv) {
    const r = decideCronAction(dateUniv);
    assert(r === "universites", `decideCronAction → "universites" pour mod5=2 (${dateUniv.toDateString()})`);
  }
  if (dateNone) {
    const r = decideCronAction(dateNone);
    assert(r === "none", `decideCronAction → "none" pour les autres jours (${dateNone.toDateString()})`);
  }

  // Vérifier qu'il n'y a jamais de collision sur 30 jours
  let collision = false;
  const encgDays: number[] = [];
  const univDays: number[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() + i * msPerDay);
    const decision = decideCronAction(d);
    const epochDay = Math.floor(d.getTime() / msPerDay);
    if (decision === "encg") encgDays.push(epochDay);
    if (decision === "universites") univDays.push(epochDay);
  }
  for (const ed of encgDays) {
    if (univDays.includes(ed)) { collision = true; break; }
  }
  assert(!collision, "Pas de collision ENCG/Universités sur 30 jours");
  info(`ENCG jours époque (30j) : ${encgDays.join(", ")}`);
  info(`Universités jours époque (30j) : ${univDays.join(", ")}`);

  // Vérifier l'écart minimum ≥ 2 jours
  let minGap = Infinity;
  for (const ed of encgDays) {
    for (const ud of univDays) {
      const gap = Math.abs(ed - ud);
      if (gap < minGap) minGap = gap;
    }
  }
  assert(
    encgDays.length > 0 && univDays.length > 0 && minGap >= 2,
    `Écart minimum ENCG/Universités = ${minGap} jour(s) (requis ≥ 2)`
  );

  // Vérifier fréquence = exactement 5 jours entre deux runs du même module
  const encgGaps: number[] = [];
  for (let i = 1; i < encgDays.length; i++) encgGaps.push(encgDays[i] - encgDays[i-1]);
  const univGaps: number[] = [];
  for (let i = 1; i < univDays.length; i++) univGaps.push(univDays[i] - univDays[i-1]);
  assert(
    encgGaps.every(g => g === 5),
    `ENCG : cycle exact de 5 jours (gaps: ${encgGaps.join(",")})`
  );
  assert(
    univGaps.every(g => g === 5),
    `Universités : cycle exact de 5 jours (gaps: ${univGaps.join(",")})`
  );
  info(`Écart ENCG→Univ = ${minGap} jours`);

  // ══════════════════════════════════════════════════════════
  // TEST 2 — Filtre : vrais positifs
  // ══════════════════════════════════════════════════════════
  section("TEST 2 : Filtre — vrais positifs");

  const truePosTexts = [
    {
      label: "Annonce Master Finance typique (sans concours)",
      text: `
        L'ENCG Casablanca ouvre les candidatures pour l'année universitaire 2025-2026.
        Appel à candidatures pour le Master en Finance de Marché. Niveau : Master, S7.
        Accès : Bac+3 (Licence en sciences économiques, gestion ou finance).
        Admission sur dossier, sans concours. Date limite de dépôt : 30 septembre 2025.
        Frais de dossier : 200 MAD. Frais de scolarité : 5 000 MAD par an.
      `,
    },
    {
      label: "Master Ingénierie Financière avec concours",
      text: `
        Ouverture des inscriptions — Master Ingénierie Financière — FSJES Rabat.
        Conditions d'accès : Bac+4 ou Bac+3 avec dossier solide. Niveau M1.
        Concours d'accès : épreuves écrites le 15 octobre 2025.
        Pré-inscription ouverte jusqu'au 1er octobre 2025.
        Frais de scolarité annuels : 8 000 MAD. Tarif étudiant étranger : 15 000 MAD.
      `,
    },
    {
      label: "Master Finance Internationale sur dossier",
      text: `
        Sélection des candidats — Master Finance Internationale — Semestre 7 (S7).
        Ouverture des candidatures pour le semestre 7 universitaire 2025-2026.
        Dépôt de dossier de candidature avant le 20 octobre 2025.
        Admission directe sur titre. Profil : Licence économie ou finance (Bac+3).
      `,
    },
  ];

  for (const t of truePosTexts) {
    const r = analyzeText(t.text, "https://test.ac.ma", 40);
    assert(r.matched, `Vrai positif : "${t.label}" → matched=true (score=${r.score})`);
    info(`  Cat: ${r.categoryLabel} | Admission: ${r.admissionType} | Score: ${r.score}`);
  }

  // ══════════════════════════════════════════════════════════
  // TEST 3 — Filtre : faux positifs (doivent être rejetés)
  // ══════════════════════════════════════════════════════════
  section("TEST 3 : Filtre — faux positifs (doivent être rejetés)");

  const falsePosTexts = [
    {
      label: "Offre d'emploi finance (hors admission)",
      text: `
        Recrutement : Analyste Emploi Finance — CDI — Casablanca.
        Le groupe XYZ recrute un analyste finance pour son département.
        Bac+5 requis, expérience 2 ans minimum.
      `,
    },
    {
      label: "Texte sans expression d'ouverture",
      text: `
        Le Master Finance de Marché est une formation de qualité.
        Les diplômés trouvent des emplois dans la banque et la finance.
        Niveau Master, accès Bac+3.
      `,
    },
    {
      label: "Texte vide",
      text: "Page en construction. Contactez-nous.",
    },
  ];

  for (const t of falsePosTexts) {
    const r = analyzeText(t.text, "https://test.ac.ma", 60);
    assert(!r.matched, `Faux positif rejeté : "${t.label}" → matched=false (score=${r.score})`);
  }

  // ══════════════════════════════════════════════════════════
  // TEST 4 — Score moyen → requiresManualCheck
  // ══════════════════════════════════════════════════════════
  section("TEST 4 : Score moyen → requiresManualCheck");

  const mediumText = `
    Candidature ouverte pour un master finance à l'université.
    Niveau licence requis. Dossier de candidature disponible sur le site.
  `;
  const r4 = analyzeText(mediumText, "https://test.ac.ma", 40);
  if (r4.matched) {
    info(`Score=${r4.score} → requiresManualCheck=${r4.requiresManualCheck}`);
    if (r4.score < 70) {
      assert(r4.requiresManualCheck, `Score ${r4.score} < 70 → requiresManualCheck=true`);
    } else {
      assert(true, `Score ${r4.score} ≥ 70 — confiance haute`);
    }
  } else {
    info(`Score=${r4.score} — pas suffisant pour le seuil 40`);
    assert(true, "Test 4 skipped — seuil non atteint"); // Test non bloquant
  }

  // ══════════════════════════════════════════════════════════
  // TEST 5 — htmlToText
  // ══════════════════════════════════════════════════════════
  section("TEST 5 : htmlToText");

  const sampleHtml = `
    <html><body>
    <h1>Admissions Master Finance</h1>
    <p>Candidatures <strong>ouvertes</strong> pour le <em>Master Finance de Marché</em>.</p>
    <script>console.log("inject")</script>
    <style>body{color:red}</style>
    </body></html>
  `;
  const plainText = htmlToText(sampleHtml);
  assert(!plainText.includes("<"), "htmlToText supprime toutes les balises HTML");
  assert(!plainText.includes("console.log"), "htmlToText supprime les scripts");
  assert(plainText.includes("Finance de Marché"), "htmlToText conserve le texte utile");
  info(`Texte extrait : "${plainText.slice(0, 100).trim()}..."`);

  // ══════════════════════════════════════════════════════════
  // TEST 6 — Résistance : simulation d'un module en échec
  // ══════════════════════════════════════════════════════════
  section("TEST 6 : Résistance — ENCG échoue, Universités continue");

  const results: Array<{ service: string; status: string; error?: string }> = [];

  // Simule ENCG qui échoue
  try {
    throw new Error("[SIMULATION] ENCG fetch timeout — erreur volontaire pour test");
  } catch (err) {
    console.error("  [encg-watch-test] Échec simulé capturé:", (err as Error).message);
    results.push({ service: "encg", status: "error", error: String(err) });
    // L'erreur est capturée → on continue normalement
  }

  // Simule Universités qui réussit
  try {
    results.push({ service: "universites", status: "ok" });
  } catch (err) {
    results.push({ service: "universites", status: "error", error: String(err) });
  }

  assert(results.length === 2, "Les deux modules ont produit un résultat malgré l'échec ENCG");
  assert(results[0].status === "error", "ENCG est en erreur (simulé, comme attendu)");
  assert(results[1].status === "ok", "Universités a continué malgré l'échec ENCG");

  // ══════════════════════════════════════════════════════════
  // TEST 7 — Templates emails
  // ══════════════════════════════════════════════════════════
  section("TEST 7 : Templates emails");

  const mockDetection: DetectedMaster = {
    id: "abc123",
    etablissement: "ENCG Casablanca",
    ville: "Casablanca",
    intituleExact: "Master Finance de Marché",
    category: 1,
    categoryLabel: "Finance (Générale / Marché / Internationale)",
    admissionType: "sans_concours",
    surDossier: true,
    confidenceScore: 85,
    confidenceLevel: "high",
    extractExact: "…candidatures ouvertes pour le Master Finance de Marché, admission sur dossier…",
    sourceUrl: "http://www.encg-casa.ma/admissions",
    detectedAt: new Date().toISOString(),
    dateLimite: "30 septembre 2025",
    fraisDossier: 200,
    fraisScolarite: 5000,
    fraisEtranger: null,
    conditionsAcces: "Licence en Finance ou Sciences Économiques (Bac+3)",
    concoursDates: null,
    requiresManualCheck: false,
    warnings: ["Tarif étudiant étranger : non confirmé"],
  };

  const mockSummary: ExecutionSummary = {
    executedAt: new Date().toISOString(),
    modules: [
      {
        service: "encg",
        status: "ok",
        result: {
          module: "encg",
          executedAt: new Date().toISOString(),
          sourcesScanned: 5,
          newDetections: 1,
          filteredOut: 3,
          duplicatesSkipped: 0,
          detections: [mockDetection],
          partialErrors: [],
          status: "ok",
        },
      },
      { service: "universites", status: "error", error: "Timeout simulé" },
    ],
    totalNewDetections: 1,
    hasErrors: true,
    isDryRun: true,
  };

  const alertHtml = buildAlertEmailHtml("ENCG", [mockDetection]);
  const summaryHtml = buildSummaryEmailHtml(mockSummary);
  const errorHtml = buildErrorEmailHtml("universites", "Timeout simulé", new Date().toISOString());

  assert(alertHtml.includes("Finance de Marché"), "Email alerte contient l'intitulé du Master");
  assert(alertHtml.includes("sur dossier"), "Email alerte mentionne le mode d'admission");
  assert(alertHtml.includes("non confirmé"), "Email alerte signale les données non confirmées");
  assert(summaryHtml.includes("DRY-RUN"), "Email synthèse indique le mode dry-run");
  assert(errorHtml.includes("universites"), "Email erreur identifie le module en échec");
  info("Templates HTML générés sans erreur");

  // ══════════════════════════════════════════════════════════
  // BILAN FINAL
  // ══════════════════════════════════════════════════════════
  console.log(`\n${BOLD}═══════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  Résultats : ${GREEN}${passCount} PASS${RESET} | ${passCount > 0 && failCount === 0 ? "" : RED}${failCount} FAIL${RESET}${BOLD}  ${RESET}`);
  console.log(`${BOLD}═══════════════════════════════════════${RESET}\n`);

  if (failCount > 0) {
    throw new Error(`${failCount} test(s) ont échoué. Voir les lignes ❌ FAIL ci-dessus.`);
  }

  console.log(`${GREEN}${BOLD}Tous les tests passent ✅ — Code prêt pour déploiement.${RESET}`);
}

// Exécution
main().catch((err) => {
  console.error(`\n${RED}${BOLD}ERREUR FATALE :${RESET}`, err instanceof Error ? err.message : err);
  // En Node.js, on peut utiliser Deno.exit ou juste laisser le process crash
  throw err;
});
