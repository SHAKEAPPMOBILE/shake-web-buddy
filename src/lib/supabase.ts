import { supabase as _supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

// Re-export with relaxed types to avoid strict PostgrestVersion inference issues
// The auto-generated types.ts includes PostgrestVersion: "14.1" which enables
// strict column-level type checking that's incompatible with string params.
export const supabase = _supabase as unknown as SupabaseClient;
