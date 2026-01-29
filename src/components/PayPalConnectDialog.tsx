import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, Check } from "lucide-react";

interface PayPalConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (email: string) => Promise<boolean>;
  isLoading: boolean;
}

export function PayPalConnectDialog({
  open,
  onOpenChange,
  onConnect,
  isLoading,
}: PayPalConnectDialogProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const emailsMatch = email === confirmEmail;
  const isValid = isValidEmail(email) && emailsMatch;

  const handleConnect = async () => {
    if (!isValid) return;
    
    setError(null);
    const success = await onConnect(email);
    
    if (success) {
      setEmail("");
      setConfirmEmail("");
      onOpenChange(false);
    } else {
      setError(t('paypal.connectError', 'Failed to connect PayPal. Please try again.'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#0070BA] rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">PP</span>
            </div>
            {t('paypal.connectTitle', 'Connect PayPal')}
          </DialogTitle>
          <DialogDescription>
            {t('paypal.connectDescription', 'Enter your PayPal email to receive payouts. You\'ll receive 90% of each payment.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t('paypal.emailLabel', 'PayPal Email')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="your@paypal.email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              {t('paypal.confirmEmailLabel', 'Confirm Email')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="your@paypal.email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                className="pl-10"
              />
              {confirmEmail && emailsMatch && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-shake-green" />
              )}
            </div>
            {confirmEmail && !emailsMatch && (
              <p className="text-xs text-destructive mt-1">
                {t('paypal.emailMismatch', 'Emails do not match')}
              </p>
            )}
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <button
            onClick={handleConnect}
            disabled={!isValid || isLoading}
            className="w-full py-3 text-sm font-medium text-white bg-[#0070BA] rounded-lg hover:bg-[#005ea6] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('paypal.connecting', 'Connecting...')}
              </>
            ) : (
              t('paypal.connectButton', 'Connect PayPal Account')
            )}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            {t('paypal.securityNote', 'Your PayPal email is stored securely and only used to send you payouts.')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
