// /training: signed in and onboarded. The server part only checks access
// (requireOnboarded); the data is read from the on-device database inside the
// client component TrainingHome (templates and workouts), which also works offline.
import { TrainingHome } from "@/components/training/training-home";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = { title: "Training – Bloom", robots: { index: false } };

export default async function TrainingPage() {
  await requireOnboarded();
  return <TrainingHome />;
}
