// /training/import: signed in and onboarded. The server part only checks access
// (requireOnboarded); the data is read from the on-device database inside the
// client component ImportView (Hevy/Strong import), which also works offline.
import { ImportView } from "@/components/training/import-view";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = { title: "Import – Bloom", robots: { index: false } };

export default async function ImportPage() {
  await requireOnboarded();
  return <ImportView />;
}
