// /muster: signed in and onboarded. The server part only checks access
// (requireOnboarded); the data is read from the on-device database inside the
// client component MusterView (patterns found in the user's own data), which also works offline.
import { MusterView } from "@/components/engine/muster-view";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = { title: "Muster – Bloom", robots: { index: false } };

export default async function MusterPage() {
  await requireOnboarded();
  return <MusterView />;
}
