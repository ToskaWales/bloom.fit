"use client";

// Admin page (/admin): pick waitlist entries or paste addresses and send invitations.
// Props come from the server (waitlist rows); sending runs in the sendInvites server action. Not part of the user app.
// Neighbours: ui.tsx, app/(app)/admin/actions.

import { useActionState } from "react";
import { sendInvites, type InviteState } from "@/app/(app)/admin/actions";
import { Field, inputClass, Notice, SubmitButton } from "@/components/ui";

interface Entry {
  email: string;
  variant: string;
  source: string | null;
}

export function InviteForm({ waitlist }: { waitlist: Entry[] }) {
  const [state, action, pending] = useActionState(
    sendInvites,
    {} as InviteState,
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          Von der Warteliste (noch nicht eingeladen)
        </legend>
        {waitlist.length === 0 && (
          <p className="text-sm text-neutral-600">Niemand offen.</p>
        )}
        {waitlist.map((w) => (
          <label key={w.email} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="email" value={w.email} />
            {w.email}
            <span className="text-xs text-neutral-500">
              Hook {w.variant.toUpperCase()}
              {w.source ? ` · ${w.source}` : ""}
            </span>
          </label>
        ))}
      </fieldset>
      <Field label="Weitere Adressen (Komma, Leerzeichen oder Zeilenumbruch)">
        <textarea name="emails" rows={3} className={inputClass} />
      </Field>
      <SubmitButton pending={pending} label="Einladungen senden" />
      {state.error && <Notice>{state.error}</Notice>}
      {state.results && (
        <ul className="text-sm">
          {state.results.map((r) => (
            <li key={r.email}>
              {r.ok ? "✓" : "✗"} {r.email}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
