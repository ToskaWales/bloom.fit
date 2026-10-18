"use client";

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
