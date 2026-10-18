import { CycleView } from "@/components/daily/cycle-view";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = { title: "Zyklus – Bloom", robots: { index: false } };

export default async function CyclePage() {
  await requireOnboarded();
  return <CycleView />;
}
