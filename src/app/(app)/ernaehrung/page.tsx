import { NutritionView } from "@/components/nutrition/nutrition-view";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = {
  title: "Ernährung – Bloom",
  robots: { index: false },
};

export default async function NutritionPage() {
  await requireOnboarded();
  return <NutritionView />;
}
