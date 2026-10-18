import { DeleteAccountForm } from "@/components/delete-account-form";
import { HideWeightForm } from "@/components/hide-weight-form";
import { StepForm } from "@/components/step-form";
import { Field, inputClass, Page, secondaryButtonClass } from "@/components/ui";
import { requireOnboarded } from "@/lib/auth/dal";
import { berlinDay } from "@/lib/onboarding/schema";
import { setProductMail, updateCycle } from "./actions";

export const metadata = {
  title: "Einstellungen – Bloom",
  robots: { index: false },
};

const radio =
  "flex items-start gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-sm font-normal";

export default async function Settings() {
  const { supabase, user, profile } = await requireOnboarded();
  const { data: mail } = await supabase
    .from("consents")
    .select("id")
    .eq("kind", "product_mail")
    .is("revoked_at", null);
  const modes = [
    ["natural", "Natürlicher Zyklus"],
    ["irregular", "Unregelmäßig oder wechselnd"],
    ["hormonal", "Hormonelle Verhütung"],
    ["none", "Keine Angabe / kein Zyklus"],
  ] as const;

  return (
    <Page title="Einstellungen" narrow={false}>
      <p className="text-sm text-neutral-600">Angemeldet als {user.email}</p>

      <section className="flex max-w-md flex-col gap-3">
        <h2 className="text-lg font-semibold">Zyklus</h2>
        <StepForm action={updateCycle} label="Speichern">
          <fieldset className="flex flex-col gap-2">
            {modes.map(([value, label]) => (
              <label key={value} className={radio}>
                <input
                  type="radio"
                  name="cycleMode"
                  value={value}
                  defaultChecked={profile.cycle_mode === value}
                  className="mt-1"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <Field label="Beginn deiner letzten Periode (optional)">
            <input
              type="date"
              name="lastPeriodStart"
              max={berlinDay(new Date())}
              defaultValue={profile.last_period_start ?? ""}
              className={inputClass}
            />
          </Field>
        </StepForm>
      </section>

      <section className="flex max-w-md flex-col gap-3">
        <h2 className="text-lg font-semibold">Gewicht</h2>
        <HideWeightForm initial={profile.hide_weight} />
      </section>

      <section className="flex max-w-md flex-col gap-3">
        <h2 className="text-lg font-semibold">Einwilligungen</h2>
        <form action={setProductMail} className="flex flex-col gap-3">
          <label className={radio}>
            <input
              type="checkbox"
              name="productMail"
              value="on"
              defaultChecked={Boolean(mail?.length)}
              className="mt-1"
            />
            E-Mails zu Neuigkeiten von Bloom
          </label>
          <button className={secondaryButtonClass}>Speichern</button>
        </form>
        <p className="text-sm text-neutral-600">
          Die Einwilligung zur Verarbeitung deiner Gesundheitsdaten ist
          Grundlage von Bloom. Wenn du sie widerrufen möchtest, lösche dein
          Konto unten.
        </p>
      </section>

      <section className="flex max-w-md flex-col gap-3">
        <h2 className="text-lg font-semibold">Deine Daten</h2>
        <a
          href="/einstellungen/export"
          className={`${secondaryButtonClass} text-center`}
        >
          Daten exportieren (JSON)
        </a>
      </section>

      <section className="flex max-w-md flex-col gap-3">
        <h2 className="text-lg font-semibold">Konto löschen</h2>
        <p className="text-sm text-neutral-700">
          Dadurch werden dein Konto und alle deine Daten unwiderruflich
          gelöscht.
        </p>
        <DeleteAccountForm />
      </section>
    </Page>
  );
}
