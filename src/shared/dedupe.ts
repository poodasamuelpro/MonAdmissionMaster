// ============================================================
//  shared/dedupe.ts — Déduplication via Cloudflare KV
//
//  Chaque module utilise un préfixe de clé distinct :
//    - ENCG        → "encg:<hash>"
//    - Universités → "univ:<hash>"
//  TTL : 60 jours (les annonces expirées se nettoient automatiquement).
//
//  📊 CALCUL DU RISQUE DE SATURATION :
//  KV gratuit = 1 milliard de lectures, 1 million d'écritures/mois
//  Avec ~40 sources * 2 modules * 30 jours = ~2 400 lectures/mois max
//  Stockage : 1 Go max sur tier gratuit — largement suffisant
//  Une clé ≈ 50 octets × 10 000 clés max = 500 Ko → aucun risque
// ============================================================

const KV_TTL_SECONDS = 60 * 24 * 3600; // 60 jours
const KV_LIST_PAGE_SIZE = 1000; // Taille max de page KV

/**
 * Génère un identifiant unique stable pour une détection.
 * Basé sur : établissement + intitulé normalisé + sourceUrl
 *
 * ⚠ IMPORTANT : utiliser l'intitulé extrait (invariant),
 * PAS l'extractExact qui peut varier si la page change légèrement.
 */
export async function generateDetectionId(
  etablissement: string,
  intitule: string,
  sourceUrl: string
): Promise<string> {
  const raw = `${etablissement.toLowerCase().trim()}|${intitule.toLowerCase().trim()}|${sourceUrl.trim()}`;
  // Utilise la Web Crypto API (disponible dans CF Workers)
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // 12 octets → 24 chars hex (meilleure résistance aux collisions)
  return hashArray
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Vérifie si une détection est un doublon (déjà vue dans KV).
 * @param kv        KV Namespace bindé dans le Worker
 * @param prefix    Préfixe du module ("encg" | "univ")
 * @param id        Identifiant de la détection
 */
export async function isDuplicate(
  kv: KVNamespace,
  prefix: string,
  id: string
): Promise<boolean> {
  const key = `${prefix}:${id}`;
  const value = await kv.get(key);
  return value !== null;
}

/**
 * Marque une détection comme vue dans KV (avec TTL 60 jours).
 */
export async function markAsSeen(
  kv: KVNamespace,
  prefix: string,
  id: string,
  metadata: { etablissement: string; intitule: string; detectedAt: string }
): Promise<void> {
  const key = `${prefix}:${id}`;
  await kv.put(key, JSON.stringify(metadata), {
    expirationTtl: KV_TTL_SECONDS,
  });
}

/**
 * Liste TOUTES les clés stockées pour un préfixe donné.
 * Gère la pagination KV (max 1000 clés par appel).
 * Utile pour le monitoring / debug.
 */
export async function listSeenKeys(
  kv: KVNamespace,
  prefix: string
): Promise<string[]> {
  const allKeys: string[] = [];
  let cursor: string | undefined;

  do {
    const result: KVNamespaceListResult<unknown, string> = await kv.list({
      prefix: `${prefix}:`,
      limit: KV_LIST_PAGE_SIZE,
      cursor,
    });
    allKeys.push(...result.keys.map((k) => k.name));
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  return allKeys;
}

/**
 * Retourne le nombre de clés stockées pour un préfixe.
 * Plus efficace que listSeenKeys() si on a juste besoin du comptage.
 */
export async function countSeenKeys(
  kv: KVNamespace,
  prefix: string
): Promise<number> {
  const keys = await listSeenKeys(kv, prefix);
  return keys.length;
}
