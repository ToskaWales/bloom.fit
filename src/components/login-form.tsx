"use client";

// Login page (/login): passwordless two-step sign-in with an e-mail code.
// Step 1 requests the code, step 2 verifies it; both are server actions and no local data is read.
// Neighbours: app/login/actions, ui.tsx.

import { useActionState } from "react";
import { requestCode, verifyCode, type LoginState } from "@/app/login/actions";
import { Field, inputClass, Notice, SubmitButton } from "@/components/ui";

const idle: LoginState = { status: "idle" };

export function LoginForm() {
  const [requested, requestAction, requesting] = useActionState(
    requestCode,
    idle,
  );
  const [verified, verifyAction, verifying] = useActionState(verifyCode, idle);
  // Switching to step 2 is derived from the action result; no separate state to keep in sync.
  const email = requested.status === "code_sent" ? requested.email : "";

  if (email) {
    return (
      <form action={verifyAction} className="flex flex-col gap-3">
        <Notice tone="info">
          Wenn die Adresse {email} bei uns eingeladen ist, haben wir dir einen
          Code geschickt.
        </Notice>
        <input type="hidden" name="email" value={email} />
        <Field label="Code aus der E-Mail">
          <input
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            className={inputClass}
          />
        </Field>
        <SubmitButton
          pending={verifying}
          label="Einloggen"
          pendingLabel="Wird geprüft …"
        />
        {verified.status === "error" && <Notice>{verified.message}</Notice>}
        <a href="/login" className="text-center text-sm underline">
          Andere E-Mail-Adresse verwenden
        </a>
      </form>
    );
  }

  return (
    <form action={requestAction} className="flex flex-col gap-3">
      <Field label="E-Mail-Adresse">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className={inputClass}
          placeholder="du@beispiel.de"
        />
      </Field>
      <SubmitButton
        pending={requesting}
        label="Code per E-Mail senden"
        pendingLabel="Wird gesendet …"
      />
      {requested.status === "error" && <Notice>{requested.message}</Notice>}
    </form>
  );
}
