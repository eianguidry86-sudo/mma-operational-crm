// market-data: read-only bridge from the CRM (mma-crm auth) to mma-data business_records.
//
//   GET ?mode=slim             -> every business, dashboard fields only (cached 10 min)
//   GET ?mode=detail&iusa=...  -> one full record, including the raw Data Axle row
//
// mma-data is locked to the service role, so the key lives only here (secret
// MMA_DATA_SERVICE_KEY). verify_jwt accepts any project JWT, including the public
// anon key, so the caller must also resolve to a signed-in CRM user.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const MMA_DATA_URL = "https://xykjsmqtkqokwbcnwmid.supabase.co";
const SLIM_FIELDS = [
  "iusa_number", "company_name", "address", "city", "zip_code", "phone",
  "executive_first_name", "executive_last_name", "executive_title",
  "primary_sic_code", "primary_sic_description", "primary_naics_description",
  "employee_size_range", "employee_size_actual", "sales_volume_range", "sales_volume_actual",
  "location_type", "type_of_business", "home_business", "year_established", "years_in_database",
  "website", "facebook_url", "franchise_description", "parent_company_name", "export_date",
].join(",");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

let dataClient: SupabaseClient | null = null;
function mmaData() {
  const key = Deno.env.get("MMA_DATA_SERVICE_KEY");
  if (!key) throw new Error("MMA_DATA_SERVICE_KEY secret is not set on the mma-crm project");
  dataClient ??= createClient(MMA_DATA_URL, key, { auth: { persistSession: false } });
  return dataClient;
}

let slimCache: { at: number; rows: unknown[] } | null = null;

async function loadSlim() {
  const data = mmaData();
  if (slimCache && Date.now() - slimCache.at < 10 * 60_000) return slimCache.rows;
  const rows: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await data
      .from("business_records")
      .select(SLIM_FIELDS)
      .order("iusa_number")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...page);
    if (page.length < 1000) break;
  }
  slimCache = { at: Date.now(), rows };
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // The anon key is a valid project JWT but has no user, so getUser() rejects it.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const crm = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: auth } = token ? await crm.auth.getUser(token) : { data: null };
  if (!auth?.user) return json({ error: "sign in required" }, 401);

  const url = new URL(req.url);
  try {
    if (url.searchParams.get("mode") === "detail") {
      const iusa = url.searchParams.get("iusa");
      if (!iusa) return json({ error: "iusa is required" }, 400);
      const { data: row, error } = await mmaData()
        .from("business_records").select("*").eq("iusa_number", iusa).maybeSingle();
      if (error) throw error;
      return row ? json(row) : json({ error: "not found" }, 404);
    }
    return json({ rows: await loadSlim() });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? "query failed" }, 500);
  }
});
