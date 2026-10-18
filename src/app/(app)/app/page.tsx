import { TodayView } from "@/components/daily/today-view";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = { title: "Heute – Bloom", robots: { index: false } };

export default async function AppHome() {
  await requireOnboarded();
  return <TodayView />;
}
