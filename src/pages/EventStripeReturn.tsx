import { useLayoutEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { LoadingSpinner } from "@/components/LoadingSpinner";

/**
 * Stripe success/cancel URLs land here first; we immediately replace to /events?…
 * so the checkout session entry is not left behind the events list in history.
 */
export default function EventStripeReturn() {
  const [searchParams] = useSearchParams();

  useLayoutEffect(() => {
    const qs = searchParams.toString();
    const target = qs ? `/events?${qs}` : "/events";
    window.location.replace(target);
  }, [searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <LoadingSpinner size="lg" />
    </div>
  );
}
