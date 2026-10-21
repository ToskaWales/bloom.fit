import { fetchOffProduct } from "@/lib/nutrition/off-fetch";
import { handleLookup } from "@/lib/nutrition/lookup-handler";
import { createClient } from "@/lib/supabase/server";

// POST (not GET) so the barcode never appears in a URL or an access log.
export async function POST(request: Request) {
  const supabase = await createClient();
  return handleLookup(request, {
    getUser: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ? { id: data.user.id } : null;
    },
    consume: async () => {
      const { data, error } = await supabase.rpc("consume_food_lookup");
      if (error) throw new Error("quota check failed");
      return data === "ok" || data === "limited" ? data : "not_allowed";
    },
    fetchProduct: (code) => fetchOffProduct(code),
  });
}
