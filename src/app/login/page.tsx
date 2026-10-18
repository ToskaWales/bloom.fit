import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Notice, Page, secondaryButtonClass } from "@/components/ui";
import { signInWithApple, signInWithGoogle } from "./actions";

export const metadata = {
  title: "Einloggen – Bloom",
  robots: { index: false },
};

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
