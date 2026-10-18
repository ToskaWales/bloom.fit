"use client";

import { useActionState } from "react";
import { joinWaitlist, type FormState } from "@/app/actions";

const initial: FormState = { status: "idle" };

export function WaitlistForm({
  variant,
  source,
}: {
  variant: string;
  source: string;
}) {
  const [state, action, pending] = useActionState(joinWaitlist, initial);

  if (state.status === "success") {
    return (
      <p
        role="status"
        className="rounded-xl bg-emerald-50 p-4 text-emerald-900"
      >
        Fast geschafft! Wir haben dir eine E-Mail geschickt. Bitte klicke auf
        den Link darin, um deine Anmeldung zu bestätigen.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="variant" value={variant} />
      <input type="hidden" name="source" value={source} />
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        E-Mail-Adresse
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="du@beispiel.de"
          className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 focus:outline-2 focus:outline-rose-500"
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          name="consent"
          value="on"
          required
          className="mt-1"
        />
        <span>
          Ich möchte per E-Mail über den Start von Bloom informiert werden.
          Meine Einwilligung kann ich jederzeit widerrufen. Details in der{" "}
          <a href="/datenschutz" className="underline">
            Datenschutzerklärung
          </a>
          .
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-rose-600 px-5 py-3 font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
      >
        {pending ? "Wird gesendet …" : "Auf die Warteliste"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
