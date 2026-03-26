/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GIPHY Web SDK key (injected via `vite.config` from `.env` / `.env.local`). */
  readonly NEXT_PUBLIC_GIPHY_API_KEY: string;
}
