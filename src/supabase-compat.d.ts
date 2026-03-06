import type { SupabaseClient } from "@supabase/supabase-js";

// Override the auto-generated strict typing from PostgrestVersion: "14.1"
// This makes .eq(), .select(), .insert() etc. accept standard string/boolean params
declare module "@/integrations/supabase/client" {
  export const supabase: SupabaseClient;
}
