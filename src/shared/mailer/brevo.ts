// ============================================================
//  shared/mailer/brevo.ts — Connecteur Brevo (ex-Sendinblue)
//  Tier gratuit : 300 emails/jour.
//  Doc API : https://developers.brevo.com/reference/sendtransacemail
//  Pas de dépendance SDK : appel REST direct.
// ============================================================

export interface BrevoOptions {
  apiKey: string;
  from: { email: string; name?: string };
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface BrevoResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendViaBrevo(options: BrevoOptions): Promise<BrevoResult> {
  const { apiKey, from, to, subject, htmlContent, textContent } = options;

  const payload: Record<string, unknown> = {
    sender: from,
    to,
    subject,
    htmlContent,
  };
  if (textContent) payload.textContent = textContent;

  try {
    const response = await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      return {
        ok: false,
        error: `Brevo API ${response.status}: ${JSON.stringify(data)}`,
      };
    }

    return { ok: true, messageId: data["messageId"] as string | undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: `Brevo fetch error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
