// Force sync - Jan 17, 2026
import * as React from "react";
import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CityProvider } from "@/contexts/CityContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { VenueProvider } from "@/contexts/VenueContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { IOSAppLayout } from "@/components/IOSAppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useReferralTracking } from "@/hooks/useReferralTracking";
import { initializeRevenueCat } from "./lib/revenuecat";
import Auth from "./pages/Auth";
import OAuthCallback from "./pages/OAuthCallback";
import Profile from "./pages/Profile";
import CommunityGuidelines from "./pages/CommunityGuidelines";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import NotFound from "./pages/NotFound";
import Welcome from "./pages/Welcome";
import Admin from "./pages/Admin";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import ProposePlanPage from "./pages/ProposePlanPage";
import EventChatPage from "./pages/EventChatPage";
import ShareLanding from "./pages/ShareLanding";
import GuestPlanPage from "./pages/GuestPlanPage";

const queryClient = new QueryClient();

// Referral code pattern — same regex as useReferralTracking
const REFERRAL_CODE_RE = /^[a-z0-9]+-[a-z0-9]+$/i;

const KNOWN_ROUTES = new Set([
  "auth", "profile", "admin", "welcome",
  "privacy-policy", "terms-of-service", "community-guidelines",
  "subscription-success", "propose-plan", "plans",
  "chat", "events", "home", "invite", "guest", "",
]);

// Component to track referral codes from URLs.
// When a visitor lands on /<referral-code> (e.g. /eonel-f50), store the code
// and immediately redirect to / so the app renders at a clean path.
function ReferralTracker() {
  useReferralTracking();
  const navigate = useNavigate();

  useEffect(() => {
    const path = window.location.pathname;
    const segment = path.slice(1).split("/")[0]; // first path segment only

    if (
      segment &&
      !KNOWN_ROUTES.has(segment) &&
      REFERRAL_CODE_RE.test(segment)
    ) {
      // Code was already stored by useReferralTracking; redirect to home
      console.log("[ReferralTracker] referral path detected, redirecting to /", segment);
      navigate("/", { replace: true });
    }
  }, [navigate]);

  return null;
}

const App = () => {
  // Initialize RevenueCat on app load
  useEffect(() => {
    initializeRevenueCat();
  }, []);

  // Handle deep links (Universal Links, App Links, and the OAuth custom
  // scheme) by hard-navigating the WebView to the same path/query/hash the
  // link carried, instead of re-verifying the auth payload here. This used
  // to reimplement its own cruder version of OAuthCallback.tsx's logic —
  // always verifying token_hash as type "email" regardless of what the link
  // actually was, never handling ?intent=signup (skipping the "create a
  // password" step for every native signup), and navigating home before the
  // profile row was ready. Routing through the real /auth/callback route
  // reuses that already-correct, single implementation for every platform.
  useEffect(() => {
    const handlerPromise = CapacitorApp.addListener('appUrlOpen', async (event) => {
      try {
        const url = event.url;
        console.log('Deep link received:', url);
        if (!url) return;

        const parsed = new URL(url);
        // A custom scheme (com.shakeapp.shakeapp://auth/callback) parses
        // its first path segment as the URL's host, not as part of the
        // pathname — unlike a real https:// Universal Link, where it's
        // already part of the pathname.
        const isCustomScheme = !parsed.protocol.startsWith('http');
        const path = isCustomScheme ? `/${parsed.host}${parsed.pathname}` : parsed.pathname;

        await Browser.close().catch(() => {});
        window.location.href = path + parsed.search + parsed.hash;
      } catch (err) {
        console.error('Error handling deep link', err);
      }
    });

    return () => {
      // remove listener promise when component unmounts
      try {
        handlerPromise.then((h: any) => h?.remove && h.remove()).catch(() => {});
      } catch (e) {
        // ignore
      }
    };
  }, []);

  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <CityProvider>
              <VenueProvider>
                <TooltipProvider>
                  <NotificationProvider>
                  <Toaster />
                <BrowserRouter>
                  <ReferralTracker />
                  <Routes>
                    <Route path="/auth/callback" element={<OAuthCallback />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/welcome" element={<Welcome />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/community-guidelines" element={<CommunityGuidelines />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />
                    <Route path="/subscription-success" element={<SubscriptionSuccess />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/propose-plan" element={<ProposePlanPage />} />
                    <Route path="/chat/event/:eventId" element={<EventChatPage />} />
                    <Route path="/invite/:activityId" element={<ShareLanding />} />
                    <Route path="/guest/:token" element={<GuestPlanPage />} />
                    <Route path="/*" element={<IOSAppLayout />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
                  </NotificationProvider>
              </TooltipProvider>
            </VenueProvider>
          </CityProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
