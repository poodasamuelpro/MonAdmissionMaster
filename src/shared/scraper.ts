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
 * Récupère le HTML d'une URL.
 * Retourne toujours un FetchResult, ne lève jamais d'exception.
 */
export async function fetchHtml(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const { timeoutMs = 15_000, headers = {} } = options;

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
        ...headers,
      },
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
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
    return { url, html: "", statusCode: 0, ok: false, error: msg };
  }
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
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/&ecirc;/g, "ê")
    .replace(/&agrave;/g, "à")
    .replace(/&ccedil;/g, "ç")
    .replace(/&ocirc;/g, "ô")
    .replace(/&ucirc;/g, "û")
    .replace(/&acirc;/g, "â")
    .replace(/&#[0-9]+;/g, (match) => {
      const code = parseInt(match.slice(2, -1), 10);
      return String.fromCharCode(code);
    })
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
