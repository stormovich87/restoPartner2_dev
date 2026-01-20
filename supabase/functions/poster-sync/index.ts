import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PosterCategory {
  category_id: number;
  category_name: string;
  parent_category?: number;
  category_photo?: string;
  sort_order?: number;
}

interface PosterModification {
  dish_modification_id: number;
  name: string;
  price: number;
  type?: number;
  photo?: string;
  photo_origin?: string;
}

interface PosterModificationGroup {
  dish_modification_group_id: number;
  name: string;
  num_min?: number;
  num_max?: number;
  type?: number;
  modifications: PosterModification[];
}

interface PosterProduct {
  product_id: number;
  product_name: string;
  menu_category_id: number;
  price?: any;
  spots?: { spot_id: number; price: number }[];
  product_code?: string;
  hidden?: string;
  photo?: string;
  photo_origin?: string;
  group_modifications?: PosterModificationGroup[];
}

function extractPrice(product: PosterProduct): number {
  if (product.spots && product.spots.length > 0) {
    const firstSpot = product.spots.find(s => s.price > 0);
    if (firstSpot) {
      return firstSpot.price / 100;
    }
  }

  if (product.price) {
    if (typeof product.price === "object") {
      const priceKeys = Object.keys(product.price);
      if (priceKeys.length > 0) {
        const firstPrice = product.price[priceKeys[0]];
        if (typeof firstPrice === "number" && firstPrice > 0) {
          return firstPrice / 100;
        }
      }
    } else if (typeof product.price === "number") {
      return product.price / 100;
    }
  }

  console.warn(`Could not extract price for product ${product.product_id} (${product.product_name})`);
  return 0;
}

function buildPhotoUrl(photoPath: string | undefined, photoOrigin: string | undefined, posterAccount: string): string | null {
  const rawPhoto = photoOrigin || photoPath;

  if (!rawPhoto) {
    return null;
  }

  if (rawPhoto.startsWith('http://') || rawPhoto.startsWith('https://')) {
    return rawPhoto;
  }

  if (rawPhoto.startsWith('/')) {
    return `https://${posterAccount}.joinposter.com${rawPhoto}`;
  }

  return `https://${posterAccount}.joinposter.com/${rawPhoto}`;
}

