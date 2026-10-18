import { redirect } from "next/navigation";
import { StepForm } from "@/components/step-form";
import { Field, inputClass, Page } from "@/components/ui";
import { requireProfile } from "@/lib/auth/dal";
import { redeemCode } from "./actions";

export const metadata = {
  title: "Einladung – Bloom",
  robots: { index: false },
};

export default async function InvitePage() {
  const { profile } = await requireProfile();
  if (profile.access_granted_at) redirect("/onboarding");
  return (
    <Page title="Bloom ist aktuell nur mit Einladung nutzbar">
      <p className="text-neutral-700">
        Dein Konto ist angelegt, aber noch nicht freigeschaltet. Hast du einen
        Einladungscode? Dann gib ihn hier ein. Sonst setzen wir dich auf die
        Warteliste und melden uns.
      </p>
      <StepForm action={redeemCode} label="Code einlösen">
        <Field label="Einladungscode">
          <input
            name="code"
            required
            autoComplete="off"
            className={inputClass}
            placeholder="ABCD-EFGH-JKLM-NPQR"
          />
        </Field>
      </StepForm>
    </Page>
  );
}
