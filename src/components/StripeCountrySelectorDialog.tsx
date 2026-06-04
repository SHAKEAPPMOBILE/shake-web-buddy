import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, AlertTriangle, ChevronDown, Check } from "lucide-react";

const PAYOUT_COUNTRIES = [
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BR", name: "Brazil" },
  { code: "BG", name: "Bulgaria" },
  { code: "CA", name: "Canada" },
  { code: "HR", name: "Croatia" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" },
  { code: "GI", name: "Gibraltar" },
  { code: "GR", name: "Greece" },
  { code: "HK", name: "Hong Kong" },
  { code: "HU", name: "Hungary" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "KE", name: "Kenya" },
  { code: "LV", name: "Latvia" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MY", name: "Malaysia" },
  { code: "MT", name: "Malta" },
  { code: "MX", name: "Mexico" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NG", name: "Nigeria" },
  { code: "NO", name: "Norway" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "SG", name: "Singapore" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "ZA", name: "South Africa" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "TH", name: "Thailand" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" },
  { code: "CR", name: "Costa Rica" },
  { code: "CO", name: "Colombia" },
];

interface StripeCountrySelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCountry: (countryCode: string) => void;
  isLoading: boolean;
  isReset?: boolean;
}

export function StripeCountrySelectorDialog({
  open,
  onOpenChange,
  onSelectCountry,
  isLoading,
  isReset = false,
}: StripeCountrySelectorDialogProps) {
  const { t } = useTranslation();
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [showCountryList, setShowCountryList] = useState(false);

  const selectedCountry = PAYOUT_COUNTRIES.find(c => c.code === selectedCode);

  const handleContinue = () => {
    console.log('[Stripe] handleContinue - selectedCode:', selectedCode);
    if (selectedCode) {
      console.log('[Stripe] calling onSelectCountry with:', selectedCode);
      onSelectCountry(selectedCode);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-white">
        <DialogHeader>
          <DialogTitle className="text-gray-900">
            {isReset
              ? t('stripe.resetTitle', 'Reset Payout Account')
              : t('stripe.selectCountryTitle', 'Select Your Country')}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {isReset
              ? t('stripe.resetDescription', 'Your existing account will be deleted. Select the correct country for your new payout account.')
              : t('stripe.selectCountryDescription', 'Choose the country where you have a bank account to receive payouts.')}
          </DialogDescription>
        </DialogHeader>

        {isReset && (
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-600">
              {t('stripe.resetWarning', 'This will delete your current Stripe Connect account and create a new one. You\'ll need to complete verification again.')}
            </p>
          </div>
        )}

        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium text-gray-900 mb-2 block">
              {t('stripe.countryLabel', 'Payout Country')}
            </label>

            {/* Custom inline country selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCountryList(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm hover:border-gray-400 transition-colors"
              >
                <span className={selectedCountry ? "text-gray-900" : "text-gray-400"}>
                  {selectedCountry ? selectedCountry.name : t('stripe.selectCountryPlaceholder', 'Select your country')}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showCountryList ? "rotate-180" : ""}`} />
              </button>

              {showCountryList && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  <div className="max-h-52 overflow-y-auto">
                    {PAYOUT_COUNTRIES.map(country => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => {
                          setSelectedCode(country.code);
                          setShowCountryList(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-900 hover:bg-gray-50 transition-colors"
                      >
                        <span>{country.name}</span>
                        {selectedCode === country.code && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleContinue}
            disabled={!selectedCode || isLoading}
            className="w-full py-3 text-sm font-medium text-white bg-primary rounded-2xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('stripe.connecting', 'Connecting...')}
              </>
            ) : (
              t('stripe.continueToStripe', 'Continue to Stripe')
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
