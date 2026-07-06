// ============================================================
//  shared/mailer/resend.ts — Connecteur Resend (tier gratuit : 100 emails/jour)
//  Doc API : https://resend.com/docs/api-reference/emails/send-email
//  Pas de dépendance SDK : appel REST direct.
// ============================================================

export interface ResendOptions {
  apiKey: string;
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface ResendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendViaResend(
  options: ResendOptions
): Promise<ResendResult> {
  const { apiKey, from, to, subject, html, text, replyTo } = options;

  const payload: Record<string, unknown> = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (text) payload.text = text;
  if (replyTo) payload.reply_to = replyTo;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      return {
        ok: false,
        error: `Resend API ${response.status}: ${JSON.stringify(data)}`,
      };
    }

    return { ok: true, id: data["id"] as string | undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: `Resend fetch error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
