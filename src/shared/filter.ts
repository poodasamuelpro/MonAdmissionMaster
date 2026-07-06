// ============================================================
//  shared/filter.ts — Scoring de confiance & filtrage anti-faux-positifs
//
//  Règle fondamentale : un match valide DOIT combiner :
//    (a) expression d'ouverture de candidature
//    (b) intitulé de filière Finance priorisée (cat. 1-4)
//    (c) niveau d'accès compatible (Master / S7 / Bac+3 / Bac+4)
//
//  Score de confiance (0-100) :
//    < 40  → ignoré
//    40-59 → "à vérifier manuellement"
//    ≥ 60  → signalé comme détection
// ============================================================

import type { DetectedMaster, MasterCategory, AdmissionType, ConfidenceLevel } from "./types.js";
import { CATEGORY_LABELS } from "./types.js";
import { extractContext } from "./scraper.js";

// ────────────────────────────────────────────────────────────
// (a) Expressions d'ouverture de candidature
// ────────────────────────────────────────────────────────────
const OUVERTURE_PATTERNS = [
  /candidature[s]?\s+(?:est\s+)?ouvert/i,
  /pré[\s-]?inscription[s]?\s+(?:est\s+)?ouvert/i,
  /appel\s+(?:à|aux)\s+candidature[s]?/i,
  /dépôt\s+de[s]?\s+dossier[s]?/i,
  /date[s]?\s+limite[s]?\s+(?:de\s+)?(?:dépôt|candidature|inscription)/i,
  /inscription[s]?\s+(?:est\s+)?ouvert/i,
  /avis\s+de\s+sélection/i,
  /avis\s+de\s+recrutement/i,
  /ouverture\s+des\s+(?:candidature|inscription)/i,
  /master[s]?\s+(?:recrute|ouvre|accueille)/i,
  /concours\s+d[''\s]accès/i,
  /concours\s+d[''\s]admission/i,
  /sélection\s+(?:des\s+)?(?:candidat|étudiant)/i,
  /modalités\s+d[''\s]accès/i,
  /conditions\s+d[''\s](?:accès|admission)/i,
  /formulaire\s+de\s+(?:candidature|inscription)/i,
  /dossier\s+de\s+candidature/i,
  /convocation\s+(?:aux|au)\s+(?:entretien|test|concours)/i,
  /frais\s+de\s+(?:scolarité|candidature)/i,
  /recrutement[s]?\s+(?:master|M[12])/i,
];

// ────────────────────────────────────────────────────────────
// (b) Filières Finance priorisées avec catégorie
// ────────────────────────────────────────────────────────────
interface FilierePattern {
  pattern: RegExp;
  category: MasterCategory;
  weight: number; // poids dans le score (1-3)
}

