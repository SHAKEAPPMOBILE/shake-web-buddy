import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

/**
 * Compare two semver strings. Returns true if `b` is strictly greater than `a`.
 * Used to check: isBelow(installedVersion, minimumVersion)
 */
function isBelow(installed: string, minimum: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/[^0-9.]/g, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);

  const [aMaj, aMin, aPat] = parse(installed);
  const [bMaj, bMin, bPat] = parse(minimum);

  if (bMaj !== aMaj) return bMaj > aMaj;
  if (bMin !== aMin) return bMin > aMin;
  return bPat > aPat;
}

interface UpdateCheckResult {
  needsUpdate: boolean;
  minimumVersion: string | null;
}

export function useAppUpdateCheck(): UpdateCheckResult {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [minimumVersion, setMinimumVersion] = useState<string | null>(null);

  useEffect(() => {
    // Web always has the latest code — skip entirely.
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    const check = async () => {
      try {
        // Read minimum required version from Supabase — no redeploy needed to bump it.
        // iOS (CFBundleShortVersionString) and Android (versionName) are tracked on
        // completely different numeric scales, so each platform needs its own
        // threshold — comparing both against one shared value would either force-update
        // everyone on one platform or never trigger at all on the other.
        const configKey =
          Capacitor.getPlatform() === "android" ? "minimum_app_version_android" : "minimum_app_version_ios";
        const { data, error } = await supabase
          .from("app_config")
          .select("value")
          .eq("key", configKey)
          .maybeSingle();

        if (error || !data?.value || cancelled) return;

        const minimum = data.value;

        // Get the installed build's marketing version (CFBundleShortVersionString on iOS,
        // versionName on Android).
        const info = await App.getInfo();
        const installed = info.version;

        if (cancelled) return;

        setMinimumVersion(minimum);

        if (isBelow(installed, minimum)) {
          console.log(`[UpdateCheck] Force update: installed=${installed} minimum=${minimum}`);
          setNeedsUpdate(true);
        } else {
          console.log(`[UpdateCheck] OK: installed=${installed} minimum=${minimum}`);
        }
      } catch (err) {
        // Non-fatal — if the check fails, don't block the user.
        console.warn("[UpdateCheck] check failed:", err);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return { needsUpdate, minimumVersion };
}
