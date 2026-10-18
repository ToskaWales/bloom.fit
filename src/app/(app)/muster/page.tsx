import { MusterView } from "@/components/engine/muster-view";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = { title: "Muster – Bloom", robots: { index: false } };

export default async function MusterPage() {
  await requireOnboarded();
  return <MusterView />;
}
