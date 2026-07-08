import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { startOfDay, format, isToday, isTomorrow } from "date-fns";
import { Plus, User, Calendar, Send, ChevronLeft, Play } from "lucide-react";
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
import { Capacitor } from "@capacitor/core";

// Set to true to re-enable ID verification gate on the paid-plan create path.
const ID_VERIFICATION_ENABLED = false;

// Set to true to re-enable the payout-method gate on the paid-plan create path.
// When false, users can create a paid plan without completing payout setup.
// A warning banner in ProfileTab nudges them to complete it afterwards.
const PAYOUT_METHOD_GATE_ENABLED = false;

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

type StepName = "name" | "city" | "date" | "time" | "price" | "video" | "preview";
type CameraMode = "idle" | "live" | "recording" | "playback" | "error";


function BotBubble({ message, showAvatar = false, avatarColor = "#facc15", subtext }: { message: string; showAvatar?: boolean; avatarColor?: string; subtext?: string }) {
  if (!message) return null;
  return (
    <div className="flex flex-row items-end gap-3 mb-8">
      {showAvatar && (
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-3xl shrink-0"
          style={{ background: avatarColor }}
        >
          😎
        </div>
      )}
      <div className="bg-muted rounded-2xl rounded-tl-none px-5 py-4 flex-1">
        <p className="text-xl font-semibold text-foreground leading-snug">{message}</p>
        {subtext && <p className="text-sm text-muted-foreground mt-1">{subtext}</p>}
      </div>
    </div>
  );
}

