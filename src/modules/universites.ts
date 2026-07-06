// ============================================================
//  modules/universites.ts — Module veille Universités publiques
//
//  Responsabilité : scanner les FSJES et universités publiques,
//  filtrer les Masters Finance, dédupliquer, retourner résultats.
//  Totalement isolé : son propre try/catch dans index.ts.
// ============================================================

import type { Env, DetectedMaster, WatchResult, PartialError } from "../shared/types.js";
import { CATEGORY_LABELS } from "../shared/types.js";
import { fetchHtml, htmlToText } from "../shared/scraper.js";
import { analyzeText } from "../shared/filter.js";
import {
  generateDetectionId,
  isDuplicate,
  markAsSeen,
} from "../shared/dedupe.js";
import { UNIVERSITES_SOURCES } from "../sources/universites-sources.js";

/** Préfixe KV exclusif au module Universités */
const KV_PREFIX = "univ";

/** Délai entre les requêtes (ms) pour éviter d'être rate-limité */
const REQUEST_DELAY_MS = 500;

/** Pause asynchrone */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Point d'entrée principal du module Universités.
 * Appelé depuis index.ts dans un bloc try/catch isolé.
 */
export async function runUniversitesWatch(env: Env): Promise<WatchResult> {
  const executedAt = new Date().toISOString();
  console.log(`[universites] Démarrage veille Universités — ${executedAt}`);

  const minScore = parseInt(env.MIN_CONFIDENCE_SCORE ?? "60", 10);
  const detections: DetectedMaster[] = [];
  const partialErrors: PartialError[] = [];
  let sourcesScanned = 0;
  let filteredOut = 0;
  let duplicatesSkipped = 0;

  // Traiter les sources par priorité (1 d'abord)
  const sorted = [...UNIVERSITES_SOURCES].sort((a, b) => a.priority - b.priority);

  for (const source of sorted) {
    console.log(`[universites] Scan : ${source.url}`);

    // ── Délai anti-rate-limit ───────────────────────────────
    if (sourcesScanned > 0 || partialErrors.length > 0) {
      await sleep(REQUEST_DELAY_MS);
    }

    // ── Fetch HTML ──────────────────────────────────────────
    const fetchResult = await fetchHtml(source.url, { timeoutMs: 20_000, maxRetries: 2 });

    if (!fetchResult.ok) {
      console.warn(
        `[universites] Échec fetch ${source.url}: ${fetchResult.error}`
      );
      partialErrors.push({
        sourceUrl: source.url,
        error: fetchResult.error ?? "Erreur inconnue",
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    sourcesScanned++;
    const text = htmlToText(fetchResult.html);

    // ── Analyse & filtrage ──────────────────────────────────
    const filterResult = analyzeText(text, source.url, minScore);

    if (!filterResult.matched) {
      filteredOut++;
      console.log(
        `[universites] Ignoré (score ${filterResult.score}) : ${source.url} — ${filterResult.warnings.join(", ")}`
      );
      continue;
    }

    if (!filterResult.category) continue;

    // ── Déduplication ───────────────────────────────────────
    // IMPORTANT : on génère l'ID à partir de l'intitulé extrait,
    // pas de l'extractExact (qui peut varier si le texte de la page change légèrement)
    const intituleForHash = extractIntitule(text, filterResult.category);
    const detectionId = await generateDetectionId(
      source.etablissement,
      intituleForHash,
      source.url
    );

    const alreadySeen = await isDuplicate(env.DEDUPE_KV, KV_PREFIX, detectionId);
    if (alreadySeen) {
      duplicatesSkipped++;
      console.log(`[universites] Doublon ignoré : ${source.etablissement}`);
      continue;
    }

    // ── Construction de la détection ────────────────────────
    const detection: DetectedMaster = {
      id: detectionId,
      etablissement: source.etablissement,
      ville: source.ville,
      intituleExact: intituleForHash,
      category: filterResult.category,
      categoryLabel: CATEGORY_LABELS[filterResult.category],
      admissionType: filterResult.admissionType,
      surDossier: filterResult.surDossier,
      confidenceScore: filterResult.score,
      confidenceLevel: filterResult.level,
      extractExact: filterResult.extractExact,
      sourceUrl: source.url,
      detectedAt: new Date().toISOString(),
      dateLimite: filterResult.dateLimite,
      fraisDossier: filterResult.fraisDossier,
      fraisScolarite: filterResult.fraisScolarite,
      fraisEtranger: filterResult.fraisEtranger,
      conditionsAcces: extractConditionsAcces(text),
      concoursDates: extractConcoursDates(text),
      requiresManualCheck: filterResult.requiresManualCheck,
      warnings: filterResult.warnings,
    };

    // ── Marquer comme vu ────────────────────────────────────
    await markAsSeen(env.DEDUPE_KV, KV_PREFIX, detectionId, {
      etablissement: source.etablissement,
      intitule: detection.intituleExact,
      detectedAt: detection.detectedAt,
    });

    detections.push(detection);
    console.log(
      `[universites] ✅ Détection : ${source.etablissement} — ${detection.intituleExact} (score: ${filterResult.score})`
    );
  }

  const status: WatchResult["status"] =
    detections.length > 0
      ? "ok"
      : partialErrors.length > 0 && sourcesScanned === 0
      ? "partial"
      : "empty";

  console.log(
    `[universites] Terminé — ${detections.length} détection(s), ${partialErrors.length} erreur(s) partielles`
  );

  return {
    module: "universites",
    executedAt,
    sourcesScanned,
    newDetections: detections.length,
    filteredOut,
    duplicatesSkipped,
    detections,
    partialErrors,
    status,
  };
}

// ────────────────────────────────────────────────────────────
// Helpers d'extraction locaux
// ────────────────────────────────────────────────────────────

/** Extrait l'intitulé du Master depuis le texte */
function extractIntitule(text: string, category: number): string {
  const patterns = [
    /master\s+(?:en\s+|spécialis[eé]\s+en\s+)?([^\n.;,]{5,80})/i,
    /m[12]\s+([^\n.;,]{5,80}finance[^\n.;,]{0,60})/i,
    /filière\s+([^\n.;,]{5,60}finance[^\n.;,]{0,40})/i,
    /formation\s+(?:en\s+)?([^\n.;,]{5,80}finance[^\n.;,]{0,40})/i,
  ];

  for (const pat of patterns) {
    const match = text.match(pat);
    if (match?.[1]) {
      const intitule = match[1].trim().replace(/\s+/g, " ");
      if (intitule.length > 5 && intitule.length < 120) return intitule;
    }
  }

  const fallbacks: Record<number, string> = {
    1: "Master Finance (intitulé exact non extrait — vérifier source)",
    2: "Master Ingénierie Financière (intitulé exact non extrait — vérifier source)",
    3: "Master Finance d'Entreprise (intitulé exact non extrait — vérifier source)",
    4: "Master BI / Data Finance (intitulé exact non extrait — vérifier source)",
  };
  return fallbacks[category] ?? "Master Finance (intitulé non extrait)";
}

/** Extrait les conditions d'accès */
function extractConditionsAcces(text: string): string | null {
  const match = text.match(
    /(?:conditions?\s+d[''\s](?:accès|admission)|pré[\s-]?requis|niveau\s+requis|avoir\s+une?\s+(?:licence|bac\s*\+)|profil[s]?\s+(?:recherché|requis))[^\n.]{0,200}/i
  );
  if (match?.[0]) {
    return match[0].trim().replace(/\s+/g, " ").slice(0, 200);
  }
  return null;
}

/** Extrait les dates et détails de concours */
function extractConcoursDates(text: string): string | null {
  const match = text.match(
    /(?:concours|épreuve[s]?|test\s+de\s+sélection|entretien\s+de\s+sélection)[^\n.]{0,250}/i
  );
  if (match?.[0]) {
    return match[0].trim().replace(/\s+/g, " ").slice(0, 250);
  }
  return null;
}
