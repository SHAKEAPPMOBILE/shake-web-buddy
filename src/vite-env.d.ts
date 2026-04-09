/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** GIPHY Web SDK — `.env.local` locally; Vercel `build.env` or project env for production. */
  readonly VITE_GIPHY_API_KEY?: string;
  readonly VITE_REVENUECAT_PUBLIC_KEY?: string;
}
