// /datenschutz: privacy policy. Public, static, no data. Still a draft with
// placeholders (see the note below); keep it in line with what the app stores.
export const metadata = { title: "Datenschutz – Bloom" };

// ENTWURF: Platzhalter in [[…]] ausfüllen und rechtlich prüfen lassen.
export default function Datenschutz() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-16">
      <h1 className="text-3xl font-bold">Datenschutzerklärung</h1>

      <h2 className="text-xl font-semibold">Verantwortlicher</h2>
      <p>
        [[Name und Anschrift wie im Impressum]], E-Mail: [[kontakt@bloom.fit]]
      </p>

      <h2 className="text-xl font-semibold">Warteliste</h2>
      <p>
        Wenn du dich für die Warteliste einträgst, verarbeiten wir deine
        E-Mail-Adresse, den Zeitpunkt deiner Einwilligung und deiner
        Bestätigung, die Überschrift-Variante, über die du zu uns gekommen bist,
        sowie – falls vorhanden – die Quelle des Links (z. B. „flyer“). Zweck
        ist, dich über den Start von Bloom zu informieren. Rechtsgrundlage ist
        deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Wir verwenden das
        Double-Opt-in-Verfahren: Erst nach Klick auf den Link in der
        Bestätigungsmail wird deine Anmeldung aktiv.
      </p>
      <p>
        Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft
        widerrufen, per E-Mail an [[kontakt@bloom.fit]]. Wir löschen deine Daten
        dann. Nicht bestätigte Anmeldungen löschen wir nach [[30]] Tagen.
        Spätestens nach [[24]] Monaten ohne Produktstart löschen wir die
        Warteliste.
      </p>

      <h2 className="text-xl font-semibold">Dienstleister</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Datenbank: Supabase (Server in der EU, [[Region Frankfurt]]),
          Auftragsverarbeitungsvertrag: [[abgeschlossen?]]
        </li>
        <li>
          E-Mail-Versand: Resend ([[EU-Region / Standardvertragsklauseln]])
        </li>
        <li>Hosting: [[Anbieter, Region]]</li>
        <li>
          Produktsuche per Barcode (nur wenn du Ernährung eingeschaltet hast und
          selbst suchst): Open Food Facts (openfoodfacts.org, Verein mit Sitz in
          Frankreich). Bloom schickt nur die Barcode-Nummer, über unseren
          Server, ohne deine IP-Adresse und ohne Kennung. Die Daten stehen unter
          der Open Database License (ODbL). Speicherst du ein Produkt, gehört
          seine Barcode-Nummer zu deinen Ernährungsdaten (Einwilligung nach Art.
          9 Abs. 2 lit. a DSGVO, die du beim Einschalten von Ernährung gibst):
          Sie wird wie deine übrigen Einträge in der EU gespeichert und ist im
          Export enthalten.
        </li>
        <li>
          Reichweitenmessung: [[Plausible Analytics (EU, ohne Cookies, ohne
          personenbezogene Daten) oder „keine“]]
        </li>
      </ul>

      <h2 className="text-xl font-semibold">Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung
        der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht,
        dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
      </p>
    </main>
  );
}
