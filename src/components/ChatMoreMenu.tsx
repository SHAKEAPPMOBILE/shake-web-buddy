import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export interface ChatMoreMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

/** ⋮ trigger + portaled dropdown, for chat headers that don't have their own
 *  options menu. Portaled and positioned from the trigger's rect so it's never
 *  clipped by a curtain header's overflow. */
export function ChatMoreMenu({ items, triggerClassName = "p-2 rounded-full hover:bg-black/10 transition-colors", iconClassName = "w-5 h-5 text-gray-700" }: {
  items: ChatMoreMenuItem[];
  triggerClassName?: string;
  iconClassName?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  return (
    <>
      <button ref={ref} type="button" onClick={toggle} className={triggerClassName} aria-label="More options">
        <MoreVertical className={iconClassName} />
      </button>
      {pos && createPortal(
        <>
          <div className="fixed inset-0 z-[10040]" onClick={(e) => { e.stopPropagation(); setPos(null); }} />
          <div
            className="fixed w-52 bg-white rounded-xl shadow-lg border border-black/10 z-[10050] overflow-hidden"
            style={{ top: pos.top, right: pos.right }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={(e) => { e.stopPropagation(); setPos(null); item.onSelect(); }}
                className={`flex items-center gap-2 w-full px-4 py-3 text-sm transition-colors ${item.danger ? "text-red-600 hover:bg-red-50" : "text-gray-800 hover:bg-gray-100"}`}
              >
                {item.icon}{item.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
