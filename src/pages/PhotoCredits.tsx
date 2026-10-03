import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import { MinimalBackButton } from "@/components/MinimalBackButton";
import { useScrollNudge } from "@/hooks/useScrollNudge";
import { PLAN_BACKGROUNDS } from "@/data/planBackgrounds";

// Every background photo that records where it came from. Creative Commons licenses (CC BY,
// CC BY-SA) require a credit like this one; public-domain and CC0 photos are listed too.
const credited = PLAN_BACKGROUNDS.filter((b) => b.credit).sort((a, b) => a.label.localeCompare(b.label));

export default function PhotoCredits() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLElement>(null);
  useScrollNudge(scrollRef);

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden safe-area-top safe-area-bottom">
      <main ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pt-16 pb-[calc(env(safe-area-inset-bottom,0px)+4rem)]">
        <div className="container mx-auto px-4 max-w-3xl">
          <MinimalBackButton
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground mb-6"
            aria-label="Back"
          />
          <h1 className="font-display text-4xl font-bold text-foreground mb-4">Photo credits</h1>
          <p className="text-muted-foreground mb-8">
            City photos used as plan backgrounds, from Wikimedia Commons. Thank you to the photographers.
            Images are cropped and blurred to fit the app.
          </p>
          <ul className="space-y-4">
            {credited.map((b) => (
              <li key={b.id} className="text-sm">
                <span className="font-semibold text-foreground">{b.label}</span>
                <span className="text-muted-foreground">
                  {" — "}
                  {b.credit!.author}, {b.credit!.license}{" · "}
                  <a href={b.credit!.source} target="_blank" rel="noopener noreferrer" className="underline">
                    source
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
