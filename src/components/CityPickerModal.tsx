import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type CityPickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
};

/**
 * Responsive city picker shell: bottom sheet on mobile, centered modal on desktop.
 */
export function CityPickerModal({ open, onOpenChange, title = "Choose your city", children }: CityPickerModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          hideClose
          overlayClassName="bg-black/50 backdrop-blur-md"
          className={cn(
            "flex max-h-[75vh] flex-col gap-0 overflow-hidden rounded-xl-[20px] border border-gray-200 bg-white p-0 pb-[env(safe-area-inset-bottom)] shadow-2xl",
          )}
        >
          {/* Drag handle */}
          <div className="flex shrink-0 justify-center pt-3 pb-1" aria-hidden>
            <div className="h-1.5 w-10 rounded-full bg-gray-300" />
          </div>

          {/* Title + close */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 pb-3 pt-1">
            <SheetTitle className="font-display text-left text-lg font-semibold leading-tight text-gray-900">
              {title}
            </SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Pinned chrome + scrollable list (CityPickerBody) */}
          <div className="flex min-h-0 flex-1 flex-col px-4 pt-3">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-black/55 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        className={cn(
          "flex max-h-[min(600px,90vh)] w-[min(100vw-1.5rem,480px)] flex-col gap-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl",
          "[&>button.dialog-close]:hidden",
        )}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b border-gray-200 px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="font-display text-lg font-semibold leading-tight text-gray-900">{title}</DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
