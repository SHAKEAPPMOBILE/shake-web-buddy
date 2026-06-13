import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { startOfDay, format, isToday, isTomorrow } from "date-fns";
import { Plus, User, Calendar, Send } from "lucide-react";
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

type StepName = "name" | "city" | "date" | "time" | "price" | "preview";

const BOT_QUESTIONS: Record<StepName, string> = {
  name: "What's your plan? ✨",
  city: "Which city are you in? 📍",
  date: "When? 📅",
  time: "What time? ⏰",
  price: "Set a price? (optional) 💰",
  preview: "Here's your plan! Looking good? 👀",
};

function BotBubble({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg, rgba(88,28,135,0.9), rgba(67,56,202,0.8))" }}
      >
        🤝
      </div>
      <div className="max-w-[78%] rounded-2xl rounded-tl-none px-3.5 py-2.5 bg-muted text-foreground text-sm leading-relaxed">
        {message}
      </div>
    </div>
  );
}

function UserBubble({ message, onClick }: { message: string; onClick?: () => void }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onClick}
        title={onClick ? "Tap to edit" : undefined}
        className={cn(
          "max-w-[78%] rounded-2xl rounded-tr-none px-3.5 py-2.5 text-sm text-white text-left",
          onClick && "hover:opacity-80 active:opacity-70 transition-opacity cursor-pointer"
        )}
        style={{ background: "linear-gradient(135deg, rgba(88,28,135,0.85), rgba(67,56,202,0.75))" }}
      >
        {message}
      </button>
    </div>
  );
}

