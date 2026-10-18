# Setup-Schritte (einmalig, durch dich)

## 1. Supabase (EU)

1. supabase.com → neues Projekt, Region **Frankfurt (eu-central-1)**.
2. Migration einspielen: SQL aus `supabase/migrations/20261101000000_waitlist.sql` im SQL-Editor ausführen (oder `supabase db push` mit CLI).
3. Projekt-URL und **Service-Role-Key** in die Umgebungsvariablen (`.env.local` lokal, im Hosting-Dashboard für Produktion). Service-Role-Key niemals ins Repo oder in `NEXT_PUBLIC_*`.

## 2. Resend (E-Mail)

1. resend.com → Domain `bloom.fit` hinzufügen, Region EU wählen.
2. Die angezeigten DNS-Einträge (SPF, DKIM, DMARC) im **GoDaddy-DNS** anlegen; warten, bis „Verified“.
3. API-Key erzeugen → `RESEND_API_KEY`; `MAIL_FROM="Bloom <hallo@bloom.fit>"`.

## 3. Hosting

Die Domain kann bei GoDaddy bleiben (nur DNS zeigen). GoDaddy-Shared-Hosting kann Next.js mit Server-Funktionen nicht ausführen.

| Option                                                                                             | Kosten          | Hinweis                                                    |
| -------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------- |
| Vercel Pro                                                                                         | ca. 20 $/Monat  | am einfachsten, Hobby-Tarif ist laut AGB nicht-kommerziell |
| Hetzner-VPS (EU) + Coolify/Docker                                                                  | ca. 4–6 €/Monat | günstig, DSGVO-freundlich, du betreibst den Server selbst  |
| Cloudflare Workers/Pages                                                                           | niedrig         | Next.js über Adapter, bei Next 16 noch zu prüfen           |
| Empfehlung: für die Wartelisten-Phase Vercel Pro oder Hetzner, Entscheidung vor dem ersten Deploy. |

## 4. DNS bei GoDaddy

`A`/`CNAME` auf das Hosting setzen (Werte liefert der Hosting-Anbieter) plus die Resend-Einträge.

## 5. Rechtstexte

`src/app/impressum/page.tsx` und `src/app/datenschutz/page.tsx` enthalten Platzhalter `[[…]]`. Ausfüllen und von einer Fachperson prüfen lassen (Entwurf, keine Rechtsberatung).

## 6. Optional: Plausible (EU, cookie-frei)

`NEXT_PUBLIC_PLAUSIBLE_DOMAIN=bloom.fit` setzen. Ohne Wert wird kein Analytics-Skript geladen.
