import { OverviewView } from "@/components/daily/overview-view";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = { title: "Verlauf – Bloom", robots: { index: false } };

export default async function OverviewPage() {
  await requireOnboarded();
  return <OverviewView />;
}
