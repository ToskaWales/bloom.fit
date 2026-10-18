import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/login/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-rose-100 px-4 py-3">
        <nav className="mx-auto flex max-w-3xl items-center gap-4 text-sm">
          <Link href="/app" className="font-bold text-rose-600">
            Bloom
          </Link>
          <Link href="/einstellungen" className="underline">
            Einstellungen
          </Link>
          <form action={signOut} className="ml-auto">
            <button className="underline">Ausloggen</button>
          </form>
        </nav>
      </header>
      <Suspense fallback={<p className="p-8 text-neutral-600">Lädt …</p>}>
        {children}
      </Suspense>
    </>
  );
}
