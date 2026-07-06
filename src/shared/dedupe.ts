// ============================================================
//  shared/dedupe.ts — Déduplication via Cloudflare KV
//
//  Chaque module utilise un préfixe de clé distinct :
//    - ENCG        → "encg:<hash>"
//    - Universités → "univ:<hash>"
//  TTL : 60 jours (les annonces expirées se nettoient automatiquement).
// ============================================================

const KV_TTL_SECONDS = 60 * 24 * 3600; // 60 jours

/**
 * Génère un identifiant unique stable pour une détection.
 * Basé sur : établissement + intitulé + sourceUrl
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
  return hashArray
    .slice(0, 8) // 8 octets → 16 chars hex (suffisant pour dédup)
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
 * Liste les clés stockées pour un préfixe donné.
 * Utile pour le monitoring / debug.
 */
export async function listSeenKeys(
  kv: KVNamespace,
  prefix: string
): Promise<string[]> {
  const result = await kv.list({ prefix: `${prefix}:` });
  return result.keys.map((k) => k.name);
}
