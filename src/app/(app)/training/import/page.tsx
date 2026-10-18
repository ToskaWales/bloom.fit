import { ImportView } from "@/components/training/import-view";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = { title: "Import – Bloom", robots: { index: false } };

export default async function ImportPage() {
  await requireOnboarded();
  return <ImportView />;
}
