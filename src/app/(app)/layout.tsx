// Shared layout for all signed-in pages (the (app) route group): top
// navigation and the local-database provider. Access is enforced per page by
// requireOnboarded()/requireProfile(); this layout only supplies the profile
// settings that the offline database needs. Server component.
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/login/actions";
import { LocalProvider } from "@/components/local-provider";
import { LogoutForm } from "@/components/logout-button";
import { requireProfile } from "@/lib/auth/dal";

// Reads the session, so it streams in behind Suspense; the shell stays static.
// Why a separate component: with cacheComponents, the navigation can be
// prerendered while only this part waits for the signed-in user. The local
// database (LocalProvider) is created per user id and only enabled once
// onboarding is done, so unfinished accounts never start syncing.
async function Providers({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireProfile();
  return (
    <LocalProvider
      userId={user.id}
      units={profile.units}
      cycleMode={profile.cycle_mode}
      hideWeight={profile.hide_weight}
      nutritionMode={profile.nutrition_mode}
      enabled={Boolean(profile.onboarding_completed_at)}
    >
      {children}
    </LocalProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-rose-100 px-4 py-3">
        <nav className="mx-auto flex max-w-3xl items-center gap-4 text-sm">
          <Link href="/app" className="font-bold text-rose-600">
            Bloom
          </Link>
          <Link href="/training" className="underline">
            Training
          </Link>
          <Link href="/verlauf" className="underline">
            Verlauf
          </Link>
          <Link href="/einstellungen" className="underline">
            Einstellungen
          </Link>
          <LogoutForm action={signOut} />
        </nav>
      </header>
      <Suspense fallback={<p className="p-8 text-neutral-600">Lädt …</p>}>
        <Providers>{children}</Providers>
      </Suspense>
    </>
  );
}
