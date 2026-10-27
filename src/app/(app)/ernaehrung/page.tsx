// /ernaehrung: signed in and onboarded. The server part only checks access
// (requireOnboarded); the data is read from the on-device database inside the
// client component NutritionView (food log), which also works offline.
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
