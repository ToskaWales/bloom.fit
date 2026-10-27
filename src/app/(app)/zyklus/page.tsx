// /zyklus: signed in and onboarded. The server part only checks access
// (requireOnboarded); the data is read from the on-device database inside the
// client component CycleView (cycle log), which also works offline.
import { CycleView } from "@/components/daily/cycle-view";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = { title: "Zyklus – Bloom", robots: { index: false } };

export default async function CyclePage() {
  await requireOnboarded();
  return <CycleView />;
}
