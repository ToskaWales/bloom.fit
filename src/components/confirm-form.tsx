"use client";

import { useActionState } from "react";
import { confirmWaitlist, type FormState } from "@/app/actions";

export function ConfirmForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmWaitlist, {
    status: "idle",
  } as FormState);

  if (state.status === "success") {
    return (
      <p role="status" className="text-lg">
        Danke, du bist dabei! Wir melden uns, sobald es losgeht.
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-rose-600 px-5 py-3 font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
      >
        {pending ? "Wird bestätigt …" : "Anmeldung bestätigen"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
