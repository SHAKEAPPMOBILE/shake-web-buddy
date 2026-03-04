// Force sync - Jan 17, 2026
import * as React from "react";
import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import { supabase } from "@/integrations/supabase/client";
import Profile from "./pages/Profile";
import CommunityGuidelines from "./pages/CommunityGuidelines";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import NotFound from "./pages/NotFound";
import Welcome from "./pages/Welcome";
import Admin from "./pages/Admin";

const queryClient = new QueryClient();

// Component to track referral codes from URLs
function ReferralTracker() {
  useReferralTracking();
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
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        try {
          const parsed = new URL(url);
          accessToken = parsed.searchParams.get('access_token');
          refreshToken = parsed.searchParams.get('refresh_token');

          if ((!accessToken || !refreshToken) && parsed.hash) {
            const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
            accessToken = accessToken || hashParams.get('access_token');
            refreshToken = refreshToken || hashParams.get('refresh_token');
          }
        } catch (e) {
          console.warn('Failed to parse deep link URL', e);
        }

        if (accessToken && refreshToken) {
          console.log('Setting Supabase session from deep link');
          // @ts-ignore - setSession exists on the auth client
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        } else {
          console.log('No session tokens found on deep link');
        }
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
                  <Toaster />
                  <Sonner />
                <BrowserRouter>
                  <ReferralTracker />
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/auth/callback" element={<OAuthCallback />} />
                    <Route path="/welcome" element={<Welcome />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/community-guidelines" element={<CommunityGuidelines />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />
                    <Route path="/subscription-success" element={<SubscriptionSuccess />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/*" element={<IOSAppLayout />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
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
