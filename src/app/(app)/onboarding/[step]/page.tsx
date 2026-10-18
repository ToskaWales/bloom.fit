import { notFound, redirect } from "next/navigation";
import { StepForm } from "@/components/step-form";
import { Field, inputClass, Page } from "@/components/ui";
import { requireInvited, type Profile } from "@/lib/auth/dal";
import {
  nextStep,
  STEP_ORDER,
  type OnboardingStep,
} from "@/lib/onboarding/next-step";
import { berlinDay, kgToLbs } from "@/lib/onboarding/schema";
import { saveBasics, saveConsents, saveCycle, saveGoals } from "../actions";

export const metadata = {
  title: "Willkommen bei Bloom",
  robots: { index: false },
};

const STEPS = STEP_ORDER;
type Step = OnboardingStep;

const radio =
  "flex items-start gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-sm font-normal";

function Goals({ profile }: { profile: Profile }) {
  const goals = [
    ["muscle", "Muskelaufbau"],
    ["recomp", "Rekomposition (Muskeln aufbauen, Fett abbauen)"],
    ["strength", "Kraft / persönliche Bestleistungen"],
  ] as const;
  const exp = [
    ["lt1y", "Weniger als 1 Jahr"],
    ["1to3y", "1 bis 3 Jahre"],
    ["gt3y", "Mehr als 3 Jahre"],
  ] as const;
  return (
    <StepForm action={saveGoals} label="Weiter">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          Was ist dein Ziel? (Mehrfachauswahl möglich)
        </legend>
        {goals.map(([value, label]) => (
          <label key={value} className={radio}>
            <input
              type="checkbox"
              name="goals"
              value={value}
              defaultChecked={profile.goals.includes(value)}
              className="mt-1"
            />
            {label}
          </label>
        ))}
      </fieldset>
      <Field label="Wie oft trainierst du pro Woche mit Gewichten?">
        <select
          name="trainingDays"
          defaultValue={profile.training_days ?? 3}
          className={inputClass}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {n}x pro Woche
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          Wie lange trainierst du schon strukturiert?
        </legend>
        {exp.map(([value, label]) => (
          <label key={value} className={radio}>
            <input
              type="radio"
              name="experience"
              value={value}
              defaultChecked={profile.experience === value}
              required
              className="mt-1"
            />
            {label}
          </label>
        ))}
      </fieldset>
    </StepForm>
  );
}

function Cycle({ profile }: { profile: Profile }) {
  const modes = [
    ["natural", "Ich habe einen natürlichen Zyklus (meist regelmäßig)"],
    ["irregular", "Mein Zyklus ist unregelmäßig oder wechselt"],
    ["hormonal", "Ich verhüte hormonell (Pille, Spirale, Implantat …)"],
    ["none", "Ich möchte keinen Zyklus angeben oder habe keinen"],
  ] as const;
  return (
    <StepForm action={saveCycle} label="Weiter">
      <p className="text-sm text-neutral-700">
        Bloom nutzt deinen Zyklus nur als einen Hinweis unter mehreren.
        Entscheidend sind deine eigenen Daten. Du kannst das jederzeit ändern.
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          Wie würdest du deinen Zyklus beschreiben?
        </legend>
        {modes.map(([value, label]) => (
          <label key={value} className={radio}>
            <input
              type="radio"
              name="cycleMode"
              value={value}
              defaultChecked={profile.cycle_mode === value}
              required
              className="mt-1"
            />
            {label}
          </label>
        ))}
      </fieldset>
      <Field
        label="Beginn deiner letzten Periode (optional)"
        hint="Nur bei natürlichem oder unregelmäßigem Zyklus relevant."
      >
        <input
          type="date"
          name="lastPeriodStart"
          max={berlinDay(new Date())}
          defaultValue={profile.last_period_start ?? ""}
          className={inputClass}
        />
      </Field>
    </StepForm>
  );
}

function Basics({ profile }: { profile: Profile }) {
  return (
    <StepForm action={saveBasics} label="Weiter">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Einheiten</legend>
        <label className={radio}>
          <input
            type="radio"
            name="units"
            value="metric"
            defaultChecked={profile.units === "metric"}
            className="mt-1"
          />
          Kilogramm (kg)
        </label>
        <label className={radio}>
          <input
            type="radio"
            name="units"
            value="imperial"
            defaultChecked={profile.units === "imperial"}
            className="mt-1"
          />
          Pfund (lbs)
        </label>
      </fieldset>
      <Field
        label="Aktuelles Gewicht (optional)"
        hint="Du kannst es später jederzeit ergänzen."
      >
        <input
          name="startWeight"
          inputMode="decimal"
          defaultValue={
            profile.start_weight_kg == null
              ? ""
              : profile.units === "imperial"
                ? kgToLbs(profile.start_weight_kg)
                : profile.start_weight_kg
          }
          className={inputClass}
        />
      </Field>
    </StepForm>
  );
}

function Consents() {
  return (
    <StepForm action={saveConsents} label="Fertig, los geht's">
      <p className="text-sm text-neutral-700">
        Dein Zyklus, dein Gewicht und dein Befinden sind Gesundheitsdaten. Wir
        verarbeiten sie nur, damit Bloom für dich funktioniert. Du kannst Daten
        jederzeit exportieren oder dein Konto löschen.
      </p>
      <label className={radio}>
        <input
          type="checkbox"
          name="terms"
          value="on"
          required
          className="mt-1"
        />
        <span>
          Ich akzeptiere die Nutzungsbedingungen und habe die{" "}
          <a href="/datenschutz" className="underline">
            Datenschutzerklärung
          </a>{" "}
          gelesen.
        </span>
      </label>
      <label className={radio}>
        <input
          type="checkbox"
          name="healthData"
          value="on"
          required
          className="mt-1"
        />
        <span>
          Ich willige ein, dass Bloom meine Gesundheitsdaten (z. B. Zyklus,
          Gewicht, Schlaf, Energie, Training) verarbeitet, um mein Training und
          meine Ernährung anzupassen.
        </span>
      </label>
      <label className={radio}>
        <input type="checkbox" name="productMail" value="on" className="mt-1" />
        <span>
          Ich möchte gelegentlich E-Mails zu Neuigkeiten von Bloom erhalten
          (optional).
        </span>
      </label>
    </StepForm>
  );
}

const TITLES: Record<Step, string> = {
  ziele: "Deine Ziele",
  zyklus: "Dein Zyklus",
  basis: "Ein paar Basics",
  einwilligung: "Deine Einwilligung",
};

export default async function OnboardingStep({
  params,
}: PageProps<"/onboarding/[step]">) {
  const { step } = await params;
  if (!STEPS.includes(step as Step)) notFound();
  const { profile } = await requireInvited();
  const next = nextStep(profile);
  if (next === null) redirect("/app");
  const index = STEPS.indexOf(step as Step);
  // Steps can't be skipped: send the user to the first incomplete one.
  if (index > STEPS.indexOf(next)) redirect(`/onboarding/${next}`);

  return (
    <Page title={TITLES[step as Step]}>
      <p className="text-sm text-neutral-600">
        Schritt {index + 1} von {STEPS.length}
      </p>
      {step === "ziele" && <Goals profile={profile} />}
      {step === "zyklus" && <Cycle profile={profile} />}
      {step === "basis" && <Basics profile={profile} />}
      {step === "einwilligung" && <Consents />}
    </Page>
  );
}
