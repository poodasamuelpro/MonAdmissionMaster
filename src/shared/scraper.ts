// ============================================================
//  shared/scraper.ts — Fetch HTML générique (Cloudflare Workers)
//  Pas de dépendance externe : fetch natif Workers uniquement.
// ============================================================

/** Options de fetch */
export interface FetchOptions {
  /** Timeout en ms (défaut : 15 000) */
  timeoutMs?: number;
  /** Headers supplémentaires */
  headers?: Record<string, string>;
  /** Nombre de tentatives max (défaut : 2) */
  maxRetries?: number;
  /** Délai entre les tentatives en ms (défaut : 1000) */
  retryDelayMs?: number;
}

/** Résultat d'un fetch HTML */
export interface FetchResult {
  url: string;
  html: string;
  statusCode: number;
  ok: boolean;
  error?: string;
}

/**
 * Pause asynchrone (compatible CF Workers via setTimeout/Promise)
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Récupère le HTML d'une URL avec retry automatique.
 * Retourne toujours un FetchResult, ne lève jamais d'exception.
 */
export async function fetchHtml(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const { timeoutMs = 15_000, headers = {}, maxRetries = 2, retryDelayMs = 1_000 } = options;

  let lastError = "";
  let lastStatus = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; MonAdmissionMasterBot/1.0; veille-academique)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9,ar;q=0.8,en;q=0.7",
          "Accept-Encoding": "gzip, deflate",
          ...headers,
        },
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      // 429 (rate limit) → on attend plus longtemps avant de réessayer
      if (response.status === 429) {
        lastError = `HTTP 429 Too Many Requests`;
        lastStatus = 429;
        if (attempt < maxRetries) await sleep(retryDelayMs * attempt * 2);
        continue;
      }

      if (!response.ok) {
        // Pour les 4xx (sauf 429), pas la peine de réessayer
        clearTimeout(timeoutId);
        return {
          url,
          html: "",
          statusCode: response.status,
          ok: false,
          error: `HTTP ${response.status} ${response.statusText}`,
        };
      }

      const html = await response.text();
      return { url, html, statusCode: response.status, ok: true };

    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const msg =
        err instanceof Error
          ? err.name === "AbortError"
            ? `Timeout après ${timeoutMs}ms`
            : err.message
          : String(err);
      lastError = msg;
      lastStatus = 0;

      // Timeout → réessayer avec délai
      if (attempt < maxRetries) {
        await sleep(retryDelayMs * attempt);
        continue;
      }
    }
  }

  return { url, html: "", statusCode: lastStatus, ok: false, error: lastError };
}

/**
 * Extrait le texte brut d'un HTML en supprimant les balises.
 * Version légère, sans librairie DOM (compatible Workers).
 */
export function htmlToText(html: string): string {
  return html
    // Supprimer les scripts et styles
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    // Remplacer certaines balises block par des sauts de ligne
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Supprimer toutes les autres balises HTML
    .replace(/<[^>]+>/g, " ")
    // Décoder les entités HTML courantes
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/&ecirc;/g, "ê")
    .replace(/&agrave;/g, "à")
    .replace(/&ccedil;/g, "ç")
    .replace(/&ocirc;/g, "ô")
    .replace(/&ucirc;/g, "û")
    .replace(/&acirc;/g, "â")
    .replace(/&iuml;/g, "ï")
    .replace(/&euml;/g, "ë")
    .replace(/&ugrave;/g, "ù")
    // Entités numériques décimales &#nnn;
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    // Entités numériques hexadécimales &#xHH;
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Normaliser les espaces multiples
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extrait les fenêtres de texte autour d'une position dans le texte.
 * Utile pour isoler le contexte d'un match.
 */
export function extractContext(
  text: string,
  position: number,
  windowSize = 300
): string {
  const start = Math.max(0, position - windowSize);
  const end = Math.min(text.length, position + windowSize);
  let excerpt = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) excerpt = "…" + excerpt;
  if (end < text.length) excerpt = excerpt + "…";
  return excerpt;
}
