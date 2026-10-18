import Link from "next/link";
import { buttonClass, Page } from "@/components/ui";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = { title: "Bloom", robots: { index: false } };

export default async function AppHome() {
  const { profile } = await requireOnboarded();
  return (
    <Page title="Willkommen bei Bloom" narrow={false}>
      <p className="text-neutral-700">
        Dein Konto ist eingerichtet. Training, Check-ins und Ernährung folgen in
        den nächsten Schritten. Du bist von Anfang an dabei.
      </p>
      <p className="text-sm text-neutral-600">
        Ziele: {profile.goals.join(", ")} · {profile.training_days}x pro Woche
      </p>
      <Link href="/training" className={`${buttonClass} w-fit`}>
        Zum Training
      </Link>
    </Page>
  );
}
