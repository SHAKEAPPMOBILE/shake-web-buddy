import { Fragment } from "react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

// http(s):// links and bare www. links. Trailing punctuation is trimmed off below, so "see www.x.com." links www.x.com.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/;

const openLink = (url: string) => {
  if (Capacitor.isNativePlatform()) void Browser.open({ url });
  else window.open(url, "_blank", "noopener,noreferrer");
};

/** Plain text with its web addresses made tappable. Everything else is left exactly as written. */
export function LinkifiedText({ text, linkClassName = "underline underline-offset-2 text-primary break-all" }: { text: string; linkClassName?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const shown = raw.replace(TRAILING_PUNCTUATION, "");
    if (start > last) parts.push(text.slice(last, start));
    const href = /^https?:\/\//i.test(shown) ? shown : `https://${shown}`;
    parts.push(
      <a
        key={start}
        href={href}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openLink(href); }}
        className={linkClassName}
      >
        {shown}
      </a>,
    );
    last = start + shown.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}
