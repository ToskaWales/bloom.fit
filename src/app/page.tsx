// "/": public landing page with the waitlist form. Reads ?h= (headline
// variant) and ?src= (link source) for validation experiments; the form posts
// to the joinWaitlist server action. The static page shell is prerendered,
// only the part reading searchParams is behind Suspense.
import { Suspense } from "react";
import { WaitlistForm } from "@/components/waitlist-form";
import { HOOKS, pickVariant } from "@/lib/hooks";

async function Hero({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const params = await searchParams;
  const variant = pickVariant(params.h);
  // Free text from the URL: trimmed to 64 characters before it is stored.
  const src = typeof params.src === "string" ? params.src.slice(0, 64) : "";
  return (
    <section className="flex flex-col gap-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">
        Bloom · bald in DACH
      </p>
      <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
        {HOOKS[variant]}
      </h1>
      <p className="max-w-2xl text-lg text-neutral-700">
        Bloom ist die Trainings- und Ernährungs-App für Frauen, die ernsthaft
        Krafttraining machen und nicht mehr mit Wochen kämpfen wollen, die sie
        nicht verstehen. Training, Ernährung und Zyklus an einem Ort, angepasst
        an
        <em> deine</em> Daten.
      </p>
      <div id="warteliste" className="max-w-md">
        <WaitlistForm variant={variant} source={src} />
      </div>
    </section>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-rose-100 bg-white p-5">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-neutral-700">{children}</p>
    </div>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-16 px-4 py-12 sm:py-20">
        <Suspense fallback={<div className="h-96" />}>
          <Hero searchParams={searchParams} />
        </Suspense>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">
            Drei Apps, und die Mathe machst du im Kopf
          </h2>
          <p className="max-w-2xl text-neutral-700">
            Training in einer App, Kalorien in der nächsten, Zyklus in der
            dritten. Wie sich deine Kraft, dein Hunger und deine Motivation über
            den Monat verändern, setzt du selbst zusammen. Bloom führt alles an
            einem Ort zusammen und zeigt dir deine eigenen Muster.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">So funktioniert Bloom</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card title="1 · Loggen, ohne Schnickschnack">
              Training, Gewicht, Ernährung und ein kurzer Check-in zu Schlaf,
              Energie und Motivation. Schnell, ohne Pop-ups.
            </Card>
            <Card title="2 · Deine Muster sehen">
              Bloom legt Zyklus, Leistung, Gewicht und Befinden übereinander und
              zeigt, was bei dir wiederkehrt.
            </Card>
            <Card title="3 · Du entscheidest">
              Training und Ernährung passen sich deinen Daten an. Jeder
              Vorschlag ist erklärt und du kannst ihn ablehnen.
            </Card>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl bg-rose-50 p-6">
          <h2 className="text-2xl font-bold">Ehrlich zur Wissenschaft</h2>
          <p className="max-w-2xl text-neutral-800">
            Die Forschung ist bei einem Punkt klar: Zykluseffekte unterscheiden
            sich stark zwischen Frauen. Deshalb passt sich Bloom deinen Daten
            an, nicht einem festen Phasenkalender.
          </p>
          <ul className="max-w-2xl list-disc space-y-1 pl-5 text-neutral-800">
            <li>Es gibt keine allgemeingültigen Phasenregeln für Training.</li>
            <li>
              Viele Frauen bemerken trotzdem Veränderungen bei Energie, Hunger
              oder Belastbarkeit.
            </li>
            <li>
              Am sinnvollsten ist, deine eigenen Muster zu erkennen und danach
              zu entscheiden.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">Fair und ruhig</h2>
          <p className="max-w-2xl text-neutral-700">
            Keine Werbung, keine Streak-Pop-ups, keine Paywall nach jedem
            Eintrag. Geplanter Preis: 6,99 € pro Monat. Deine Gesundheitsdaten
            liegen auf Servern in der EU, und du kannst sie jederzeit
            exportieren oder löschen.
          </p>
          <a
            href="#warteliste"
            className="w-fit rounded-xl bg-rose-600 px-5 py-3 font-semibold text-white hover:bg-rose-700"
          >
            Auf die Warteliste
          </a>
        </section>
      </main>
      <footer className="mt-auto border-t border-rose-100 px-4 py-6 text-sm text-neutral-600">
        <div className="mx-auto flex max-w-4xl gap-4">
          <span>© Bloom</span>
          <a href="/impressum" className="underline">
            Impressum
          </a>
          <a href="/datenschutz" className="underline">
            Datenschutz
          </a>
        </div>
      </footer>
    </>
  );
}