const FILIERE_PATTERNS: FilierePattern[] = [
  // Catégorie 1 — Finance générale / Marchés / International
  { pattern: /\bmaster\s+(?:en\s+)?finance\b/i, category: 1, weight: 3 },
  { pattern: /\bm[12]\s+finance\b/i, category: 1, weight: 3 },
  { pattern: /finance\s+(?:de\s+)?march[eé][s]?/i, category: 1, weight: 3 },
  { pattern: /finance\s+internationale/i, category: 1, weight: 3 },
  { pattern: /finance\s+(?:et\s+)?banque/i, category: 1, weight: 3 },
  { pattern: /banque\s+(?:et\s+)?finance/i, category: 1, weight: 3 },
  { pattern: /économie\s+(?:et\s+)?finance/i, category: 1, weight: 2 },
  { pattern: /gestion\s+financ/i, category: 1, weight: 2 },
  { pattern: /finance\s+(?:et\s+)?gestion/i, category: 1, weight: 2 },
  { pattern: /finance\s+(?:et\s+)?fiscalit[eé]/i, category: 1, weight: 2 },
  { pattern: /finance\s+(?:et\s+)?assurance/i, category: 1, weight: 2 },
  { pattern: /finance\s+islamique/i, category: 1, weight: 3 },
  { pattern: /finance\s+publique/i, category: 1, weight: 2 },

  // Catégorie 2 — Ingénierie Financière
  { pattern: /ing[eé]nierie\s+financ/i, category: 2, weight: 3 },
  { pattern: /financial\s+engineering/i, category: 2, weight: 3 },
  { pattern: /math[eé]matiques\s+financ/i, category: 2, weight: 2 },

  // Catégorie 3 — Finance d'Entreprise / Corporate Finance
  { pattern: /finance\s+d[''\s]entreprise/i, category: 3, weight: 3 },
  { pattern: /corporate\s+finance/i, category: 3, weight: 3 },
  { pattern: /finance\s+(?:et\s+)?contr[oô]le/i, category: 3, weight: 2 },
  { pattern: /contr[oô]le\s+de\s+gestion\s+(?:et\s+)?finance/i, category: 3, weight: 2 },
  { pattern: /management\s+financ/i, category: 3, weight: 2 },

  // Catégorie 4 — BI / Data Finance
  { pattern: /business\s+intelligence.*financ/i, category: 4, weight: 3 },
  { pattern: /financ.*business\s+intelligence/i, category: 4, weight: 3 },
  { pattern: /data.*financ/i, category: 4, weight: 2 },
  { pattern: /financ.*data/i, category: 4, weight: 2 },
  { pattern: /analytics.*financ/i, category: 4, weight: 2 },
  { pattern: /financ.*analytics/i, category: 4, weight: 2 },
  { pattern: /big\s+data.*financ/i, category: 4, weight: 2 },
  { pattern: /fintech/i, category: 4, weight: 2 },
];

// ────────────────────────────────────────────────────────────
// (c) Niveau d'accès compatible
// ────────────────────────────────────────────────────────────
const NIVEAU_PATTERNS = [
  /\bmaster\b/i,
  /\bm[12]\b/i,
  /\bs7\b/i,
  /\bsemestre\s+7\b/i,
  /bac\s*\+\s*[34]/i,
  /licence\s+(?:en\s+)?(?:professionnel|appliqu)/i, // Licence Pro = accès M1 valide
  /troisième\s+cycle/i,
  /second\s+cycle/i,
  /\b(?:l3|licence\s+3)\b/i,
  /masters?\s+spécialis[eé]/i,
];

