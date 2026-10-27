// /app: "Heute" (today) home screen. Signed in and onboarded. The data comes
// from the on-device database (rendered by the client component TodayView), so
// the page itself only checks access and shows the view.
import { TodayView } from "@/components/daily/today-view";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = { title: "Heute – Bloom", robots: { index: false } };

export default async function AppHome() {
  await requireOnboarded();
  return <TodayView />;
}
