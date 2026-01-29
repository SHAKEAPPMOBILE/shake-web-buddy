import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NationalitySelector } from "@/components/NationalitySelector";
import { countryCodes } from "@/data/countryCodes";
import { Loader2, AlertTriangle } from "lucide-react";

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
  const [selectedCountry, setSelectedCountry] = useState<string>("");

  // Find the ISO code from the country name
  const getCountryCode = (countryName: string): string | null => {
    const country = countryCodes.find(c => c.name === countryName);
    return country?.code || null;
  };

  const handleContinue = () => {
    const countryCode = getCountryCode(selectedCountry);
    if (countryCode) {
      onSelectCountry(countryCode);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isReset 
              ? t('stripe.resetTitle', 'Reset Payout Account') 
              : t('stripe.selectCountryTitle', 'Select Your Country')}
          </DialogTitle>
          <DialogDescription>
            {isReset
              ? t('stripe.resetDescription', 'Your existing account will be deleted. Select the correct country for your new payout account.')
              : t('stripe.selectCountryDescription', 'Choose the country where you have a bank account to receive payouts.')}
          </DialogDescription>
        </DialogHeader>

        {isReset && (
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-600">
              {t('stripe.resetWarning', 'This will delete your current Stripe Connect account and create a new one. You\'ll need to complete verification again.')}
            </p>
          </div>
        )}

        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t('stripe.countryLabel', 'Payout Country')}
            </label>
            <NationalitySelector
              value={selectedCountry}
              onChange={setSelectedCountry}
              placeholder={t('stripe.selectCountryPlaceholder', 'Select your country')}
            />
          </div>

          <button
            onClick={handleContinue}
            disabled={!selectedCountry || isLoading}
            className="w-full py-3 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
