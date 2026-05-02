import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { startOfDay, format, isToday, isTomorrow } from "date-fns";
import { Plus, User, Shield } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useUserActivities } from "@/hooks/useUserActivities";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { PremiumDialog } from "@/components/PremiumDialog";
import { SuperHumanIcon } from "@/components/SuperHumanIcon";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { detectActivityFromText } from "@/lib/activityDetection";
import { checkProfanity } from "@/lib/profanity-filter";
import { useStripeConnect } from "@/hooks/useStripeConnect";
import { usePayPalConnect } from "@/hooks/usePayPalConnect";
import { useCreatorVerification } from "@/hooks/useCreatorVerification";
import { supabase } from "@/integrations/supabase/client";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { StripeCountrySelectorDialog } from "@/components/StripeCountrySelectorDialog";
import { PayPalConnectDialog } from "@/components/PayPalConnectDialog";
import { IDVerificationDialog } from "@/components/IDVerificationDialog";
import { MinimalBackButton } from "@/components/MinimalBackButton";
import { useTranslation } from "react-i18next";

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
];

const MAX_CHARACTERS = 50;

export default function ProposePlanPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isPremium } = useAuth();
  const { selectedCity } = useCity();
  const city = selectedCity ?? "";

  const { createActivity, isLoading, remainingActivities, fetchMyActivities } = useUserActivities(city);

  const [planText, setPlanText] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("USD");
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [showStripeCountrySelector, setShowStripeCountrySelector] = useState(false);
  const [showPayPalDialog, setShowPayPalDialog] = useState(false);
  const [showIDVerification, setShowIDVerification] = useState(false);
  const [profanityError, setProfanityError] = useState<string | null>(null);
  const [dayLimitError, setDayLimitError] = useState(false);

  const { isConnected: stripeConnected, status: connectStatus, startOnboarding, isLoading: connectLoading } = useStripeConnect();
  const { isConnected: paypalConnected, connectPayPal, isLoading: paypalLoading } = usePayPalConnect();
  const { isVerified, isPending: isVerificationPending } = useCreatorVerification();

  useEffect(() => {
    if (user) {
      fetchMyActivities();
    }
  }, [user, fetchMyActivities]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id as any)
        .maybeSingle();
      if (data) {
        setUserAvatarUrl((data as any).avatar_url);
      }
    };
    fetchUserProfile();
  }, [user]);

  const canCreate = remainingActivities > 0;
  const today = startOfDay(new Date());

  const detectedActivity = useMemo(() => {
    if (!planText.trim()) return null;
    return detectActivityFromText(planText);
  }, [planText]);

  const hasProfanity = useMemo(() => {
    if (!planText.trim()) return false;
    return checkProfanity(planText).hasProfanity;
  }, [planText]);

  const isPaidActivity = priceAmount.trim().length > 0;
  const isValid = planText.trim().length > 0 && !hasProfanity;
  const hasPayoutMethod = (stripeConnected && connectStatus === "complete") || paypalConnected;
  const needsPayoutSetup = isPaidActivity && !hasPayoutMethod;

  const handleStartOnboardingWithCountry = (countryCode: string) => {
    setShowStripeCountrySelector(false);
    startOnboarding(countryCode);
  };

  const handleCreate = async () => {
    if (!isValid || !detectedActivity) return;

    if (isPaidActivity && !isVerified && !isVerificationPending) {
      setShowIDVerification(true);
      return;
    }

    if (priceAmount.trim() && !hasPayoutMethod) {
      setShowStripeCountrySelector(true);
      return;
    }

    const selectedCurrency = CURRENCIES.find((c) => c.code === priceCurrency);
    const formattedPrice = priceAmount.trim()
      ? `${selectedCurrency?.symbol || "$"}${priceAmount.trim()} ${priceCurrency}`
      : undefined;

    const activityDate = selectedDate;
    const endOfSelectedDay = new Date(selectedDate);
    endOfSelectedDay.setHours(23, 59, 59, 999);

    const success = await createActivity(
      detectedActivity.type,
      activityDate,
      planText.trim(),
      undefined,
      formattedPrice,
      endOfSelectedDay
    );

    if (!success) {
      setDayLimitError(true);
      return;
    }
    triggerConfettiWaterfall();
    navigate(-1);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setDayLimitError(false);
    if (text.length <= MAX_CHARACTERS) {
      setPlanText(text);
      const result = checkProfanity(text);
      setProfanityError(result.hasProfanity ? t("createPlan.profanityWarning") : null);
    }
  };

  const selectedCurrencySymbol = CURRENCIES.find((c) => c.code === priceCurrency)?.symbol || "$";

  return (
    <div className="min-h-screen bg-background pb-[env(safe-area-inset-bottom,0px)]">
      <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur px-4 py-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] flex items-center gap-2">
        <MinimalBackButton
          onClick={() => navigate(-1)}
          className="text-foreground/80 hover:text-foreground"
          aria-label="Back"
        />
        <h1 className="text-lg font-display font-semibold">{t("createPlan.title")}</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5">
        <p className="text-center text-sm text-muted-foreground mb-4">
          {isPremium ? (
            <span className="text-shake-yellow">{t("createPlan.unlimitedPlans")}</span>
          ) : canCreate ? (
            <>{t("createPlan.freePlansLeft", { count: remainingActivities })}</>
          ) : null}
        </p>

        {!user ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">{t("createPlan.signInToCreate")}</p>
          </div>
        ) : !canCreate ? (
          <div className="text-center py-8 space-y-4">
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.6), rgba(67, 56, 202, 0.5))",
              }}
            >
              <SuperHumanIcon size={32} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{t("createPlan.usedFreePlanTitle")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("createPlan.becomeForUnlimited")}</p>
            </div>
            <button
              onClick={() => setShowPremiumDialog(true)}
              className="px-4 py-2 rounded-full font-medium text-white hover:opacity-90 transition-all flex items-center gap-2 mx-auto"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
              }}
            >
              <SuperHumanIcon size={16} />
              {t("premium.becomeSuperHuman")}
            </button>
          </div>
        ) : (
          <div className="space-y-6 py-1">
            <div className="space-y-3">
              <div className="relative">
                {dayLimitError ? (
                  <div className="min-h-[100px] rounded-md border border-input bg-background px-3 py-2">
                    <p className="text-red-400 text-base text-left">Slow down tiger, one plan a day keeps the chaos away! 🐯</p>
                  </div>
                ) : (
                  <>
                    <Textarea
                      value={planText}
                      onChange={handleTextChange}
                      placeholder={t("createPlan.placeholder")}
                      maxLength={MAX_CHARACTERS}
                      className="min-h-[100px] resize-none pr-16 text-base border-blue-300 focus-visible:ring-blue-400 focus-visible:border-blue-400"
                      autoFocus
                    />
                    <span className="absolute right-3 bottom-3 text-xs text-muted-foreground">
                      {planText.length}/{MAX_CHARACTERS}
                    </span>
                  </>
                )}
              </div>

              {profanityError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-destructive" />
                  {profanityError}
                </p>
              )}
            </div>

            {/* Date picker pills */}
            {(() => {
              const todayDow = today.getDay(); // 0=Sun, 1=Mon ... 5=Fri, 6=Sat
              const tomorrow = new Date(today);
              tomorrow.setDate(today.getDate() + 1);
              // Returns the date of the upcoming `dow` weekday, or null if today IS that day.
              const getWeekendDate = (dow: number): Date | null => {
                const daysUntil = (dow - todayDow + 7) % 7;
                if (daysUntil <= 1) return null; // today or tomorrow — skip
                const d = new Date(today);
                d.setDate(today.getDate() + daysUntil);
                return d;
              };

              const friDate = getWeekendDate(5);
              const satDate = getWeekendDate(6);
              const sunDate = getWeekendDate(0);

              const pills: { label: string; date: Date }[] = [
                { label: "Today", date: today },
                { label: "Tomorrow", date: tomorrow },
                ...(friDate ? [{ label: "This Friday", date: friDate }] : []),
                ...(satDate ? [{ label: "This Saturday", date: satDate }] : []),
                ...(sunDate ? [{ label: "This Sunday", date: sunDate }] : []),
              ];

              return (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">When?</label>
                  <div className="flex gap-2 flex-wrap">
                    {pills.map(({ label, date }) => {
                      const isSelected = format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setSelectedDate(date)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-foreground border-border hover:border-primary/50"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t("createPlan.setPrice")}</label>
              <div className="flex gap-2">
                <Select value={priceCurrency} onValueChange={setPriceCurrency}>
                  <SelectTrigger className="w-24 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.symbol} {currency.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                  placeholder={t("createPlan.amountPlaceholder")}
                  className="flex-1"
                />
              </div>

              {priceAmount.trim() && (
                <div className="space-y-2">
                  {isVerified ? (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {t("createPlan.idVerified")}
                    </p>
                  ) : isVerificationPending ? (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {t("createPlan.idPending")}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowIDVerification(true)}
                      className="text-xs text-amber-600 flex items-center gap-1 hover:text-amber-700"
                    >
                      <Shield className="w-3 h-3" />
                      {t("createPlan.idRequired")}
                    </button>
                  )}
                </div>
              )}

              {priceAmount.trim() && !hasPayoutMethod && (
                <div className="text-xs text-amber-600 space-y-1">
                  <p>{t("createPlan.connectPayout")}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowStripeCountrySelector(true)}
                      className="underline hover:text-amber-700 font-medium"
                    >
                      Stripe
                    </button>
                    <span>{t("common.or")}</span>
                    <button
                      type="button"
                      onClick={() => setShowPayPalDialog(true)}
                      className="underline hover:text-amber-700 font-medium"
                    >
                      PayPal
                    </button>
                  </div>
                </div>
              )}

              {priceAmount.trim() && hasPayoutMethod && (
                <p className="text-xs text-green-600">
                  {t("createPlan.payoutConnected", { method: paypalConnected ? "PayPal" : "Stripe" })}
                </p>
              )}

            </div>

            {planText.trim() && (
              <div className="p-4 rounded-xl space-y-2 bg-muted/50">
                <p className="text-sm font-medium text-foreground">{t("createPlan.preview")}</p>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {userAvatarUrl ? (
                      <img
                        src={getDisplayAvatarUrl(userAvatarUrl) ?? userAvatarUrl}
                        alt="Your avatar"
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <User className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">"{planText.trim()}"</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{city} • {isToday(selectedDate) ? t("common.today") : isTomorrow(selectedDate) ? t("common.tomorrow") : format(selectedDate, "EEE, MMM d")}</span>
                      {priceAmount.trim() && (
                        <span className="text-green-600 font-medium">
                          {selectedCurrencySymbol}{priceAmount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={!isValid || isLoading || connectLoading}
              className="w-full py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
              }}
            >
              {isLoading || connectLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                  {connectLoading ? t("createPlan.checkingPayment") : t("createPlan.creating")}
                </span>
              ) : needsPayoutSetup ? (
                t("createPlan.setupPayments")
              ) : (
                <span className="inline-flex items-center gap-2 justify-center">
                  <Plus className="w-4 h-4" />
                  {t("createPlan.createBtn")}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />

      <StripeCountrySelectorDialog
        open={showStripeCountrySelector}
        onOpenChange={setShowStripeCountrySelector}
        onSelectCountry={handleStartOnboardingWithCountry}
        isLoading={connectLoading}
        isReset={false}
      />

      <PayPalConnectDialog
        open={showPayPalDialog}
        onOpenChange={setShowPayPalDialog}
        onConnect={connectPayPal}
        isLoading={paypalLoading}
      />

      <IDVerificationDialog
        open={showIDVerification}
        onOpenChange={setShowIDVerification}
        onVerificationComplete={() => {}}
      />
    </div>
  );
}
