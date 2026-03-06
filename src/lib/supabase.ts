// Re-export supabase client with relaxed types to avoid strict
// PostgrestVersion "14.1" inference from auto-generated types.ts
// Import this instead of "@/integrations/supabase/client" in all app code.
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const supabase = _supabase as unknown as SupabaseClient;
