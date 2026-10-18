"use client";

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
