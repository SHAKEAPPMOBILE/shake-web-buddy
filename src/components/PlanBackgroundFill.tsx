import { getBackgroundStyle, type PlanBackground } from "@/data/planBackgrounds";

/**
 * Full-bleed render of a plan background inside a `relative` card.
 *
 * Gradients render as before. Photos (the city backgrounds) can't just be
 * `background-size: cover`d onto the tall feed card: a landscape skyline gets
 * cut down to a sliver of its middle and then upscaled several times over.
 * Instead the sharp photo sits across the top and fades out, over a blurred,
 * darkened copy of itself that fills the rest — the same treatment Apple Maps
 * uses for its "What's Happening in …" cards, and it never runs out of picture.
 */
export function PlanBackgroundFill({ bg }: { bg: PlanBackground }) {
  if (!bg.image) {
    return <div className="absolute inset-0" style={getBackgroundStyle(bg)} />;
  }
  const image = `url(${bg.image})`;
  const position = bg.focus ?? "center";
  const fade = "linear-gradient(to bottom, #000 72%, transparent 100%)";
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: "#111" }}>
      <div
        className="absolute"
        style={{
          inset: "-12%", // overscan so the blur doesn't pull in transparent edges
          backgroundImage: image,
          backgroundSize: "cover",
          backgroundPosition: position,
          filter: "blur(26px) brightness(0.55) saturate(1.15)",
        }}
      />
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: "58%",
          backgroundImage: image,
          backgroundSize: "cover",
          backgroundPosition: position,
          WebkitMaskImage: fade,
          maskImage: fade,
        }}
      />
    </div>
  );
}
