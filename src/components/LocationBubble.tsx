import { MapPin } from "lucide-react";
import { parseLocation, mapsUrl } from "@/lib/location";

const ZOOM = 15;
const W = 240;
const H = 150;

/** A little map card for a shared location: a 3×3 mosaic of free CARTO tiles
 *  centred on the point, with a pin. Tap to open directions. No API key, no
 *  map library instance per message. */
export function LocationBubble({ message, className }: { message: string; className?: string }) {
  const pos = parseLocation(message);
  if (!pos) return <p className="text-sm text-gray-500">📍 Location</p>;

  const n = 2 ** ZOOM;
  const latRad = (pos.lat * Math.PI) / 180;
  const x = ((pos.lng + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const left = W / 2 - (256 + (x - tx) * 256);
  const top = H / 2 - (256 + (y - ty) * 256);

  const tiles: { key: string; src: string; col: number; row: number }[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      tiles.push({
        key: `${col}-${row}`,
        col,
        row,
        src: `https://a.basemaps.cartocdn.com/rastertiles/voyager/${ZOOM}/${tx - 1 + col}/${ty - 1 + row}.png`,
      });
    }
  }

  return (
    <a
      href={mapsUrl(pos)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`block rounded-2xl overflow-hidden border border-black/10 bg-gray-100 ${className ?? ""}`}
      style={{ width: W }}
    >
      <div className="relative overflow-hidden" style={{ width: W, height: H }}>
        <div className="absolute" style={{ left, top, width: 768, height: 768 }}>
          {tiles.map((t) => (
            <img
              key={t.key}
              src={t.src}
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{ left: t.col * 256, top: t.row * 256, width: 256, height: 256 }}
            />
          ))}
        </div>
        <MapPin
          className="absolute text-red-500 drop-shadow"
          style={{ left: W / 2 - 14, top: H / 2 - 28, width: 28, height: 28 }}
          fill="currentColor"
          stroke="white"
          strokeWidth={1.5}
        />
        <span className="absolute bottom-0.5 right-1 text-[8px] text-gray-600/80">© OpenStreetMap © CARTO</span>
      </div>
      <div className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white/90">📍 Shared location · Tap for directions</div>
    </a>
  );
}