export default function ProposePlanPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const BOT_QUESTIONS = useMemo((): Record<StepName, string> => ({
    name: t("createPlan.botName"),
    city: t("createPlan.botCity"),
    date: t("createPlan.botDate"),
    time: t("createPlan.botTime"),
    price: t("createPlan.botPrice"),
    video: t("createPlan.botVideo"),
    preview: "",
  }), [t]);

  const STEP_AVATAR_COLORS: Partial<Record<StepName, string>> = {
    name:  "#facc15", // yellow-400 — existing default
    city:  "#facc15",
    date:  "#bbf7d0", // green-200
    time:  "#fed7aa", // orange-200
    price: "#e9d5ff", // purple-200
  };

  const { user, isPremium } = useAuth();
  const { selectedCity } = useCity();
  const city = selectedCity ?? "";
  // Always-current ref: written synchronously on every render so handleCreate
  // reads the freshest selectedCity even if the closure captured a stale "".
  const selectedCityRef = useRef(selectedCity);
  selectedCityRef.current = selectedCity;

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
  const [cityInput, setCityInput] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedTime, setSelectedTime] = useState("20:00"); // default 8:00 PM
  const [pastTimeError, setPastTimeError] = useState(false);

  // Chat flow
  const [currentStep, setCurrentStep] = useState(0);
  const [isEditingAnswers, setIsEditingAnswers] = useState(false);
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [promoVideoUrl, setPromoVideoUrl] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("idle");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedObjectUrl, setRecordedObjectUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const cityInputElRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const playbackVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chosenMimeTypeRef = useRef<string>("video/mp4");
  const composerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const cameraBoxRef = useRef<HTMLDivElement>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [composerHeight, setComposerHeight] = useState(96);

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

  // Ordered steps — insert "city" only when context provides no city
  const steps: StepName[] = useMemo(() => {
    const s: StepName[] = ["video", "name"];
    if (!city) s.push("city");
    s.push("date", "time", "price", "preview");
    return s;
  }, [city]);

  const currentStepName = steps[currentStep];

  // Auto-focus input on step change + scroll to bottom
  useEffect(() => {
    if (currentStepName === "name") nameInputRef.current?.focus();
    else if (currentStepName === "city") cityInputElRef.current?.focus();
    else if (currentStepName === "time") timeInputRef.current?.focus();
    else if (currentStepName === "price") priceInputRef.current?.focus();
    // Scroll the history area to the bottom so the new step is always visible
    requestAnimationFrame(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    });
  }, [currentStepName]);

  // Keyboard avoidance: shift composer above the on-screen keyboard
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
      // Keep chat history scrolled to bottom when keyboard opens/closes
      requestAnimationFrame(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      });
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Track composer height so scroll-area padding stays accurate
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setComposerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Camera hooks ──────────────────────────────────────────────────────────
  const stopAllTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setVideoError(null);
    setCameraMode("idle");
    setRecordedBlob(null);
    setRecordedObjectUrl(null);
    setRecordingSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      setCameraMode("live");
    } catch {
      setVideoError("Camera access needed to record — you can Skip instead.");
      setCameraMode("error");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) { clearTimeout(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    mediaRecorderRef.current?.stop();
  }, []);

  // Start camera when entering the video step; stop tracks when leaving
  useEffect(() => {
    if (currentStepName !== "video") {
      stopAllTracks();
      if (recordingTimerRef.current) { clearTimeout(recordingTimerRef.current); recordingTimerRef.current = null; }
      if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
      return;
    }
    // A video was already captured — show the review UI without restarting the camera
    if (promoVideoUrl) return;
    startCamera();
    return () => {
      stopAllTracks();
      if (recordingTimerRef.current) { clearTimeout(recordingTimerRef.current); recordingTimerRef.current = null; }
      if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    };
  }, [currentStepName, promoVideoUrl, startCamera, stopAllTracks]);

  // Attach live stream / auto-start playback when cameraMode changes
  useEffect(() => {
    if (cameraMode === "live" && liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current;
      liveVideoRef.current.play().catch(() => {});
    }
    if (cameraMode === "playback") {
      setPlaybackProgress(0);
      // DOM is committed before this effect runs, so ref is set
      playbackVideoRef.current?.play().catch(() => {});
    }
  }, [cameraMode]);
  // Auto-scroll: when the video step mounts, scroll so the camera box is in view
  useEffect(() => {
    if (currentStepName !== "video") return;
    // rAF ensures the camera box has been painted before we measure
    const id = requestAnimationFrame(() => {
      if (cameraBoxRef.current) {
        cameraBoxRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
      } else if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(id);
  }, [currentStepName]);
  // ── End camera hooks ───────────────────────────────────────────────────────

  const selectedCurrencySymbol = CURRENCIES.find((c) => c.code === priceCurrency)?.symbol || "$";

  const getUserAnswer = (step: StepName): string => {
    switch (step) {
      case "name": return planText;
      case "city": return cityInput || city;
      case "date":
        return isToday(selectedDate)
          ? t("common.today")
          : isTomorrow(selectedDate)
          ? t("common.tomorrow")
          : format(selectedDate, "EEE, MMM d");
      case "time": return format(previewDateTime, "h:mm a");
      case "price":
        return priceAmount.trim()
          ? `${selectedCurrencySymbol}${priceAmount} ${priceCurrency}`
          : t("createPlan.free");
      case "video": return promoVideoUrl ? t("createPlan.videoAdded") : t("createPlan.skipped");
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
    setShowPriceInput(false);
  };

  const handleBack = () => {
    if (currentStep > 0) jumpToStep(currentStep - 1);
  };

  const handleExitFlow = useCallback(() => {
    stopAllTracks();
    if (recordedObjectUrl) URL.revokeObjectURL(recordedObjectUrl);
    setRecordedObjectUrl(null);
    setRecordedBlob(null);
    setPromoVideoUrl(null);
    setCameraMode("idle");
    navigate(-1);
  }, [stopAllTracks, recordedObjectUrl, navigate]);

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

  const [priceError, setPriceError] = useState<string | null>(null);

  const handlePriceSubmit = () => {
    if (!priceAmount.trim()) {
      setPriceError("Please enter an amount, or tap Free to skip.");
      return;
    }
    const parsed = parseFloat(priceAmount.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) {
      setPriceError("Enter a valid amount greater than 0.");
      return;
    }
    setPriceError(null);
    advanceStep();
  };

  const handleSkipPrice = () => {
    setPriceAmount("");
    advanceStep();
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    recordingChunksRef.current = [];
    // mimeType: prefer mp4 (iOS/Safari), fall back to webm
    const mimeType =
      MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" :
      MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" :
      "video/webm";
    chosenMimeTypeRef.current = mimeType;
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordingChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordingChunksRef.current, { type: chosenMimeTypeRef.current });
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setRecordedObjectUrl(url);
      stopAllTracks();
      setCameraMode("playback");
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecordingSeconds(0);
    setCameraMode("recording");
    countdownIntervalRef.current = setInterval(() => {
      setRecordingSeconds(s => s + 1);
    }, 1000);
    recordingTimerRef.current = setTimeout(stopRecording, 10000);
  };

  const handleRetake = async () => {
    if (recordedObjectUrl) { URL.revokeObjectURL(recordedObjectUrl); }
    setRecordedBlob(null);
    setVideoError(null);
    await startCamera();
  };

  const handleUseVideo = async () => {
    if (!recordedBlob) return;
    setVideoUploading(true);
    setVideoError(null);
    try {
      const mimeType = recordedBlob.type;
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("plan-videos")
        .upload(path, recordedBlob, { contentType: mimeType });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from("plan-videos")
        .getPublicUrl(path);
      if (recordedObjectUrl) { URL.revokeObjectURL(recordedObjectUrl); setRecordedObjectUrl(null); }
      setPromoVideoUrl(publicUrl);
      advanceStep();
    } catch {
      setVideoError("Upload failed. Please try again.");
    } finally {
      setVideoUploading(false);
    }
  };

  const handleSkipVideo = () => {
    stopAllTracks();
    if (recordingTimerRef.current) { clearTimeout(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    if (recordedObjectUrl) { URL.revokeObjectURL(recordedObjectUrl); setRecordedObjectUrl(null); }
    setRecordedBlob(null);
    setPromoVideoUrl(null);
    setCameraMode("idle");
    advanceStep();
  };

  const togglePlayback = () => {
    const vid = playbackVideoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
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

    if (ID_VERIFICATION_ENABLED && isPaidActivity && !isVerified && !isVerificationPending) {
      setShowIDVerification(true);
      return;
    }

    if (PAYOUT_METHOD_GATE_ENABLED && priceAmount.trim() && !hasPayoutMethod) {
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

    // Read city from the ref, not the closure — guarantees we use the value
    // CityContext has resolved to at the moment the user taps submit, not the
    // value captured when the component last rendered before CityContext settled.
    const freshCity = selectedCityRef.current || cityInput.trim() || undefined;

    const success = await createActivity(
      detectedActivity.type,
      activityDate,
      planText.trim(),
      freshCity,
      formattedPrice,
      endOfSelectedDay,
      promoVideoUrl || undefined
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
      // Convert JS dow (Sun=0) to ISO week day (Mon=0…Sun=6) so we can
      // correctly detect whether the target day has already passed this week.
      const isoToday = (todayDow + 6) % 7;
      const isoTarget = (dow + 6) % 7;
      if (isoTarget <= isoToday + 1) return null; // passed, today, or tomorrow
      const daysUntil = (dow - todayDow + 7) % 7;
      const d = new Date(today);
      d.setDate(today.getDate() + daysUntil);
      return d;
    };
    const friDate = getWeekendDate(5);
    const satDate = getWeekendDate(6);
    const sunDate = getWeekendDate(0);
    return [
      { label: t("common.today"), date: today },
      { label: t("common.tomorrow"), date: tomorrow },
      ...(friDate ? [{ label: t("createPlan.thisFriday"), date: friDate }] : []),
      ...(satDate ? [{ label: t("createPlan.thisSaturday"), date: satDate }] : []),
      ...(sunDate ? [{ label: t("createPlan.thisSunday"), date: sunDate }] : []),
    ];
  }, [today, t]);

  // Inline calendar helpers
  const calYear = today.getFullYear();
  const calMonth = today.getMonth();
  const firstDayOffset = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const renderCameraCapture = () => {
    const circumference = 2 * Math.PI * 28;

    // ── Already captured — review state ─────────────────────────────────────
    if (promoVideoUrl) {
      return (
        <div className="space-y-4">
          {/* Inline thumbnail — tap opens the existing fullscreen modal */}
          <button
            type="button"
            onClick={() => setVideoFullscreen(true)}
            className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden block"
            aria-label="Preview promo video fullscreen"
          >
            <video
              src={promoVideoUrl}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Play icon */}
            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center pointer-events-none">
              <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
            </div>

          </button>

          {/* Retake / Keep this */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setPromoVideoUrl(null); handleRetake(); }}
              className="flex-1 py-3 rounded-full text-sm font-semibold bg-muted text-foreground"
            >
              {t("createPlan.retake")}
            </button>
            <button
              type="button"
              onClick={advanceStep}
              className="flex-1 py-3 rounded-full text-sm font-semibold bg-black text-white"
            >
              {t("createPlan.keepThis")}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Camera / playback box — portrait ~3:4 */}
        <div
          ref={cameraBoxRef}
          className="relative w-full rounded-2xl overflow-hidden bg-black"
          style={{ aspectRatio: "3/4", maxHeight: "58vh" }}
        >
          {/* Live preview (front camera, mirrored so it feels natural) */}
          {(cameraMode === "live" || cameraMode === "recording") && (
            <video
              ref={liveVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
          )}

          {/* Idle / initialising */}
          {cameraMode === "idle" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <LoadingSpinner size="sm" />
            </div>
          )}

          {/* Camera / permission error */}
          {cameraMode === "error" && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <p className="text-white/80 text-center text-sm leading-relaxed">{videoError}</p>
            </div>
          )}

          {/* Clip playback — tap to play/pause, no native controls */}
          {cameraMode === "playback" && recordedObjectUrl && (
            <video
              ref={playbackVideoRef}
              src={recordedObjectUrl}
              playsInline
              onClick={togglePlayback}
              onTimeUpdate={() => {
                const vid = playbackVideoRef.current;
                if (vid && vid.duration) setPlaybackProgress(vid.currentTime / vid.duration);
              }}
              onEnded={() => setPlaybackProgress(0)}
              className="absolute inset-0 w-full h-full object-contain cursor-pointer"
            />
          )}

          {/* Playback progress ring — sits in the top letterbox area */}
          {cameraMode === "playback" && (() => {
            const r = 15;
            const c = 2 * Math.PI * r;
            return (
              <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
                <svg width="36" height="36" viewBox="0 0 36 36">
                  {/* Faint track */}
                  <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
                  {/* Fill — no transition so it freezes instantly when paused */}
                  <circle
                    cx="18" cy="18" r={r}
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - playbackProgress)}
                    transform="rotate(-90 18 18)"
                  />
                </svg>
              </div>
            );
          })()}

          {/* REC badge */}
          {cameraMode === "recording" && (
            <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
              <span className="bg-red-500/90 px-3 py-1 rounded-full text-white text-xs font-semibold tracking-wide">
                {t("createPlan.recording")}
              </span>
            </div>
          )}

          {/* Skip pill — top-right corner, hidden during recording */}
          {cameraMode === "live" && (
            <button
              type="button"
              onClick={handleSkipVideo}
              disabled={videoUploading}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-sm font-medium text-white disabled:opacity-50 z-10"
              style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            >
              {t("createPlan.skipVideo")}
            </button>
          )}

          {/* REC button (live) / Stop + countdown ring (recording) — always centered */}
          {(cameraMode === "live" || cameraMode === "recording") && (
            <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center">
              {cameraMode === "recording" ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="relative w-16 h-16 rounded-full bg-red-500 shadow-xl flex items-center justify-center"
                >
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                    <circle
                      cx="32" cy="32" r="28"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (recordingSeconds / 10)}
                      transform="rotate(-90 32 32)"
                      style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                  </svg>
                  <span className="text-white font-bold text-base z-10 leading-none">
                    {10 - recordingSeconds}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-16 h-16 rounded-full border-4 border-white/70 shadow-xl flex items-center justify-center"
                  style={{ background: "rgba(239, 68, 68, 0.9)" }}
                >
                  <div className="w-5 h-5 rounded-full bg-white" />
                </button>
              )}
            </div>
          )}

          {/* Playback actions */}
          {cameraMode === "playback" && (
            <div className="absolute bottom-4 left-4 right-4 flex gap-3">
              <button
                type="button"
                onClick={handleRetake}
                disabled={videoUploading}
                className="flex-1 py-3 rounded-full text-sm font-semibold bg-black/60 text-white backdrop-blur-sm disabled:opacity-50"
              >
                {t("createPlan.retake")}
              </button>
              <button
                type="button"
                onClick={handleUseVideo}
                disabled={videoUploading}
                className="flex-1 py-3 rounded-full text-sm font-semibold bg-white text-black flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {videoUploading && <LoadingSpinner size="sm" />}
                {videoUploading ? t("createPlan.videoUploading") : t("createPlan.useThisVideo")}
              </button>
            </div>
          )}
        </div>

        {/* Upload error (outside the camera box) */}
        {videoError && cameraMode !== "error" && (
          <p className="text-sm text-destructive text-center">{videoError}</p>
        )}

      </div>
    );
  };

  const renderComposer = () => {
    switch (currentStepName) {
      case "name":
        return (
          <div className="space-y-2">
            {profanityError && (
              <p className="text-sm text-destructive px-1">{profanityError}</p>
            )}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  ref={nameInputRef}
                  value={planText}
                  onChange={handleNameChange}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNameSubmit(); } }}
                  placeholder="Type here..."
                  maxLength={MAX_CHARACTERS}
                  className="w-full h-16 rounded-2xl border border-border bg-muted/60 px-5 pr-14 text-base focus:outline-none focus:ring-1 focus:ring-black/20 focus:border-black/20 placeholder:text-muted-foreground"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  {planText.length}/{MAX_CHARACTERS}
                </span>
              </div>
              <button
                onClick={handleNameSubmit}
                disabled={!planText.trim() || hasProfanity}
                className="w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-40 text-white shrink-0 transition-opacity hover:opacity-90 bg-black"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        );

      case "city":
        return (
          <div className="flex items-center gap-3">
            <input
              ref={cityInputElRef}
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCitySubmit(); } }}
              placeholder="e.g. Paris, New York, São Paulo…"
              className="flex-1 h-16 rounded-2xl border border-border bg-muted/60 px-5 text-base focus:outline-none focus:ring-1 focus:ring-black/20 focus:border-black/20 placeholder:text-muted-foreground"
            />
            <button
              onClick={handleCitySubmit}
              disabled={!cityInput.trim()}
              className="w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-40 text-white shrink-0 transition-opacity hover:opacity-90 bg-black"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        );

      case "date":
        return (
          <div className="relative">
            <div className="flex items-center gap-3">
              {/* Date pills — inside a unified input-row container matching time/name steps */}
              <div className="flex-1 flex gap-2 items-center overflow-x-auto h-16 rounded-2xl border border-border bg-muted/60 px-4 scrollbar-hide">
                {datePills.map(({ label, date }) => {
                  const isSelected = format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleDateSelect(date)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium shrink-0 transition-all",
                        isSelected
                          ? "bg-black text-white"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {/* Calendar icon — circular button, mirrors send button position on time step */}
              <button
                type="button"
                onClick={() => setShowCalendar((v) => !v)}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all",
                  showCalendar
                    ? "bg-black text-white"
                    : "bg-muted/60 border border-border text-foreground hover:border-primary/50"
                )}
                aria-label="Pick a date"
              >
                <Calendar className="w-5 h-5" />
              </button>
            </div>

            {showCalendar && (
              <div className="absolute bottom-full left-0 right-0 mb-2 z-10 p-3 rounded-xl border border-border bg-background shadow-lg">
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
          <div className="space-y-2">
            {pastTimeError && (
              <p className="text-sm text-destructive px-1">This time has already passed — pick a future time.</p>
            )}
            <div className="flex items-center gap-3">
              <input
                type="time"
                ref={timeInputRef}
                value={selectedTime}
                onChange={(e) => { setSelectedTime(e.target.value); setPastTimeError(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleTimeSubmit(); }}
                className="flex-1 h-16 rounded-2xl border border-border bg-muted/60 px-5 text-base text-gray-900 focus:outline-none focus:ring-1 focus:ring-black/20 focus:border-black/20"
                style={{ colorScheme: "light", color: "#111" }}
              />
              <button
                onClick={handleTimeSubmit}
                disabled={!selectedTime}
                className="w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-40 text-white shrink-0 transition-opacity hover:opacity-90 bg-black"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        );

      case "price":
        return (
          <div className="space-y-3">
            {!showPriceInput ? (
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={handleSkipPrice}
                  className="px-6 py-3.5 rounded-full text-base font-medium border transition-all bg-muted/60 text-foreground border-border hover:border-primary/50"
                >
                  {t("createPlan.freeOption")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPriceInput(true)}
                  className="px-6 py-3.5 rounded-full text-base font-medium border transition-all bg-muted/60 text-foreground border-border hover:border-primary/50"
                >
                  {t("createPlan.pricedOption")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {priceError && (
                  <p className="text-sm text-destructive px-1">{priceError}</p>
                )}
                <div className="flex items-center gap-3">
                  {/* Unified container — currency selector + amount input in one rounded box */}
                  <div className="flex-1 flex items-center h-16 rounded-2xl border border-border bg-muted/60 overflow-hidden">
                    {/* Currency select — fixed ~96px, divider on right */}
                    <select
                      value={priceCurrency}
                      onChange={(e) => setPriceCurrency(e.target.value)}
                      className="w-24 h-full shrink-0 bg-transparent border-r border-border px-3 text-sm focus:outline-none"
                    >
                      {CURRENCIES.map((currency) => (
                        <option key={currency.code} value={currency.code}>
                          {currency.symbol} {currency.code}
                        </option>
                      ))}
                    </select>
                    {/* Amount input — takes remaining space */}
                    <input
                      ref={priceInputRef}
                      autoFocus
                      type="text"
                      inputMode="decimal"
                      value={priceAmount}
                      onChange={(e) => {
                        setPriceAmount(e.target.value);
                        setPriceError(null);
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handlePriceSubmit(); } }}
                      placeholder={t("createPlan.amountPlaceholder")}
                      className="flex-1 h-full min-w-0 bg-transparent px-4 text-base focus:outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  {/* Send — matches time/date step circular button */}
                  <button
                    onClick={handlePriceSubmit}
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white shrink-0 transition-opacity hover:opacity-90 bg-black"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case "video":
        // Camera UI is rendered inline in the scrollable area via renderCameraCapture()
        return null;

      case "preview":
        return (
          <div>
            {/* Back button — returns to price step */}
            <div className="pb-3 flex items-center">
              <MinimalBackButton
                onClick={handleBack}
                className="text-foreground/80 hover:text-foreground"
              />
            </div>
          <div className="space-y-5">
            {/* Preview card */}
            {promoVideoUrl ? (
              /* ── Video card: standalone portrait, no text overlay ── */
              <>
                <button
                  type="button"
                  onClick={() => setVideoFullscreen(true)}
                  className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden block"
                  aria-label="Preview promo video fullscreen"
                >
                  {/* Background video */}
                  <video
                    src={promoVideoUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />

                  {/* Play icon — top-right corner */}
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center pointer-events-none">
                    <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                  </div>
                </button>

                {/* Text card below video — same style as no-video branch */}
                <div className="rounded-2xl px-5 py-4 bg-muted/70 border border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {userAvatarUrl ? (
                        <img
                          src={getDisplayAvatarUrl(userAvatarUrl) ?? userAvatarUrl}
                          alt="Your avatar"
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <User className="w-7 h-7 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">"{planText.trim()}"</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
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
              </>
            ) : (
              /* ── No-video card: existing design, untouched ── */
              <div className="rounded-2xl px-5 py-4 bg-muted/70 border border-border/30">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {userAvatarUrl ? (
                      <img
                        src={getDisplayAvatarUrl(userAvatarUrl) ?? userAvatarUrl}
                        alt="Your avatar"
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <User className="w-7 h-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">"{planText.trim()}"</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
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
            )}

            {dayLimitError && (
              <p className="text-sm text-destructive text-center">{t("createPlan.dayLimitError")}</p>
            )}

            {/* Create Plan */}
            <button
              onClick={handleCreate}
              disabled={!isValid || isLoading || connectLoading}
              className="w-full py-4 rounded-full transition-all hover:opacity-90 disabled:opacity-50 flex flex-col items-center justify-center gap-0.5"
              style={{ background: "#000000" }}
            >
              {isLoading || connectLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="text-white">
                    {connectLoading ? t("createPlan.checkingPayment") : t("createPlan.creating")}
                  </span>
                </>
              ) : (
                <span className="text-lg font-semibold tracking-wide text-white">{t("createPlan.addPlan")}</span>
              )}
            </button>

            {/* Edit answers — opens recap view */}
            <button
              type="button"
              onClick={() => setIsEditingAnswers(true)}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1 text-center"
            >
              {t("createPlan.editAnswers")}
            </button>
          </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header — back arrow only on native (phone); hidden on web */}
      {Capacitor.isNativePlatform() && (
        <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur px-4 py-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] flex items-center">
          <MinimalBackButton
            onClick={() => currentStep > 0 ? handleBack() : navigate(-1)}
            className="text-foreground/80 hover:text-foreground"
            aria-label="Back"
          />
        </div>
      )}

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
      ) : isEditingAnswers ? (
        /* ── Edit-answers recap view ── */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Non-scrolling back button — top-left, matches profile page pattern */}
          <div className="px-6 pt-4 pb-2 flex items-center">
            <MinimalBackButton
              onClick={() => setIsEditingAnswers(false)}
              className="text-foreground/80 hover:text-foreground"
            />
          </div>
          <div ref={scrollAreaRef} className="flex-1 overflow-y-auto">
            <div
              className="w-full max-w-sm mx-auto px-6 pb-6 space-y-6"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
            >
              {/* Full-width portrait video — same size as final preview page */}
              {promoVideoUrl && (
                <button
                  type="button"
                  onClick={() => { jumpToStep(steps.indexOf("video")); setIsEditingAnswers(false); }}
                  className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden block"
                  aria-label="Edit promo video"
                >
                  <video
                    src={promoVideoUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center pointer-events-none">
                    <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                  </div>
                </button>
              )}

              {/* All answered Q&As — uniform size, full opacity, no crescendo */}
              {steps
                .slice(0, steps.length - 1)
                .filter(step => step !== "video")
                .map(step => {
                  const stepIndex = steps.indexOf(step);
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => { jumpToStep(stepIndex); setIsEditingAnswers(false); }}
                      className="w-full text-left space-y-0.5 hover:opacity-80 transition-opacity"
                    >
                      <p className="text-sm text-muted-foreground">{BOT_QUESTIONS[step]}</p>
                      <p className="text-xl font-semibold text-foreground">{getUserAnswer(step)}</p>
                    </button>
                  );
                })
              }
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Back button — web only (native has sticky header); all steps except preview */}
          {!Capacitor.isNativePlatform() && currentStepName !== "preview" && (
            <div className="px-6 pt-4 pb-2 flex items-center">
              <MinimalBackButton
                onClick={() => currentStep > 0 ? handleBack() : handleExitFlow()}
                className="text-foreground/80 hover:text-foreground"
                aria-label="Back"
              />
            </div>
          )}

          {/* Scrollable chat history + inline current question */}
          <div ref={scrollAreaRef} className="flex-1 overflow-y-auto">
            {/* spacer: 8vh on step 0 for centering; collapses to 16px once history exists */}
            <div className={currentStep === 0 ? "min-h-[8vh]" : "min-h-4"} />
            <div
              className="w-full max-w-sm mx-auto px-6 pt-4"
              style={{ paddingBottom: composerHeight + keyboardOffset + 32 }}
            >
              {/* Past Q&A — oldest (top) faintest/smallest, most-recent (bottom) clearer */}
              {currentStep > 0 && currentStepName !== "preview" && (
                <div className="space-y-4 mb-6">
                  {steps.slice(0, currentStep).map((step, i) => {
                    // Suppress video thumbnail on preview page — full-size video already shows there
                    if (step === "video" && currentStepName === "preview") return null;

                    const stepsBack = currentStep - i; // 1 = most recent, higher = older
                    // Crescendo: most recent is largest and most opaque; older = smaller + more faded.
                    // Floor at opacity-60 so even the oldest answer stays clearly legible.
                    const opacity =
                      stepsBack === 1 ? "opacity-80"
                      : stepsBack === 2 ? "opacity-70"
                      : "opacity-60";
                    const labelSize =
                      stepsBack === 1 ? "text-sm"
                      : stepsBack === 2 ? "text-xs"
                      : "text-[11px]";
                    const answerSize =
                      stepsBack === 1 ? "text-xl"
                      : stepsBack === 2 ? "text-base"
                      : stepsBack === 3 ? "text-sm"
                      : "text-xs";
                    return (
                      <button
                        key={step}
                        type="button"
                        onClick={() => jumpToStep(i)}
                        className={cn(
                          "w-full text-left space-y-0.5 transition-all hover:opacity-90 active:opacity-100",
                          opacity
                        )}
                      >
                        {BOT_QUESTIONS[step] && step !== "video" && (
                          <p className={cn("text-muted-foreground leading-tight", labelSize)}>
                            {BOT_QUESTIONS[step]}
                          </p>
                        )}
                        {step === "video" && promoVideoUrl ? (
                          <video
                            src={promoVideoUrl}
                            muted
                            loop
                            playsInline
                            autoPlay
                            className="w-16 h-20 rounded-xl object-cover"
                          />
                        ) : (
                          <p className={cn("font-semibold text-foreground leading-tight", answerSize)}>
                            {getUserAnswer(step)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Divider separating history from active step */}
              {currentStep > 0 && currentStepName !== "preview" && <div className="border-t border-border/20 mb-8" />}

              {/* Current question — inline after history */}
              {BOT_QUESTIONS[currentStepName] && currentStepName !== "video" && (
                <div key={currentStep} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <BotBubble
                    message={BOT_QUESTIONS[currentStepName]}
                    showAvatar={true}
                    avatarColor={STEP_AVATAR_COLORS[currentStepName]}
                    subtext={currentStepName === "name" ? t("createPlan.soOthersCanJoin") : undefined}
                  />
                </div>
              )}

              {/* Camera recorder — only step that needs inline scroll space */}
              {currentStepName === "video" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {renderCameraCapture()}
                </div>
              )}
            </div>
          </div>

          {/* Composer — fixed above the keyboard */}
          <div
            ref={composerRef}
            className="fixed left-0 right-0 z-20 bg-background/95 backdrop-blur border-t border-border/40 px-4 pt-3"
            style={{
              bottom: keyboardOffset,
              paddingBottom: `max(env(safe-area-inset-bottom, 0px), 0.75rem)`,
            }}
          >
            <div className="w-full max-w-sm mx-auto">
              {renderComposer()}
            </div>
          </div>
        </div>
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

      {/* Promo video fullscreen overlay — z-50, above the composer bar (z-20) */}
      {videoFullscreen && promoVideoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setVideoFullscreen(false)}
        >
          {/* Back button — notch-safe */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setVideoFullscreen(false); }}
            className="absolute left-4 z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
            aria-label="Close"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>

          {/* Full video — stopPropagation so tapping controls doesn't close the overlay;
              tapping the letterbox area (black bg) falls through to the outer div */}
          <video
            src={promoVideoUrl}
            controls
            autoPlay
            loop
            playsInline
            className="w-full h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
