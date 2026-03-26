import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import { X } from "lucide-react";
import { Grid } from "@giphy/react-components";
import { GiphyFetch } from "@giphy/js-fetch-api";
import type { IGif } from "@giphy/js-types";
import { Input } from "@/components/ui/input";

function gifToShareUrl(gif: IGif): string {
  return (
    gif.images.downsized_medium?.url ||
    gif.images.downsized?.url ||
    gif.images.fixed_height?.url ||
    (typeof gif.images.original?.url === "string" ? gif.images.original.url : "") ||
    ""
  );
}

export interface EventChatGiphyPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGifSelect: (gifUrl: string) => Promise<void>;
}

export function EventChatGiphyPickerModal({
  open,
  onOpenChange,
  onGifSelect,
}: EventChatGiphyPickerModalProps) {
  const apiKey = import.meta.env.VITE_GIPHY_API_KEY?.trim() ?? "";
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(320);

  const gf = useMemo(() => (apiKey ? new GiphyFetch(apiKey) : null), [apiKey]);

  /** Empty search → trending immediately; non-empty → debounce search. */
  useEffect(() => {
    if (!open) return;
    const q = searchInput.trim();
    if (q === "") {
      setDebouncedQuery("");
      return;
    }
    const t = window.setTimeout(() => setDebouncedQuery(q), 350);
    return () => clearTimeout(t);
  }, [searchInput, open]);

  useEffect(() => {
    if (!open) {
      setSearchInput("");
      setDebouncedQuery("");
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setGridWidth(Math.max(260, Math.floor(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  const fetchGifs = useCallback(
    (offset: number) => {
      if (!gf) throw new Error("GIPHY is not configured");
      if (debouncedQuery) {
        return gf.search(debouncedQuery, { offset, limit: 12, sort: "relevant", lang: "en" });
      }
      return gf.trending({ offset, limit: 12 });
    },
    [gf, debouncedQuery]
  );

  const onGifClick = useCallback(
    (gif: IGif, e: SyntheticEvent<HTMLElement, Event>) => {
      e.preventDefault();
      const url = gifToShareUrl(gif);
      if (!url) return;
      void (async () => {
        try {
          await onGifSelect(url);
          onOpenChange(false);
        } catch {
          /* parent handles errors; keep picker open */
        }
      })();
    },
    [onGifSelect, onOpenChange]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="GIF search"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-[2px] cursor-pointer"
        onClick={handleClose}
        aria-hidden
      />

      <div
        className="relative z-10 flex w-full max-w-md max-h-[min(85dvh,720px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <span className="w-10" aria-hidden />
          <h2 className="flex-1 truncate text-center font-medium text-white">GIFs</h2>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        <div className="shrink-0 border-b border-white/10 px-4 py-3">
          <Input
            type="search"
            placeholder="Search GIPHY…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="border-white/15 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-[#7c5cfc]/50"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
          {!apiKey || !gf ? (
            <p className="px-3 py-6 text-center text-sm text-white/60">
              Add <code className="rounded bg-white/10 px-1 text-xs">VITE_GIPHY_API_KEY</code> to{" "}
              <code className="rounded bg-white/10 px-1 text-xs">.env.local</code> and restart the dev server.
            </p>
          ) : (
            <div className="giphy-grid-wrap [&_a]:no-underline">
              <Grid
                key={debouncedQuery || "__trending__"}
                width={gridWidth}
                columns={3}
                gutter={6}
                fetchGifs={fetchGifs}
                onGifClick={onGifClick}
                noLink
                hideAttribution={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
