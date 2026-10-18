import { TrainingHome } from "@/components/training/training-home";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = { title: "Training – Bloom", robots: { index: false } };

export default async function TrainingPage() {
  await requireOnboarded();
  return <TrainingHome />;
}
