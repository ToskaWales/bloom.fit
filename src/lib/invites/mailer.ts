// Sends the invitation email through Resend (server only). Only the transport lives
// here; creating the code and the invite row happens in the admin action, the waitlist's separate mailer is src/lib/waitlist/resend-mailer.ts.
import "server-only";

// Throws when Resend refuses, so the caller can tell the admin the mail was not sent.
export async function sendInviteMail(
  email: string,
  code: string,
): Promise<void> {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const link = `${site}/einladen?code=${encodeURIComponent(code)}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: email,
      subject: "Deine Einladung zu Bloom",
      text: [
        "Hi,",
        "",
        "du bist eingeladen, Bloom auszuprobieren.",
        "",
        `Zum Start: ${link}`,
        "",
        `Falls der Link nicht funktioniert, ist dies dein Einladungscode: ${code}`,
        "Du kannst dich mit Apple, Google oder mit deiner E-Mail-Adresse anmelden.",
        "Die Einladung ist 14 Tage gültig.",
        "",
        "Bloom",
      ].join("\n"),
    }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
}
