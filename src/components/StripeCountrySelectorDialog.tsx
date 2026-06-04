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
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "PT", name: "Portugal" },
  { code: "ES", name: "Spain" },
  { code: "CO", name: "Colombia" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "CR", name: "Costa Rica" },
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
    if (selectedCode) {
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
