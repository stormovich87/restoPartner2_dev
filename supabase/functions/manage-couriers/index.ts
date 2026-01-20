import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const transliterationMap: { [key: string]: string } = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
  'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i',
  'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
  'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
  'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
  'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '',
  'э': 'e', 'ю': 'yu', 'я': 'ya',
  'є': 'ye', 'і': 'i', 'ї': 'yi', 'ґ': 'g',
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D',
  'Е': 'E', 'Ё': 'E', 'Ж': 'Zh', 'З': 'Z', 'И': 'I',
  'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N',
  'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T',
  'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch',
  'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '',
  'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
  'Є': 'Ye', 'І': 'I', 'Ї': 'Yi', 'Ґ': 'G',
};

function transliterate(text: string): string {
  return text.split('').map(char => transliterationMap[char] || char).join('');
}

function generateCabinetSlug(firstname: string, lastname: string): string {
  const transliteratedFirst = transliterate(firstname.trim());
  const transliteratedLast = transliterate(lastname.trim());
  return `${transliteratedFirst}-${transliteratedLast}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "GET" && action === "list") {
      const partnerId = url.searchParams.get("partner_id");
      const branchId = url.searchParams.get("branch_id");
      const isOwn = url.searchParams.get("is_own");

      if (!partnerId) {
        return new Response(JSON.stringify({ error: "partner_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let query = supabase.from("couriers").select("*, branches(name)").eq("partner_id", partnerId).order("created_at", { ascending: false });
      if (branchId) query = query.eq("branch_id", branchId);
      if (isOwn === "true") query = query.eq("is_own", true).eq("is_external", false);
      else if (isOwn === "false") query = query.eq("is_external", true);

      const { data, error } = await query;
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST" && action === "create") {
      const body = await req.json();
      const { partner_id, branch_id, full_name, phone, is_active, vehicle_type, is_own } = body;
      if (!partner_id || !branch_id || !full_name || !phone) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase.from("couriers").insert({ partner_id, branch_id, name: full_name, phone, is_active: is_active !== undefined ? is_active : true, vehicle_type: vehicle_type || null, is_own: is_own !== undefined ? is_own : true, is_external: false }).select().single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "PUT" && action === "update") {
      const body = await req.json();
      const { id, partner_id, branch_id, name, lastname, telegram_username, phone, is_active, vehicle_type, is_own, cabinet_login, cabinet_password } = body;
      if (!id || !partner_id) {
        return new Response(JSON.stringify({ error: "id and partner_id are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const updateData: any = {};
      if (branch_id !== undefined) updateData.branch_id = branch_id;
      if (name !== undefined) updateData.name = name;
      if (lastname !== undefined) updateData.lastname = lastname;
      if (telegram_username !== undefined) updateData.telegram_username = telegram_username;
      if (phone !== undefined) updateData.phone = phone;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (vehicle_type !== undefined) updateData.vehicle_type = vehicle_type;
      if (is_own !== undefined) updateData.is_own = is_own;
      if (cabinet_login !== undefined) updateData.cabinet_login = cabinet_login;
      if (cabinet_password !== undefined) updateData.cabinet_password = cabinet_password;

      if (name !== undefined || lastname !== undefined) {
        const { data: currentCourier } = await supabase.from("couriers").select("name, lastname, is_external").eq("id", id).single();
        if (currentCourier && currentCourier.is_external) {
          const finalName = name !== undefined ? name : currentCourier.name;
          const finalLastname = lastname !== undefined ? lastname : currentCourier.lastname;
          if (finalName && finalLastname) updateData.cabinet_slug = generateCabinetSlug(finalName, finalLastname);
        }
      }

      const { data, error } = await supabase.from("couriers").update(updateData).eq("id", id).eq("partner_id", partner_id).select().single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "DELETE" && action === "delete") {
      const body = await req.json();
      const { id, partner_id } = body;
      if (!id || !partner_id) {
        return new Response(JSON.stringify({ error: "id and partner_id are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await supabase.from("couriers").delete().eq("id", id).eq("partner_id", partner_id);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action or method" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});