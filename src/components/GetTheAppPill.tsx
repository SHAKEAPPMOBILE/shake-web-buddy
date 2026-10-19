import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { Smartphone, X } from "lucide-react";
import { ANDROID_STORE_URL, IOS_STORE_URL } from "@/lib/appStoreLinks";
import { detectWebDevice, storeUrlFor } from "@/lib/webStoreLink";

const DISMISSED_KEY = "shake_get_app_pill_dismissed_at";
const HIDE_AFTER_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
// Pages where a floating pill would sit on top of something that matters (the plan form's typing bar, the
// admin tools) or that already has its own download call to action.
const HIDDEN_ON = ["/propose-plan", "/auth", "/admin", "/pager", "/invite", "/guest", "/subscription-success"];

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < HIDE_AFTER_DISMISS_MS;
  } catch { return false; }
}

/**
 * "Get the app" pill for people using SHAKE in a browser: bottom right, above the tab bar. On a phone it
 * opens the right store (App Store on iPhone/iPad, Google Play on Android); on a computer it opens a small
 * card with both. Never shown inside the installed app. The × hides it for a week.
 */
export function GetTheAppPill() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(dismissedRecently);
  const [cardOpen, setCardOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the computer card when clicking anywhere else.
  useEffect(() => {
    if (!cardOpen) return;
    const onDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setCardOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [cardOpen]);

  if (Capacitor.isNativePlatform() || hidden) return null;
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  const open = () => {
    const device = detectWebDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
    const url = storeUrlFor(device);
    if (url) window.open(url, "_blank", "noopener");
    else setCardOpen((v) => !v);
  };

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* storage unavailable */ }
    setHidden(true);
  };

  return (
    <div
      ref={rootRef}
      // Above the home carousel overlay (z-40), below dialogs (z-50).
      className="fixed right-4 z-[45] flex flex-col items-end gap-2"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}
    >
      {cardOpen && (
        <div className="w-60 rounded-2xl bg-card border border-border shadow-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <p className="text-sm font-semibold text-foreground mb-3">{t("webApp.cardTitle", "Get SHAKE on your phone")}</p>
          <div className="flex flex-col gap-2">
            <a href={IOS_STORE_URL} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-full bg-black text-white text-sm font-semibold text-center hover:opacity-90 transition-opacity">App Store</a>
            <a href={ANDROID_STORE_URL} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-full bg-black text-white text-sm font-semibold text-center hover:opacity-90 transition-opacity">Google Play</a>
          </div>
        </div>
      )}
      <div className="flex items-center rounded-full bg-card border border-border shadow-md">
        <button type="button" onClick={open} className="flex items-center gap-1.5 pl-3 pr-2 py-2 text-sm font-semibold text-foreground hover:opacity-80 transition-opacity">
          <Smartphone className="w-4 h-4" />
          <span className="whitespace-nowrap">{t("webApp.getTheApp", "Get the app")}</span>
        </button>
        <button type="button" onClick={dismiss} aria-label={t("webApp.close", "Close")} className="pr-3 pl-1 py-2 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
