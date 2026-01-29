// Force sync - Jan 17, 2026
import * as React from "react";
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
import Auth from "./pages/Auth";
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

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <CityProvider>
              <VenueProvider>
                <TooltipProvider>
                  {/* Toast notifications disabled */}
                <BrowserRouter>
                  <ReferralTracker />
                  <Routes>
                    <Route path="/*" element={<IOSAppLayout />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/welcome" element={<Welcome />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/community-guidelines" element={<CommunityGuidelines />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />
                    <Route path="/subscription-success" element={<SubscriptionSuccess />} />
                    <Route path="/admin" element={<Admin />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
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

export default App;
