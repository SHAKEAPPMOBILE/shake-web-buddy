/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";

// Override the auto-generated strict PostgREST v14 typing 
// The types.ts PostgrestVersion: "14.1" enables strict column inference
// that breaks .eq(), .select() etc with string params across 59+ files.
// This declaration overrides the exported client type to use relaxed generics.

declare module "../integrations/supabase/client" {
  export const supabase: SupabaseClient<any, "public", any>;
}
