// /login: sign in with Apple, Google or an email code. Public; signed-in
// visitors are sent on to /app. The form runs the actions in ./actions. The
// session check and URL messages read dynamic data, so they sit behind
// Suspense and the rest of the page stays static.
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Notice, Page, secondaryButtonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { signInWithApple, signInWithGoogle } from "./actions";

export const metadata = {
  title: "Einloggen – Bloom",
  robots: { index: false },
};

// Renders nothing; exists only to redirect, as a dynamic part inside Suspense.
async function RedirectIfSignedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/app");
  return null;
}

async function Messages({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  return (
    <>
      {params.invited && (
        <Notice tone="info">
          Deine Einladung ist gespeichert. Logge dich jetzt ein.
        </Notice>
      )}
      {params.error && (
        <Notice>
          Der Login hat nicht geklappt. Bitte versuche es noch einmal.
        </Notice>
      )}
    </>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Page title="Bei Bloom einloggen">
      <p className="text-neutral-700">
        Bloom ist aktuell nur mit Einladung nutzbar.
      </p>
      <Suspense>
        <RedirectIfSignedIn />
        <Messages searchParams={searchParams} />
      </Suspense>
      <div className="flex flex-col gap-3">
        <form action={signInWithApple}>
          <button className={`${secondaryButtonClass} w-full`}>
            Mit Apple fortfahren
          </button>
        </form>
        <form action={signInWithGoogle}>
          <button className={`${secondaryButtonClass} w-full`}>
            Mit Google fortfahren
          </button>
        </form>
      </div>
      <p className="text-center text-sm text-neutral-600">oder</p>
      <LoginForm />
    </Page>
  );
}
