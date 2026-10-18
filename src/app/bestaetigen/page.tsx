import { Suspense } from "react";
import { ConfirmForm } from "@/components/confirm-form";

export const metadata = {
  title: "Anmeldung bestätigen – Bloom",
  robots: { index: false },
};

async function Content({
  searchParams,
}: Pick<PageProps<"/bestaetigen">, "searchParams">) {
  const { token } = await searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  if (!value) return <p>Der Bestätigungslink ist ungültig.</p>;
  return <ConfirmForm token={value} />;
}

export default function Page({ searchParams }: PageProps<"/bestaetigen">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold">Anmeldung bestätigen</h1>
      <Suspense fallback={<p>Lädt …</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
