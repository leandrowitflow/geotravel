/**
 * Verifies Supabase HTTPS + PostgREST and that core tables exist.
 * Run: npm run db:check
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  console.log("Geotravel DB check (Supabase REST, no DATABASE_URL)\n");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    console.error(
      "✗ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local\n\n" +
        "The service role key is server-only; never expose it to the browser.\n" +
        "Supabase → Project Settings → API → service_role.\n",
    );
    process.exit(1);
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error, count } = await sb
    .from("cases")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("✗ Request failed:", error.message, "\n");
    if (/relation|does not exist|schema cache/i.test(error.message)) {
      console.error(
        "Fix: Apply the SQL in drizzle/0000_init.sql (or your migrations) in the Supabase SQL editor.\n",
      );
    }
    process.exit(1);
  }

  console.log("✓ Supabase REST accepted a query on public.cases");
  console.log("  Row count (cases):", count ?? "?");
  if (count === 0) {
    console.log("\n  (Empty inbox is normal until ingest or: npm run db:seed)\n");
  }
  console.log("\nAll checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
