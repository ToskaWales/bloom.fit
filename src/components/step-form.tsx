"use client";

// Generic form shell for onboarding steps, the invitation page and settings sections.
// Takes a server action returning { error?, done? } and renders its children plus an error line and submit button.
// Neighbours: ui.tsx; delete-account-form.tsx reuses the StepState type.

import { useActionState, type ReactNode } from "react";
import { Notice, SubmitButton } from "@/components/ui";

export type StepState = { error?: string; done?: boolean };

export function StepForm({
  action,
  label,
  children,
}: {
  action: (prev: StepState, formData: FormData) => Promise<StepState>;
  label: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {children}
      {state.error && <Notice>{state.error}</Notice>}
      <SubmitButton pending={pending} label={label} />
    </form>
  );
}
