import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Compare two semver strings. Returns true if `remote` is strictly greater than `local`.
 * Handles "1.2.3" format; ignores pre-release suffixes.
 */
function isRemoteNewer(local: string, remote: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/[^0-9.]/g, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);

  const [lMaj, lMin, lPat] = parse(local);
  const [rMaj, rMin, rPat] = parse(remote);

  if (rMaj !== lMaj) return rMaj > lMaj;
  if (rMin !== lMin) return rMin > lMin;
  return rPat > lPat;
}

interface UpdateCheckResult {
  needsUpdate: boolean;
  remoteVersion: string | null;
}

export function useAppUpdateCheck(): UpdateCheckResult {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);

  useEffect(() => {
    // Only run on native platforms — skip web
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    const check = async () => {
      try {
        // Get installed app version from the OS
        const info = await App.getInfo();
        const localVersion = info.version; // e.g. "1.0.0"

        // Fetch the remote version manifest
        const res = await fetch("https://app.shakeapp.today/version.json", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const remote: string = data?.version;
        if (!remote) return;

        if (cancelled) return;

        setRemoteVersion(remote);
        if (isRemoteNewer(localVersion, remote)) {
          console.log(`[UpdateCheck] Update available: ${localVersion} → ${remote}`);
          setNeedsUpdate(true);
        } else {
          console.log(`[UpdateCheck] Up to date (local=${localVersion} remote=${remote})`);
        }
      } catch (err) {
        // Non-fatal — silently skip
        console.warn("[UpdateCheck] check failed:", err);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return { needsUpdate, remoteVersion };
}
