// Mailer implementation for the waitlist confirmation email via Resend. The invite email uses a separate sender: src/lib/invites/mailer.ts.
import type { Mailer } from "./types";

export function createResendMailer(
  apiKey: string,
  from: string,
  siteUrl: string,
): Mailer {
  return {
    async sendConfirmation(email, token) {
      const link = `${siteUrl}/bestaetigen?token=${encodeURIComponent(token)}`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: email,
          subject: "Bitte bestätige deine Anmeldung bei Bloom",
          text: [
            "Hi,",
            "",
            "schön, dass du dabei sein willst. Bitte bestätige deine E-Mail-Adresse, damit wir dich über den Start von Bloom informieren dürfen:",
            "",
            link,
            "",
            "Der Link ist 7 Tage gültig. Wenn du dich nicht angemeldet hast, ignoriere diese Mail einfach.",
            "",
            "Bloom",
          ].join("\n"),
        }),
      });
      if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
    },
  };
}