Deno.serve(async (req: Request) => {
  console.log("[EDGE] Request received:", req.method, req.url);

  if (req.method === "OPTIONS") {
    console.log("[EDGE] Handling OPTIONS preflight");
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("[EDGE] Parsing request body...");
    const { partner_id, action } = await req.json();
    console.log("[EDGE] Request params:", { partner_id, action });

    if (!partner_id) {
      console.error("[EDGE] Missing partner_id");
      throw new Error("partner_id is required");
    }

    console.log("[EDGE] Creating Supabase client...");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("[EDGE] Loading partner settings...");
    const { data: settings, error: settingsError } = await supabase
      .from("partner_settings")
      .select("poster_account, poster_api_token")
      .eq("partner_id", partner_id)
      .maybeSingle();

    if (settingsError || !settings) {
      console.error("[EDGE] Failed to load settings:", settingsError);
      throw new Error("Failed to load partner settings");
    }

    if (!settings.poster_account || !settings.poster_api_token) {
      console.error("[EDGE] Poster credentials not configured");
      throw new Error("Poster API credentials not configured");
    }

    console.log("[EDGE] Settings loaded, poster_account:", settings.poster_account);

    if (action === "test") {
      console.log("[EDGE] Executing test action...");
      const testUrl = `https://${settings.poster_account}.joinposter.com/api/menu.getProducts?token=${settings.poster_api_token}`;
      const testResponse = await fetch(testUrl);
      const testData = await testResponse.json();

      if (testData.response && Array.isArray(testData.response)) {
        return new Response(
          JSON.stringify({ success: true, message: "Connection successful" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        throw new Error("Invalid response from Poster API");
      }
    }

    if (action === "sync") {
      console.log("[EDGE] Executing sync action...");
      const baseUrl = `https://${settings.poster_account}.joinposter.com/api`;
      const token = settings.poster_api_token;

      console.log("[EDGE] Fetching data from Poster API...");
      console.log("[EDGE] Categories URL:", `${baseUrl}/menu.getCategories?token=***`);
      console.log("[EDGE] Products URL:", `${baseUrl}/menu.getProducts?token=***`);

      const [categoriesRes, productsRes] = await Promise.all([
        fetch(`${baseUrl}/menu.getCategories?token=${token}`),
        fetch(`${baseUrl}/menu.getProducts?token=${token}`)
      ]);

      console.log("[EDGE] Poster API responses received");
      console.log("[EDGE] Categories status:", categoriesRes.status);
      console.log("[EDGE] Products status:", productsRes.status);

      const categoriesData = await categoriesRes.json();
      const productsData = await productsRes.json();

      const categories: PosterCategory[] = categoriesData.response || [];
      const products: PosterProduct[] = productsData.response || [];

      console.log("[EDGE] Starting sync for partner_id:", partner_id);
      console.log("[EDGE] Categories to sync:", categories.length);
      console.log("[EDGE] Products to sync:", products.length);

      if (products.length > 0) {
        console.log("[EDGE] Sample product structure (first product):", JSON.stringify(products[0], null, 2));
        if (products[0].group_modifications && products[0].group_modifications.length > 0) {
          const firstGroup = products[0].group_modifications[0];
          if (firstGroup.modifications && firstGroup.modifications.length > 0) {
            console.log("[EDGE] Sample modifier structure:", JSON.stringify(firstGroup.modifications[0], null, 2));
          }
        }
      }

      const categoryIds = new Set(categories.map(c => c.category_id));
      if (categoryIds.size > 0) {
        const catIdsArray = Array.from(categoryIds);
        await supabase
          .from("categories")
          .update({ is_active: false })
          .eq("partner_id", partner_id)
          .not("poster_category_id", "in", `(${catIdsArray.join(",")})`);
      }

      console.log("[EDGE] Batch upserting categories...");
      const categoryRecords = categories.map(cat => ({
        partner_id,
        poster_category_id: cat.category_id,
        name: cat.category_name,
        parent_poster_category_id: cat.parent_category || null,
        sort_order: cat.sort_order || null,
        is_active: true,
        updated_at: new Date().toISOString()
      }));

      const { error: catBatchError } = await supabase
        .from("categories")
        .upsert(categoryRecords, {
          onConflict: "poster_category_id,partner_id"
        });

      if (catBatchError) {
        console.error("[EDGE] Error batch upserting categories:", catBatchError);
        throw new Error(`Failed to batch upsert categories: ${catBatchError.message}`);
      }
      console.log("[EDGE] Finished upserting", categories.length, "categories");

      const productIds = new Set(products.map(p => p.product_id));
      if (productIds.size > 0) {
        const prodIdsArray = Array.from(productIds);
        await supabase
          .from("products")
          .update({ is_active: false })
          .eq("partner_id", partner_id)
          .not("poster_product_id", "in", `(${prodIdsArray.join(",")})`);
      }

      console.log("[EDGE] Preparing products and modifiers...");
      const allModifications = new Map<number, PosterModification>();
      const productModifierRelations: Array<{
        product_id: number;
        modifier_id: number;
        group_id: number;
        group_name: string;
        is_required: boolean;
        min_amount: number;
        max_amount: number;
        sort_order: number;
      }> = [];

      const productRecords = products.map(prod => {
        const price = extractPrice(prod);
        const isActive = prod.hidden !== "1";
        const photoUrl = buildPhotoUrl(prod.photo, prod.photo_origin, settings.poster_account);

        if (prod.group_modifications && prod.group_modifications.length > 0) {
          let globalSortOrder = 0;
          for (const group of prod.group_modifications) {
            if (group.modifications && group.modifications.length > 0) {
              for (const mod of group.modifications) {
                allModifications.set(mod.dish_modification_id, mod);

                productModifierRelations.push({
                  product_id: prod.product_id,
                  modifier_id: mod.dish_modification_id,
                  group_id: group.dish_modification_group_id,
                  group_name: group.name,
                  is_required: (group.num_min || 0) > 0,
                  min_amount: group.num_min || 0,
                  max_amount: group.num_max || 0,
                  sort_order: globalSortOrder++
                });
              }
            }
          }
        }

        return {
          partner_id,
          poster_product_id: prod.product_id,
          name: prod.product_name,
          category_poster_id: prod.menu_category_id,
          price: price,
          sku: prod.product_code || null,
          photo_url: photoUrl,
          is_active: isActive,
          updated_at: new Date().toISOString()
        };
      });

      console.log("[EDGE] Batch upserting", productRecords.length, "products...");
      const { error: prodBatchError } = await supabase
        .from("products")
        .upsert(productRecords, {
          onConflict: "poster_product_id,partner_id"
        });

      if (prodBatchError) {
        console.error("[EDGE] Error batch upserting products:", prodBatchError);
        throw new Error(`Failed to batch upsert products: ${prodBatchError.message}`);
      }
      console.log("[EDGE] Finished upserting", products.length, "products");

      const modifierIds = new Set(allModifications.keys());
      if (modifierIds.size > 0) {
        const modIdsArray = Array.from(modifierIds);
        await supabase
          .from("modifiers")
          .update({ is_active: false })
          .eq("partner_id", partner_id)
          .not("poster_modifier_id", "in", `(${modIdsArray.join(",")})`);
      }

      console.log("[EDGE] Batch upserting", allModifications.size, "modifiers...");
      const modifierRecords = Array.from(allModifications.entries()).map(([modId, mod]) => {
        const modPhotoUrl = buildPhotoUrl(mod.photo, mod.photo_origin, settings.poster_account);

        return {
          partner_id,
          poster_modifier_id: modId,
          name: mod.name,
          price_change: mod.price,
          photo_url: modPhotoUrl,
          is_active: true,
          updated_at: new Date().toISOString()
        };
      });

      const { error: modBatchError } = await supabase
        .from("modifiers")
        .upsert(modifierRecords, {
          onConflict: "poster_modifier_id,partner_id"
        });

      if (modBatchError) {
        console.error("[EDGE] Error batch upserting modifiers:", modBatchError);
        throw new Error(`Failed to batch upsert modifiers: ${modBatchError.message}`);
      }
      console.log("[EDGE] Finished upserting", allModifications.size, "modifiers");

      console.log("[EDGE] Batch upserting", productModifierRelations.length, "product_modifiers...");
      const pmRecords = productModifierRelations.map(pm => ({
        partner_id,
        product_poster_id: pm.product_id,
        modifier_poster_id: pm.modifier_id,
        is_required: pm.is_required,
        min_amount: pm.min_amount,
        max_amount: pm.max_amount,
        group_id: pm.group_id,
        group_name: pm.group_name,
        sort_order: pm.sort_order,
        updated_at: new Date().toISOString()
      }));

      const { error: pmBatchError } = await supabase
        .from("product_modifiers")
        .upsert(pmRecords, {
          onConflict: "product_poster_id,modifier_poster_id,partner_id"
        });

      if (pmBatchError) {
        console.error("[EDGE] Error batch upserting product_modifiers:", pmBatchError);
        throw new Error(`Failed to batch upsert product_modifiers: ${pmBatchError.message}`);
      }
      console.log("[EDGE] Finished upserting", productModifierRelations.length, "product_modifiers");

      const responseData = {
        success: true,
        message: "Sync completed successfully",
        stats: {
          categories: categories.length,
          products: products.length,
          modifiers: allModifications.size,
          productModifiers: productModifierRelations.length
        }
      };

      console.log("[EDGE] Sync completed successfully, returning response:", responseData);

      return new Response(
        JSON.stringify(responseData),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error("[EDGE] Invalid action:", action);
    throw new Error("Invalid action. Use 'test' or 'sync'");
  } catch (error) {
    console.error("[EDGE] Error occurred:", error);
    console.error("[EDGE] Error message:", error.message);
    console.error("[EDGE] Error stack:", error.stack);

    const errorResponse = {
      success: false,
      error: error.message || "Unknown error occurred"
    };

    console.log("[EDGE] Returning error response:", errorResponse);

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