// ────────────────────────────────────────────────────────────
// Contextes à exclure (faux positifs connus)
// ────────────────────────────────────────────────────────────
const EXCLUSION_PATTERNS = [
  /licence\s+(?:en\s+)?finance\b(?!\s+(?:master|ing[eé]nierie|d'entreprise))/i,
  /\bemploi\b.*\bfinance\b/i,
  /\bfinance\b.*\bemploi\b/i,
  /\bstage\b.*\bfinance\b/i,
  /\bfinance\b.*\bstage\b/i,
  /\bconférence\b.*\bfinance\b/i,
  /\bséminaire\b.*\bfinance\b/i,
  /\bcertificat\b.*\bfinance\b/i,
  /\bformation\s+continue\b/i,
  /\bDUT\b/i,
  /\bBTS\b/i,
  /\btechnicien\b.*\bfinance\b/i,
];

// ────────────────────────────────────────────────────────────
// Extraction du type d'admission
// ────────────────────────────────────────────────────────────
function detectAdmissionType(text: string): AdmissionType {
  const hasWithoutConcours =
    /sur\s+dossier/i.test(text) ||
    /sans\s+concours/i.test(text) ||
    /sélection\s+sur\s+(?:dossier|titre)/i.test(text) ||
    /admission\s+directe/i.test(text);

  const hasWithConcours =
    /concours\s+(?:d[''\s]accès|d[''\s]admission|écrit|oral)/i.test(text) ||
    /épreuve[s]?\s+(?:écrit|oral)/i.test(text) ||
    /test\s+(?:d[''\s]accès|de\s+sélection)/i.test(text);

  if (hasWithoutConcours && hasWithConcours) return "inconnu"; // les deux mentionnés
  if (hasWithoutConcours) return "sans_concours";
  if (hasWithConcours) return "avec_concours";
  return "inconnu";
}

// ────────────────────────────────────────────────────────────
// Extraction des frais (retourne null si non trouvé)
// ────────────────────────────────────────────────────────────
function extractAmount(
  text: string,
  pattern: RegExp
): number | null {
  const match = text.match(pattern);
  if (!match || !match[1]) return null;
  const num = parseFloat(match[1].replace(/[\s,]/g, ""));
  return isNaN(num) ? null : num;
}

function extractFees(text: string): {
  fraisDossier: number | null;
  fraisScolarite: number | null;
  fraisEtranger: number | null;
} {
  const fraisDossier = extractAmount(
    text,
    /frais\s+de\s+(?:dossier|candidature)[^\d]*(\d[\d\s,]*)\s*(?:MAD|DH|Dhs?)/i
  );
  const fraisScolarite = extractAmount(
    text,
    /frais\s+de\s+scolarit[eé][^\d]*(\d[\d\s,]*)\s*(?:MAD|DH|Dhs?)/i
  );
  const fraisEtranger = extractAmount(
    text,
    /[eé]tranger[^.]*?(\d[\d\s,]*)\s*(?:MAD|DH|Dhs?)/i
  );

  return { fraisDossier, fraisScolarite, fraisEtranger };
}

// ────────────────────────────────────────────────────────────
// Extraction de la date limite
// ────────────────────────────────────────────────────────────
function extractDeadline(text: string): string | null {
  const patterns = [
    /(?:date\s+limite|avant\s+le|jusqu'au|délai)[^\n.]{0,50}(\d{1,2}[\s/-]\w+[\s/-]\d{2,4})/i,
    /(\d{1,2}[\s/-](?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)[\s/-]\d{2,4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  ];
  for (const p of patterns) {
    const match = text.match(p);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// Interface résultat de filtre
// ────────────────────────────────────────────────────────────
export interface FilterResult {
  matched: boolean;
  score: number;
  level: ConfidenceLevel;
  category: MasterCategory | null;
  categoryLabel: string;
  extractExact: string;
  admissionType: AdmissionType;
  surDossier: boolean;
  dateLimite: string | null;
  fraisDossier: number | null;
  fraisScolarite: number | null;
  fraisEtranger: number | null;
  requiresManualCheck: boolean;
  warnings: string[];
}

/**
 * Analyse un texte et retourne le résultat de filtrage.
 * Exige la combinaison (a) + (b) + (c) pour valider.
 */
export function analyzeText(
  text: string,
  sourceUrl: string,
  minScore = 60
): FilterResult {
  const warnings: string[] = [];
  let score = 0;

  // ── Vérification de l'exclusion préalable ──
  for (const excl of EXCLUSION_PATTERNS) {
    if (excl.test(text)) {
      return {
        matched: false,
        score: 0,
        level: "low",
        category: null,
        categoryLabel: "",
        extractExact: "",
        admissionType: "inconnu",
        surDossier: false,
        dateLimite: null,
        fraisDossier: null,
        fraisScolarite: null,
        fraisEtranger: null,
        requiresManualCheck: false,
        warnings: ["Exclu : contexte hors admission Master Finance"],
      };
    }
  }

  // ── (a) Ouverture de candidature ──
  let ouvertureMatch: RegExpMatchArray | null = null;
  let ouverturePos = -1;
  for (const pat of OUVERTURE_PATTERNS) {
    const match = pat.exec(text);
    if (match) {
      ouvertureMatch = match;
      ouverturePos = match.index ?? 0;
      score += 30;
      break;
    }
  }

  if (!ouvertureMatch) {
    return {
      matched: false,
      score: 0,
      level: "low",
      category: null,
      categoryLabel: "",
      extractExact: "",
      admissionType: "inconnu",
      surDossier: false,
      dateLimite: null,
      fraisDossier: null,
      fraisScolarite: null,
      fraisEtranger: null,
      requiresManualCheck: false,
      warnings: ["Condition (a) non remplie : pas d'expression d'ouverture de candidature"],
    };
  }

  // ── (b) Filière Finance priorisée ──
  let filiereMatch: FilierePattern | null = null;
  let filierePos = -1;
  for (const fp of FILIERE_PATTERNS) {
    const match = fp.pattern.exec(text);
    if (match) {
      filiereMatch = fp;
      filierePos = match.index ?? 0;
      score += 20 + fp.weight * 5; // 25-35 pts selon poids
      break;
    }
  }

  if (!filiereMatch) {
    return {
      matched: false,
      score,
      level: "low",
      category: null,
      categoryLabel: "",
      extractExact: "",
      admissionType: "inconnu",
      surDossier: false,
      dateLimite: null,
      fraisDossier: null,
      fraisScolarite: null,
      fraisEtranger: null,
      requiresManualCheck: false,
      warnings: ["Condition (b) non remplie : filière Finance non détectée"],
    };
  }

  // ── (c) Niveau d'accès compatible ──
  let niveauMatch = false;
  for (const pat of NIVEAU_PATTERNS) {
    if (pat.test(text)) {
      niveauMatch = true;
      score += 20;
      break;
    }
  }

  if (!niveauMatch) {
    warnings.push(
      "Condition (c) incertaine : niveau d'accès Master/S7/Bac+3 non détecté explicitement — vérifier manuellement"
    );
    // On ne bloque pas mais on réduit le score et on flag
    score -= 10;
  }

  // ── Proximité entre les signaux (bonus) ──
  const distance = Math.abs(ouverturePos - filierePos);
  if (distance < 200) score += 10;
  else if (distance < 500) score += 5;

  // ── Extraction des données enrichies ──
  const admissionType = detectAdmissionType(text);
  const surDossier = admissionType === "sans_concours";
  if (surDossier) score += 5; // bonus légèrement (admission directe plus facile)

  const dateLimite = extractDeadline(text);
  if (dateLimite) score += 5;

  const { fraisDossier, fraisScolarite, fraisEtranger } = extractFees(text);

  // ── Avertissements ──
  if (fraisDossier === null) warnings.push("Frais de dossier : non trouvé — à vérifier");
  if (fraisScolarite === null) warnings.push("Frais de scolarité : non trouvé — à vérifier");
  if (fraisEtranger === null)
    warnings.push("Tarif étudiant étranger : non confirmé — vérifier conditions spécifiques");
  if (!niveauMatch)
    warnings.push("Niveau Bac+3/Bac+4 non explicité dans le texte extrait");

  // ── Score final : normaliser à 100 ──
  score = Math.min(100, Math.max(0, score));

  const level: ConfidenceLevel =
    score >= 70 ? "high" : score >= 50 ? "medium" : "low";

  const requiresManualCheck = score < 70 || !niveauMatch || warnings.length > 2;

  if (score < minScore) {
    return {
      matched: false,
      score,
      level,
      category: filiereMatch.category,
      categoryLabel: CATEGORY_LABELS[filiereMatch.category],
      extractExact: "",
      admissionType,
      surDossier,
      dateLimite,
      fraisDossier,
      fraisScolarite,
      fraisEtranger,
      requiresManualCheck,
      warnings: [...warnings, `Score ${score} < seuil ${minScore} → ignoré`],
    };
  }

  // Extraire le meilleur contexte (fenêtre autour du match filière)
  const extractExact = extractContext(text, filierePos, 400);

  return {
    matched: true,
    score,
    level,
    category: filiereMatch.category,
    categoryLabel: CATEGORY_LABELS[filiereMatch.category],
    extractExact,
    admissionType,
    surDossier,
    dateLimite,
    fraisDossier,
    fraisScolarite,
    fraisEtranger,
    requiresManualCheck,
    warnings,
  };
}
