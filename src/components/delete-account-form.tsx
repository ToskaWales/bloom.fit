"use client";

import { useActionState, useEffect } from "react";
import { deleteAccount } from "@/app/(app)/einstellungen/actions";
import type { StepState } from "@/components/step-form";
import { Field, inputClass, Notice, SubmitButton } from "@/components/ui";
import { wipeLocalData } from "@/lib/local/wipe";

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(
    deleteAccount,
    {} as StepState,
  );

  // The account is gone on the server; now remove this device's copy too.
  useEffect(() => {
    if (!state.done) return;
    wipeLocalData()
      .catch(() => {})
      .finally(() => {
        // Full page load on purpose: drops all in-memory app state of the deleted account.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/");
      });
  }, [state.done]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Tippe LÖSCHEN zur Bestätigung">
        <input
          name="confirm"
          autoComplete="off"
          required
          className={inputClass}
        />
      </Field>
      {state.error && <Notice>{state.error}</Notice>}
      {state.done && <Notice tone="info">Dein Konto wurde gelöscht.</Notice>}
      <SubmitButton
        pending={pending || Boolean(state.done)}
        label="Konto endgültig löschen"
      />
    </form>
  );
}
