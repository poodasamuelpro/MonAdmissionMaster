// ============================================================
//  shared/types.ts — Types centraux MonAdmissionMaster
// ============================================================

/** Catégories de Masters Finance ciblés, par ordre de priorité */
export type MasterCategory =
  | 1  // Finance (Finance de marché, Finance internationale, etc.)
  | 2  // Ingénierie Financière
  | 3  // Finance d'Entreprise / Corporate Finance
  | 4; // Business Intelligence / Analyse de Données appliquée à la Finance

export const CATEGORY_LABELS: Record<MasterCategory, string> = {
  1: "Finance (Générale / Marché / Internationale)",
  2: "Ingénierie Financière",
  3: "Finance d'Entreprise / Corporate Finance",
  4: "Business Intelligence / Data Finance",
};

/** Type d'admission */
export type AdmissionType = "sans_concours" | "avec_concours" | "inconnu";

/** Score de confiance de la détection */
export type ConfidenceLevel = "high" | "medium" | "low";

/** Un Master détecté sur une source */
export interface DetectedMaster {
  /** Identifiant unique de déduplication */
  id: string;

  /** Nom de l'établissement */
  etablissement: string;

  /** Ville de l'établissement */
  ville: string;

  /** Intitulé exact du Master tel qu'extrait de la source */
  intituleExact: string;

  /** Catégorie normalisée (1-4) */
  category: MasterCategory;

  /** Label de la catégorie */
  categoryLabel: string;

  /** Type d'admission */
  admissionType: AdmissionType;

  /** Mode d'admission sur dossier ? */
  surDossier: boolean;

  /** Score de confiance de la détection (0-100) */
  confidenceScore: number;

  /** Niveau de confiance verbalisé */
  confidenceLevel: ConfidenceLevel;

  /** Extrait exact du texte ayant déclenché la détection */
  extractExact: string;

  /** URL source officielle */
  sourceUrl: string;

  /** Date de détection (ISO 8601) */
  detectedAt: string;

  /** Date limite de candidature si trouvée, sinon null */
  dateLimite: string | null;

  /** Frais de dossier/candidature en MAD — null si non trouvé */
  fraisDossier: number | null;

  /** Frais de scolarité annuels — null si non trouvé */
  fraisScolarite: number | null;

  /** Tarif spécifique étudiant étranger — null si non trouvé */
  fraisEtranger: number | null;

  /** Conditions d'accès (Bac+3, Bac+4, etc.) */
  conditionsAcces: string | null;

  /** Concours : dates et épreuves si disponibles */
  concoursDates: string | null;

  /** Signaler à vérifier manuellement */
  requiresManualCheck: boolean;

  /** Notes de vérification / avertissements */
  warnings: string[];
}

/** Résultat complet d'un module de veille */
export interface WatchResult {
  /** Nom du module ("encg" | "universites") */
  module: string;

  /** Timestamp d'exécution */
  executedAt: string;

  /** Nombre de sources analysées */
  sourcesScanned: number;

  /** Nombre de nouvelles détections (non-dupliquées) */
  newDetections: number;

  /** Nombre de résultats ignorés (score trop bas) */
  filteredOut: number;

  /** Nombre de doublons écartés */
  duplicatesSkipped: number;

  /** Détections retenues */
  detections: DetectedMaster[];

  /** Erreurs partielles (source inaccessible, parse échoué, etc.) */
  partialErrors: PartialError[];

  /** Statut global du module */
  status: "ok" | "partial" | "empty";
}

/** Erreur partielle sur une source particulière */
export interface PartialError {
  sourceUrl: string;
  error: string;
  timestamp: string;
}

/** Environnement Cloudflare Worker */
export interface Env {
  // KV Namespace pour la déduplication
  DEDUPE_KV: KVNamespace;

  // Fournisseur mail : "resend" | "brevo"
  EMAIL_PROVIDER: string;

  // Adresse de destination
  ALERT_EMAIL_TO: string;

  // Adresse expéditrice
  ALERT_EMAIL_FROM: string;

  // Mode dry-run
  DRY_RUN: string;

  // Seuil de confiance minimum (string car vars Cloudflare = strings)
  MIN_CONFIDENCE_SCORE: string;

  // Secrets (configurés via wrangler secret put)
  RESEND_API_KEY?: string;
  BREVO_API_KEY?: string;

  // Secret de protection du dashboard et du déclenchement manuel
  // À configurer : wrangler secret put TRIGGER_SECRET
  TRIGGER_SECRET?: string;
}

/** Résumé d'exécution pour l'email de synthèse */
export interface ExecutionSummary {
  executedAt: string;
  modules: Array<{
    service: string;
    status: string;
    result?: WatchResult;
    error?: string;
  }>;
  totalNewDetections: number;
  hasErrors: boolean;
  isDryRun: boolean;
}