export default function ProposePlanPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isPremium } = useAuth();
  const { selectedCity } = useCity();
  const city = selectedCity ?? "";

  const { createActivity, isLoading, remainingActivities, fetchMyActivities } = useUserActivities(city);

  const [planText, setPlanText] = useState(() => {
    const now = new Date();
    const day = now.getDay();   // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    const hour = now.getHours();
    const isLate = hour > 19 || (hour === 19 && now.getMinutes() >= 15); // 19:15+
    if (day === 5) return isLate ? "brunch" : "dinner"; // Friday
    if (day === 6) return isLate ? "dinner" : "brunch"; // Saturday
    return "";                                           // Sun/Mon/other — no forced activity
  });
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
  const [cityInput, setCityInput] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedTime, setSelectedTime] = useState("20:00"); // default 8:00 PM
  const [pastTimeError, setPastTimeError] = useState(false);

  // Chat flow
  const [currentStep, setCurrentStep] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const cityInputElRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

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
  const effectiveCity = city || cityInput.trim();
  const isValid = planText.trim().length > 0 && !hasProfanity && effectiveCity.length > 0 && selectedTime.length > 0;

  // Combine the selected date + time for preview and submission
  const previewDateTime = useMemo(() => {
    const [h, m] = selectedTime.split(":").map(Number);
    const d = new Date(selectedDate);
    d.setHours(isNaN(h) ? 20 : h, isNaN(m) ? 0 : m, 0, 0);
    return d;
  }, [selectedDate, selectedTime]);

  const hasPayoutMethod = (stripeConnected && connectStatus === "complete") || paypalConnected;

  // Ordered chat steps — insert "city" only when context provides no city
  const steps: StepName[] = useMemo(() => {
    const s: StepName[] = ["name"];
    if (!city) s.push("city");
    s.push("date", "time", "price", "preview");
    return s;
  }, [city]);

  const currentStepName = steps[currentStep];

  // Auto-scroll to newest message
  useEffect(() => {
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 120);
    return () => clearTimeout(timer);
  }, [currentStep, showCalendar]);

  // Auto-focus composer input
  useEffect(() => {
    if (currentStepName === "name") nameInputRef.current?.focus();
    else if (currentStepName === "city") cityInputElRef.current?.focus();
    else if (currentStepName === "time") timeInputRef.current?.focus();
    else if (currentStepName === "price") priceInputRef.current?.focus();
  }, [currentStepName]);

  const selectedCurrencySymbol = CURRENCIES.find((c) => c.code === priceCurrency)?.symbol || "$";

  const getUserAnswer = (step: StepName): string => {
    switch (step) {
      case "name": return planText;
      case "city": return cityInput || city;
      case "date":
        return isToday(selectedDate)
          ? "Today"
          : isTomorrow(selectedDate)
          ? "Tomorrow"
          : format(selectedDate, "EEE, MMM d");
      case "time": return format(previewDateTime, "h:mm a");
      case "price":
        return priceAmount.trim()
          ? `${selectedCurrencySymbol}${priceAmount} ${priceCurrency}`
          : "Free 🎉";
      default: return "";
    }
  };

  const advanceStep = () =>
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));

  const jumpToStep = (stepIndex: number) => {
    setCurrentStep(stepIndex);
    setShowCalendar(false);
    setPastTimeError(false);
    setDayLimitError(false);
  };

  const handleNameSubmit = () => {
    if (!planText.trim() || hasProfanity) return;
    advanceStep();
  };

  const handleCitySubmit = () => {
    if (!cityInput.trim()) return;
    advanceStep();
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setShowCalendar(false);
    setPastTimeError(false);
    advanceStep();
  };

  const handleTimeSubmit = () => {
    if (!selectedTime) return;
    advanceStep();
  };

  const handlePriceSubmit = () => {
    advanceStep();
  };

  const handleSkipPrice = () => {
    setPriceAmount("");
    advanceStep();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setDayLimitError(false);
    if (text.length <= MAX_CHARACTERS) {
      setPlanText(text);
      const result = checkProfanity(text);
      setProfanityError(result.hasProfanity ? t("createPlan.profanityWarning") : null);
    }
  };

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

    // Build the full date+time from the two pickers
    const activityDate = previewDateTime;

    // Reject plans in the past — jump back to time step so user can fix
    if (activityDate < new Date()) {
      setPastTimeError(true);
      const timeIdx = steps.indexOf("time");
      if (timeIdx >= 0) jumpToStep(timeIdx);
      return;
    }
    setPastTimeError(false);

    const endOfSelectedDay = new Date(selectedDate);
    endOfSelectedDay.setHours(23, 59, 59, 999);

    const success = await createActivity(
      detectedActivity.type,
      activityDate,
      planText.trim(),
      city || cityInput.trim() || undefined,
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

  // Date chip data
  const datePills = useMemo(() => {
    const todayDow = today.getDay();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const getWeekendDate = (dow: number): Date | null => {
      const daysUntil = (dow - todayDow + 7) % 7;
      if (daysUntil <= 1) return null;
      const d = new Date(today);
      d.setDate(today.getDate() + daysUntil);
      return d;
    };
    const friDate = getWeekendDate(5);
    const satDate = getWeekendDate(6);
    const sunDate = getWeekendDate(0);
    return [
      { label: "Today", date: today },
      { label: "Tomorrow", date: tomorrow },
      ...(friDate ? [{ label: "This Friday", date: friDate }] : []),
      ...(satDate ? [{ label: "This Saturday", date: satDate }] : []),
      ...(sunDate ? [{ label: "This Sunday", date: sunDate }] : []),
    ];
  }, [today]);

  // Inline calendar helpers
  const calYear = today.getFullYear();
  const calMonth = today.getMonth();
  const firstDayOffset = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const renderComposer = () => {
    switch (currentStepName) {
      case "name":
        return (
          <div className="space-y-1.5">
            {profanityError && (
              <p className="text-xs text-destructive px-1">{profanityError}</p>
            )}
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  ref={nameInputRef}
                  value={planText}
                  onChange={handleNameChange}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNameSubmit(); } }}
                  placeholder={t("createPlan.placeholder")}
                  maxLength={MAX_CHARACTERS}
                  className="w-full h-11 rounded-full border border-border bg-muted/60 px-4 pr-12 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                  {planText.length}/{MAX_CHARACTERS}
                </span>
              </div>
              <button
                onClick={handleNameSubmit}
                disabled={!planText.trim() || hasProfanity}
                className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40 text-white shrink-0 transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, rgba(88,28,135,0.9), rgba(67,56,202,0.8))" }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case "city":
        return (
          <div className="flex items-center gap-2">
            <input
              ref={cityInputElRef}
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCitySubmit(); } }}
              placeholder="e.g. Paris, New York, São Paulo…"
              className="flex-1 h-11 rounded-full border border-border bg-muted/60 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground"
            />
            <button
              onClick={handleCitySubmit}
              disabled={!cityInput.trim()}
              className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40 text-white shrink-0 transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, rgba(88,28,135,0.9), rgba(67,56,202,0.8))" }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        );

      case "date":
        return (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap items-center">
              {datePills.map(({ label, date }) => {
                const isSelected = format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleDateSelect(date)}
                    className={cn(
                      "px-3 py-2 rounded-full text-sm font-medium border transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/60 text-foreground border-border hover:border-primary/50"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowCalendar((v) => !v)}
                className={cn(
                  "w-9 h-9 rounded-full border flex items-center justify-center transition-all shrink-0",
                  showCalendar
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-border text-foreground hover:border-primary/50"
                )}
                aria-label="Pick a date"
              >
                <Calendar className="w-4 h-4" />
              </button>
            </div>

            {showCalendar && (
              <div className="p-3 rounded-xl border border-border bg-background">
                <p className="text-xs font-medium text-center text-muted-foreground mb-2">
                  {format(new Date(calYear, calMonth, 1), "MMMM yyyy")}
                </p>
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                    <div key={d} className="text-muted-foreground font-medium py-1 text-[11px]">{d}</div>
                  ))}
                  {[...Array(firstDayOffset)].map((_, i) => <div key={`e-${i}`} />)}
                  {[...Array(daysInMonth)].map((_, i) => {
                    const dayNum = i + 1;
                    const dayDate = startOfDay(new Date(calYear, calMonth, dayNum));
                    const isPast = dayDate < today;
                    const isDaySelected = format(dayDate, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
                    return (
                      <button
                        key={dayNum}
                        type="button"
                        disabled={isPast}
                        onClick={() => handleDateSelect(dayDate)}
                        className={cn(
                          "aspect-square rounded-full text-xs flex items-center justify-center mx-auto w-7 h-7 transition-colors",
                          isPast ? "text-muted-foreground/30 cursor-not-allowed" : "hover:bg-muted cursor-pointer",
                          isDaySelected ? "bg-primary text-primary-foreground hover:bg-primary" : ""
                        )}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case "time":
        return (
          <div className="space-y-1.5">
            {pastTimeError && (
              <p className="text-xs text-destructive px-1">This time has already passed — pick a future time.</p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="time"
                ref={timeInputRef}
                value={selectedTime}
                onChange={(e) => { setSelectedTime(e.target.value); setPastTimeError(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleTimeSubmit(); }}
                className="flex-1 h-11 rounded-full border border-border bg-muted/60 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
              <button
                onClick={handleTimeSubmit}
                disabled={!selectedTime}
                className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40 text-white shrink-0 transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, rgba(88,28,135,0.9), rgba(67,56,202,0.8))" }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case "price":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Select value={priceCurrency} onValueChange={setPriceCurrency}>
                <SelectTrigger className="w-24 shrink-0 h-11 rounded-full border-border bg-muted/60">
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
              <input
                ref={priceInputRef}
                type="number"
                min="0"
                step="0.01"
                value={priceAmount}
                onChange={(e) => setPriceAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handlePriceSubmit(); }}
                placeholder={t("createPlan.amountPlaceholder")}
                className="flex-1 h-11 rounded-full border border-border bg-muted/60 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground"
              />
              <button
                onClick={handlePriceSubmit}
                disabled={!priceAmount.trim()}
                className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40 text-white shrink-0 transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, rgba(88,28,135,0.9), rgba(67,56,202,0.8))" }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleSkipPrice}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Skip (keep it free)
            </button>
          </div>
        );

      case "preview":
        return (
          <button
            onClick={handleCreate}
            disabled={!isValid || isLoading || connectLoading}
            className="w-full py-3.5 rounded-full text-white font-medium transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(to right, rgba(88,28,135,0.9), rgba(67,56,202,0.8))" }}
          >
            {isLoading || connectLoading ? (
              <>
                <LoadingSpinner size="sm" />
                {connectLoading ? t("createPlan.checkingPayment") : t("createPlan.creating")}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                {t("createPlan.createBtn")}
              </>
            )}
          </button>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur px-4 py-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] flex items-center gap-2">
        <MinimalBackButton
          onClick={() => navigate(-1)}
          className="text-foreground/80 hover:text-foreground"
          aria-label="Back"
        />
        <h1 className="text-lg font-display font-semibold">{t("createPlan.title")}</h1>
        <div className="ml-auto">
          {isPremium ? (
            <span className="text-xs text-shake-yellow font-medium">{t("createPlan.unlimitedPlans")}</span>
          ) : canCreate ? (
            <span className="text-xs text-muted-foreground">{t("createPlan.freePlansLeft", { count: remainingActivities })}</span>
          ) : null}
        </div>
      </div>

      {!user ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">{t("createPlan.signInToCreate")}</p>
        </div>
      ) : !canCreate ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-4">
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(to right, rgba(88,28,135,0.6), rgba(67,56,202,0.5))" }}
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
              style={{ background: "linear-gradient(to right, rgba(88,28,135,0.8), rgba(67,56,202,0.7))" }}
            >
              <SuperHumanIcon size={16} />
              {t("premium.becomeSuperHuman")}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3 pb-52">
            {steps.slice(0, currentStep).map((step, i) => (
              <div key={step} className="space-y-2">
                <BotBubble message={BOT_QUESTIONS[step]} />
                <UserBubble
                  message={getUserAnswer(step)}
                  onClick={() => jumpToStep(i)}
                />
              </div>
            ))}

            {currentStepName !== "preview" && (
              <BotBubble message={BOT_QUESTIONS[currentStepName]} />
            )}

            {currentStepName === "preview" && (
              <>
                <BotBubble message={BOT_QUESTIONS["preview"]} />
                {/* Preview card */}
                <div className="pl-10">
                  <div className="rounded-2xl px-4 py-3 bg-muted/70 space-y-2 border border-border/30 max-w-[85%]">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
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
                        <p className="font-semibold text-foreground truncate text-sm">"{planText.trim()}"</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {effectiveCity} · {isToday(selectedDate) ? t("common.today") : isTomorrow(selectedDate) ? t("common.tomorrow") : format(selectedDate, "EEE, MMM d")} · {format(previewDateTime, "h:mm a")}
                          {priceAmount.trim() && (
                            <span className="text-green-500 font-medium ml-1">
                              · {selectedCurrencySymbol}{priceAmount} {priceCurrency}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {dayLimitError && (
                  <BotBubble message="Slow down tiger, one plan a day keeps the chaos away! 🐯" />
                )}
              </>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Fixed composer */}
          <div className="fixed bottom-0 left-0 right-0 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] bg-background/95 backdrop-blur border-t border-border/40">
            {renderComposer()}
          </div>
        </>
      )}

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
