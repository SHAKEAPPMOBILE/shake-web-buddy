import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { toast } from "@/lib/app-toast";

interface Source {
  id: string;
  url: string;
  last_synced_at: string | null;
  last_count: number | null;
  last_status: string | null;
}

interface SyncResult {
  ok: boolean;
  error?: string;
  imported?: number;
  updated?: number;
  removed?: number;
  total?: number;
  titles?: string[];
}

// plan_sources and the sync-event-source function come from migration 20261107120000_event_sources.sql.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sources = () => (supabase as any).from("plan_sources");

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

/** Paste a website or calendar link; SHAKE copies its upcoming events and keeps them in step. */
export function ImportEvents() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { selectedCity } = useCity();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);        // "new" or a source id
  const [list, setList] = useState<Source[] | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await sources().select("id, url, last_synced_at, last_count, last_status").order("created_at", { ascending: false });
    setList((data as Source[] | null) ?? []);
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  const errorText = (code: string | undefined) => {
    switch (code) {
      case "no_events": return t("importEvents.errNoEvents", "We couldn't find events on that page. Try your calendar link (a .ics file) instead.");
      case "unreachable": return t("importEvents.errUnreachable", "We couldn't open that address. Check it and try again.");
      case "blocked_url":
      case "bad_url": return t("importEvents.errBadUrl", "That doesn't look like a website address we can read.");
      case "too_many_sources": return t("importEvents.errTooMany", "You've connected the most sites allowed. Remove one first.");
      case "city_required": return t("importEvents.errCity", "Pick your city first, then try again.");
      case "too_soon": return t("importEvents.errTooSoon", "Synced a moment ago. Give it a minute.");
      default: return t("importEvents.errGeneric", "Something went wrong. Try again in a moment.");
    }
  };

  const run = async (key: string, body: Record<string, unknown>) => {
    if (busy) return;
    setBusy(key); setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-event-source", { body });
      if (error) throw error;
      const r = data as SyncResult;
      if (!r.ok) { setMessage({ kind: "error", text: errorText(r.error) }); return; }
      const text = (r.imported ?? 0) > 0
        ? t("importEvents.done", "Imported {{count}} events. They're in Plans now.", { count: r.imported })
        : t("importEvents.upToDate", "Up to date. {{count}} events are on SHAKE.", { count: r.total ?? 0 });
      setMessage({ kind: "ok", text });
      toast.success(text);
      if (key === "new") setUrl("");
      await load();
    } catch {
      setMessage({ kind: "error", text: errorText(undefined) });
    } finally {
      setBusy(null);
    }
  };

  const connect = () => {
    const value = url.trim();
    if (!value) return;
    void run("new", { url: value, city: selectedCity ?? "", tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
  };

  const remove = async (id: string) => {
    setConfirmRemove(null); setBusy(id);
    // Their upcoming imported events go with it; past ones stay in the history.
    await supabase.from("user_activities").delete().eq("source_id", id).gt("scheduled_for", new Date().toISOString());
    await sources().delete().eq("id", id);
    setBusy(null);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <p className="text-sm text-gray-600">
          {t("importEvents.intro", "Paste your website or calendar link. We copy your upcoming events here, and each one sends people back to your site to register. Connect only a site you run.")}
        </p>
        <input
          id="import-events-url"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") connect(); }}
          placeholder={t("importEvents.placeholder", "yourwebsite.com/events")}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-gray-400"
        />
        <button
          type="button"
          onClick={connect}
          disabled={!url.trim() || busy !== null}
          className="w-full py-2.5 rounded-full text-sm font-semibold bg-black text-white disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {busy === "new" && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("importEvents.button", "Import events")}
        </button>
        {message && (
          <p className={`text-sm ${message.kind === "ok" ? "text-emerald-600" : "text-red-600"}`} role="status">{message.text}</p>
        )}
      </div>

      {list && list.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-900 mb-1">{t("importEvents.connected", "Connected sites")}</p>
          <div className="divide-y divide-gray-100">
            {list.map((s) => (
              <div key={s.id} className="py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{hostOf(s.url)}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {t("importEvents.eventsCount", "{{count}} events", { count: s.last_count ?? 0 })}
                      {s.last_synced_at ? ` · ${t("importEvents.synced", "synced {{when}}", { when: formatDistanceToNow(new Date(s.last_synced_at), { addSuffix: true }) })}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => run(s.id, { source_id: s.id })}
                    disabled={busy !== null}
                    aria-label={t("importEvents.syncNow", "Sync now")}
                    className="p-2 rounded-full hover:bg-gray-100 text-gray-500 disabled:opacity-40"
                  >
                    {busy === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(confirmRemove === s.id ? null : s.id)}
                    disabled={busy !== null}
                    aria-label={t("importEvents.remove", "Remove")}
                    className="p-2 rounded-full hover:bg-gray-100 text-gray-500 disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {confirmRemove === s.id && (
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => remove(s.id)} className="flex-1 py-2 rounded-full text-xs font-semibold bg-red-500 text-white">
                      {t("importEvents.removeConfirm", "Remove events too?")}
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(null)} className="px-4 py-2 rounded-full text-xs font-medium border border-gray-200 text-gray-700">
                      {t("planMenu.cancel", "Cancel")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
