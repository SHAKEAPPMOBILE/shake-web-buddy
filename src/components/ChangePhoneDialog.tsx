import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isAfricanCountry, getSmsAvailabilityMessage } from "@/data/smsEnabledCountries";
import { countryCodes } from "@/data/countryCodes";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+\d{7,15}$/, { message: "Use E.164 format, e.g. +351912345678" });

const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, { message: "Enter the 6-digit code" });

// Helper to detect country from phone number
function detectCountryFromPhone(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return null;
  
  // Sort by dial code length (longest first) to match more specific codes first
  const sortedCodes = [...countryCodes].sort((a, b) => 
    b.dialCode.length - a.dialCode.length
  );
  
  for (const country of sortedCodes) {
    const dialDigits = country.dialCode.replace(/\D/g, '');
    if (cleaned.startsWith(dialDigits)) {
      return country.code;
    }
  }
  return null;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPhone: string | null;
  onPhoneUpdated: (phone: string) => void;
};

export function ChangePhoneDialog({ open, onOpenChange, currentPhone, onPhoneUpdated }: Props) {
  const [step, setStep] = useState<"enter" | "verify">("enter");
  const [phone, setPhone] = useState<string>(currentPhone ?? "");
  const [code, setCode] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const title = useMemo(() => (currentPhone ? "Change phone number" : "Add phone number"), [currentPhone]);

  useEffect(() => {
    if (!open) return;
    // reset each time dialog opens
    setStep("enter");
    setPhone(currentPhone ?? "");
    setCode("");
    setIsSending(false);
    setIsVerifying(false);
    setResendCountdown(0);
  }, [open, currentPhone]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handleSendCode = async () => {
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid phone number");
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke("request-phone-change", {
        body: { phone: parsed.data },
      });

      if (error) {
        toast.error(error.message || "Failed to send code");
        return;
      }

      toast.success("Verification code sent!");
      setResendCountdown(60);
      setStep("verify");
    } catch {
      toast.error("Failed to send code");
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    const p = phoneSchema.safeParse(phone);
    if (!p.success) {
      toast.error(p.error.issues[0]?.message ?? "Invalid phone number");
      return;
    }

    const c = otpSchema.safeParse(code);
    if (!c.success) {
      toast.error(c.error.issues[0]?.message ?? "Invalid code");
      return;
    }

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-phone-change", {
        body: { phone: p.data, code: c.data },
      });

      if (error) {
        toast.error(error.message || "Verification failed");
        return;
      }

      const updatedPhone = (data as any)?.phone ?? p.data;
      onPhoneUpdated(updatedPhone);
      onOpenChange(false);
    } catch {
      toast.error("Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-phone">Phone (E.164)</Label>
            <Input
              id="new-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+351912345678"
              autoComplete="tel"
            />
            <p className="text-xs text-muted-foreground">
              Include country code. Example: +351…, +1…, +44…
            </p>
            {(() => {
              const detectedCountry = detectCountryFromPhone(phone);
              const message = detectedCountry ? getSmsAvailabilityMessage(detectedCountry) : null;
              if (message) {
                return (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
                    ⚠️ {message}
                  </p>
                );
              }
              return null;
            })()}
          </div>

          {step === "verify" && (
            <div className="space-y-2">
              <Label>Verification code</Label>
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              <p className="text-xs text-muted-foreground">Code expires in 10 minutes.</p>
            </div>
          )}

          <div className="flex gap-2">
            {step === "enter" ? (
              <Button className="w-full" onClick={handleSendCode} disabled={isSending}>
                {isSending ? "Sending…" : "Send code"}
              </Button>
            ) : (
              <>
                <Button className="flex-1" onClick={handleVerify} disabled={isVerifying}>
                  {isVerifying ? "Verifying…" : "Verify & save"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={handleSendCode}
                  disabled={isSending || resendCountdown > 0}
                >
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : isSending ? "Sending…" : "Resend"}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
