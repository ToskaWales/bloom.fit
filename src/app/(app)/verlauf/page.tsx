// /verlauf: signed in and onboarded. The server part only checks access
// (requireOnboarded); the data is read from the on-device database inside the
// client component OverviewView (history and charts), which also works offline.
import { OverviewView } from "@/components/daily/overview-view";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = { title: "Verlauf – Bloom", robots: { index: false } };

export default async function OverviewPage() {
  await requireOnboarded();
  return <OverviewView />;
}
