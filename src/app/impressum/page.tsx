export const metadata = { title: "Impressum – Bloom" };

// ENTWURF: Platzhalter in [[…]] ausfüllen und rechtlich prüfen lassen.
export default function Impressum() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-16">
      <h1 className="text-3xl font-bold">Impressum</h1>
      <p>Angaben gemäß § 5 DDG</p>
      <p>
        [[Vor- und Nachname / Firma und Rechtsform]]
        <br />
        [[Straße und Hausnummer]]
        <br />
        [[PLZ Ort]]
      </p>
      <p>Kontakt: E-Mail [[kontakt@bloom.fit]]</p>
      <p>[[Falls vorhanden: Umsatzsteuer-ID gemäß § 27a UStG]]</p>
      <p>
        Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV: [[Name, Anschrift
        wie oben]]
      </p>
    </main>
  );
}
