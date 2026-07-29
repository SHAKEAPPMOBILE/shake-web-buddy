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
import { toast } from "@/lib/app-toast";
import Auth from "./pages/Auth";
import OAuthCallback from "./pages/OAuthCallback";
import { supabase } from "@/integrations/supabase/client";
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

const queryClient = new QueryClient();

// Referral code pattern — same regex as useReferralTracking
const REFERRAL_CODE_RE = /^[a-z0-9]+-[a-z0-9]+$/i;

const KNOWN_ROUTES = new Set([
  "auth", "profile", "admin", "welcome",
  "privacy-policy", "terms-of-service", "community-guidelines",
  "subscription-success", "propose-plan", "plans",
  "chat", "events", "home", "invite", "",
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

  // Handle deep link callbacks from OAuth redirects
  useEffect(() => {
    const handlerPromise = CapacitorApp.addListener('appUrlOpen', async (event) => {
      try {
        const url = event.url;
        console.log('Deep link received:', url);

        if (!url) return;

        // Parse the URL for auth tokens (either query params or hash fragment)
        let code: string | null = null;
        let tokenHash: string | null = null;
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        try {
          const parsed = new URL(url);
          code = parsed.searchParams.get('code');
          tokenHash = parsed.searchParams.get('token_hash');
          accessToken = parsed.searchParams.get('access_token');
          refreshToken = parsed.searchParams.get('refresh_token');

          if ((!accessToken || !refreshToken || !code || !tokenHash) && parsed.hash) {
            const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
            code = code || hashParams.get('code');
            tokenHash = tokenHash || hashParams.get('token_hash');
            accessToken = accessToken || hashParams.get('access_token');
            refreshToken = refreshToken || hashParams.get('refresh_token');
          }
        } catch (e) {
          console.warn('Failed to parse deep link URL', e);
        }

        if (code) {
          console.log('Exchanging deep-link OAuth code for session');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('Failed to exchange OAuth code from deep link', error);
            toast.error('Sign-in failed. Please try again.');
            await Browser.close().catch(() => {});
            return;
          }
        } else if (accessToken && refreshToken) {
          console.log('Setting Supabase session from deep link');
          // @ts-ignore - setSession exists on the auth client
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) {
            console.error('Failed to set Supabase session from deep link tokens', error);
            toast.error('Sign-in failed. Please try again.');
            await Browser.close().catch(() => {});
            return;
          }
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "email",
          });
          if (error) {
            console.error('Failed to verify token_hash from deep link', error);
            toast.error('Sign-in failed. Please try again.');
            await Browser.close().catch(() => {});
            return;
          }
        } else {
          console.log('No recognizable auth payload found on deep link');

          // If this is a share/invite link, force a full navigation to the invite URL.
          // window.history.pushState doesn't work when the app is on auth/welcome screen,
          // so we use window.location.href to force a clean load of the ShareLanding page.
          try {
            const parsed = new URL(url);
            if (parsed.pathname.startsWith('/invite/')) {
              console.log('[DeepLink] invite path detected, navigating to', parsed.pathname);
              await Browser.close().catch(() => {});
              window.location.href = `https://www.shakeapp.today${parsed.pathname}`;
              return;
            }
          } catch {}

          await Browser.close().catch(() => {});
          return;
        }

        // Auth exchange succeeded — return to the app shell.
        window.history.replaceState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
        await Browser.close().catch(() => {});
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
