import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Browser } from "@capacitor/browser";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/app-toast";
import logoShake from "@/assets/shake-logo-new.png";
import catHead from "@/assets/onboarding/cat-head.png";
import dogHead from "@/assets/onboarding/dog-head.png";
import manHead from "@/assets/onboarding/man-head.png";
import { User, Lock, Eye, EyeOff, Mail, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { isEmailPrefixName } from "@/lib/profileName";
import { LanguageSelector } from "@/components/LanguageSelector";
import { BirthdayPicker } from "@/components/BirthdayPicker";
import { AvatarPicker, avatarOptions } from "@/components/AvatarPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { z } from "zod";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { NationalitySelector } from "@/components/NationalitySelector";
import { isNativePlatform, isNativeAndroid } from "@/lib/platform-utils";
import { logPostgrestError } from "@/lib/supabaseErrorLog";
import { hasValidAvatarUrl } from "@/lib/avatar";
import { FaceCaptureModal } from "@/components/FaceCaptureModal";
import { MinimalBackButton } from "@/components/MinimalBackButton";
import { compareFaces, storeFaceDescriptor } from "@/services/faceAuthService";
import { OnboardingInterestsStep } from "@/components/auth/OnboardingInterestsStep";
import { OnboardingSocialStep } from "@/components/auth/OnboardingSocialStep";

// Temporary rollout flag: keep implementation in codebase but hide from users.
const FACE_ID_FEATURE_ENABLED = false;

const STORAGE_SIGNUP_EMAIL = "shake_signup_magic_link_sent";
const STORAGE_NEED_PASSWORD = "shake_post_signup_set_password";

/** Steps where we must not reset to "name" or navigate away — avoids races when `user` refreshes mid-wizard. */
const AUTH_WIZARD_STEPS = new Set([
  "name",
  "birthday",
  "phone",
  "gender",
  "nationality",
  "occupation",
  "interests",
  "social",
  "avatar",
  "email",
  "confirmation",
  "login",
  "forgotPassword",
  "resetPassword",
  "setPassword",
]);

// ── Conversational profile-setup helpers ────────────────────────────────────

function BotBubble({ message, subtext, avatarColor = "#e9d5ff" }: { message: string; subtext?: string; avatarColor?: string }) {
  if (!message) return null;
  return (
    <div className="flex flex-row items-end gap-3 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
        style={{ background: avatarColor }}
      >
        😎
      </div>
      <div className="bg-muted rounded-2xl rounded-tl-none px-5 py-4 flex-1">
        <p className="text-xl font-semibold leading-snug text-foreground">{message}</p>
        {subtext && <p className="text-sm text-muted-foreground mt-1">{subtext}</p>}
      </div>
    </div>
  );
}

const PROFILE_STEPS = [
  "name",
  "birthday",
  "phone",
  "gender",
  "nationality",
  "occupation",
  "interests",
  "social",
  "avatar",
] as const;
type ProfileStepName = (typeof PROFILE_STEPS)[number];

const PROFILE_BOT_QUESTIONS: Record<ProfileStepName, string> = {
  name: "What's your name? 👋",
  birthday: "When's your birthday? 🎂",
  phone: "What's your phone number? 📱",
  gender: "How do you identify?",
  nationality: "Where are you from? 🌍",
  occupation: "What do you do? 💼",
  interests: "What are you into? ✨",
  social: "Drop your socials 📸",
  avatar: "Last step — pick an avatar or a photo!",
};

const PROFILE_BOT_SUBTEXTS: Partial<Record<ProfileStepName, string>> = {
  birthday: "You must be 18 or older to join",
  phone: "Optional — tap Skip to continue",
  occupation: "Optional",
  social: "Optional — Instagram, LinkedIn, or X",
};

// Same palette ProposePlanPage cycles through per step.
const STEP_AVATAR_COLORS: Partial<Record<ProfileStepName, string>> = {
  name: "#facc15",       // yellow-400
  birthday: "#bbf7d0",   // green-200
  phone: "#fed7aa",      // orange-200
  gender: "#fbcfe8",     // pink-200
  nationality: "#93c5fd", // blue-300
  occupation: "#e9d5ff", // purple-200
  interests: "#fef08a",  // yellow-200
  social: "#a5f3fc",     // cyan-200
};

// Steps whose input UI is simple enough to live in the fixed bottom composer
// (matches ProposePlanPage's chat pattern). Steps with taller custom UI
// (interests grid, social links form, avatar picker) render inline instead —
// same rule ProposePlanPage uses for its own "preview" step.
const COMPOSER_STEPS: readonly ProfileStepName[] = [
  "name",
  "birthday",
  "phone",
  "gender",
  "nationality",
  "occupation",
];

// Show user-friendly messages instead of technical errors
function toFriendlyAuthMessage(raw: string, context: "login" | "signup" | "email" | "general"): string {
  const lower = (raw || "").toLowerCase();
  const isTechnical =
    lower.includes("load failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("edge function") ||
    lower.includes("non-2xx") ||
    lower.includes("network request failed");
  if (isTechnical) {
    if (context === "login") return "Unable to sign in. Please check your connection and try again.";
    if (context === "signup") return "Unable to create account. Please check your connection and try again.";
    if (context === "email") return "Unable to send email. Please check your connection and try again.";
    return "Something went wrong. Please try again.";
  }
  return raw || "Something went wrong. Please try again.";
}

// OAuth: on web (including mobile browser) use redirect flow; on native app use Capacitor Browser
async function signInWithOAuth(provider: 'google' | 'apple') {
  try {
    // Pre-emptively sign out to clear any stale server-side session that may have
    // a NULL provider token — which causes Supabase GoTrue to throw
    // "Scan error on column _token: converting NULL to string is unsupported"
    // during the subsequent OAuth code exchange. Best-effort; never blocks sign-in.
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }

    if (isNativePlatform()) {
      // Native app: open OAuth in Capacitor Browser, return via deep link
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: isNativeAndroid()
            ? 'com.shakebyleo.app://auth/callback'
            : 'com.shakeapp.shakeapp://auth/callback',
          skipBrowserRedirect: true,
          // Request name + email so Apple sends display name on first sign-in.
          // Without this scope Apple omits the name field entirely.
          ...(provider === 'apple' ? { scopes: 'name email' } : {}),
          // Force account picker so user can switch Google accounts.
          ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
        },
      });
      if (error) throw error;
      if (data.url) {
        await Browser.open({
          url: data.url,
          windowName: '_blank',
          presentationStyle: 'popover',
        });
      }
    } else {
      // Web (desktop + mobile browser): full redirect to Google/Apple, then back to /auth/callback
      const redirectTo = import.meta.env.DEV
        ? "http://localhost:8080/auth/callback"
        : "https://app.shakeapp.today/auth/callback";

      const options: any = { redirectTo };

      // On Google, always show account picker so users can switch accounts
      if (provider === "google") {
        options.queryParams = { prompt: "select_account" };
      }

      // Apple requires explicit scope to receive name + email on first sign-in
      if (provider === "apple") {
        options.scopes = "name email";
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options,
      });
      if (error) throw error;
    }
  } catch (error) {
    console.error(`OAuth error (${provider}):`, error);
    toast.error(`Failed to log in with ${provider}`);
  }
}

export default function Auth() {
  const { t } = useTranslation();
  const [step, setStep] = useState<
    | "method"
    | "login"
    | "email"
    | "confirmation"
    | "setPassword"
    | "forgotPassword"
    | "resetPassword"
    | "name"
    | "phone"
    | "gender"
    | "nationality"
    | "occupation"
    | "interests"
    | "social"
    | "avatar"
  >("method");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<string>("");
  const [nationality, setNationality] = useState("");
  const [nationalityInteracted, setNationalityInteracted] = useState(false);
  const [nationalityError, setNationalityError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [occupation, setOccupation] = useState("");
  const [occupationTouched, setOccupationTouched] = useState(false);
  const [occupationError, setOccupationError] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [interestsShaking, setInterestsShaking] = useState(false);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFaceCaptureOpen, setIsFaceCaptureOpen] = useState(false);
  const [faceMode, setFaceMode] = useState<'enroll' | 'authenticate'>('authenticate');
  const [isFaceAuthLoading, setIsFaceAuthLoading] = useState(false);
  const [showFaceSetupPrompt, setShowFaceSetupPrompt] = useState(false);
  const [pendingFaceSetupUserId, setPendingFaceSetupUserId] = useState<string | null>(null);
  const [isResolvingSessionRoute, setIsResolvingSessionRoute] = useState(true);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [confirmationKind, setConfirmationKind] = useState<"signup" | "reset">("signup");
  
  const { user, isLoading: isAuthLoading, sendEmailOtp, sendPasswordResetEmail, signInWithPassword, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const emailLoginFormRef = useRef<HTMLFormElement>(null);
  const profileScrollRef = useRef<HTMLDivElement>(null);

  // Play a gentle welcome chime when the method screen first mounts.
  // Uses the Web Audio API so no audio file is needed (placeholder — Leonel can
  // swap for a real asset later by replacing this with new Audio('/sound.mp3').play()).
  // Respects the user's system mute via AudioContext — if audio is blocked/muted
  // by the browser the catch silently swallows the error.
  // Guarded so it can NEVER play once the person is actually logged in (only the
  // pre-login method-selection screen should ever trigger it), and only once per
  // browser session even if this screen gets remounted (e.g. a redirect flicker).
  useEffect(() => {
    if (step !== "method") return;
    if (user) return;
    try {
      if (sessionStorage.getItem("shake_auth_chime_played") === "1") return;
      sessionStorage.setItem("shake_auth_chime_played", "1");
    } catch {
      /* sessionStorage unavailable — fall through and play anyway */
    }
    let ctx: AudioContext | null = null;
    const timer = setTimeout(() => {
      try {
        ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playNote = (freq: number, startAt: number, duration: number, gain: number) => {
          const osc = ctx!.createOscillator();
          const gainNode = ctx!.createGain();
          osc.connect(gainNode);
          gainNode.connect(ctx!.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, ctx!.currentTime + startAt);
          gainNode.gain.setValueAtTime(0, ctx!.currentTime + startAt);
          gainNode.gain.linearRampToValueAtTime(gain, ctx!.currentTime + startAt + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx!.currentTime + startAt + duration);
          osc.start(ctx!.currentTime + startAt);
          osc.stop(ctx!.currentTime + startAt + duration);
        };
        // Simple ascending two-note chime: C5 → E5
        playNote(523.25, 0,    0.5, 0.18);
        playNote(659.25, 0.18, 0.6, 0.14);
      } catch {
        // Audio blocked or unsupported — silently skip
      }
    }, 300); // slight delay so the screen has rendered
    return () => {
      clearTimeout(timer);
      try { ctx?.close(); } catch { /* ignore */ }
    };
  }, []); // run once on mount — step starts as "method"

  useEffect(() => {
    if (step !== "method" || !showEmailLogin) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (emailLoginFormRef.current?.contains(target)) return;
      setShowEmailLogin(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [step, showEmailLogin]);

  const fallingStars = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        size: 2 + Math.random() * 4,
        opacity: 0.3 + Math.random() * 0.6,
        duration: 3 + Math.random() * 5,
        delay: Math.random() * 8,
        twinkleDuration: 1.8 + Math.random() * 2.6,
        twinkleDelay: Math.random() * 2,
      })),
    []
  );

  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const occupationSchema = z
    .string()
    .trim()
    .min(2, { message: "Please enter at least 2 characters" })
    .max(50, { message: "Please keep it under 50 characters" })
    .regex(/^[\p{L}\p{N} .,'&\-\/()]+$/u, {
      message: "Only letters, numbers and basic punctuation",
    });

  const validateOccupation = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null; // optional
    const parsed = occupationSchema.safeParse(trimmed);
    return parsed.success ? null : parsed.error.issues[0]?.message ?? "Invalid occupation";
  };

  const validateNationality = (raw: string, interacted: boolean): string | null => {
    if (!interacted) return null; // optional unless the user started interacting
    const trimmed = raw.trim();
    if (!trimmed) return "Please select a nationality";
    if (trimmed.length > 60) return "Please keep it under 60 characters";
    return null;
  };

  const validateEmail = (email: string): { isValid: boolean; error?: string } => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      return { isValid: false, error: "Please enter your email address" };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { isValid: false, error: "Please enter a valid email address" };
    }
    return { isValid: true };
  };

  const getMaxDate = (): string => {
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    return maxDate.toISOString().split('T')[0];
  };

  const getFallbackProfileName = (authUser?: typeof user | null) => {
    return String(
      authUser?.user_metadata?.name ??
      authUser?.user_metadata?.full_name ??
      authUser?.email?.split("@")[0] ??
      ""
    ).trim();
  };

  const getProfileCompletionState = async (authUser: NonNullable<typeof user>) => {
    let sawReadError = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
      }

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("name, avatar_url, onboarding_completed_at")
        .eq("user_id", authUser.id)
        .maybeSingle();

      // DEBUG — remove once wizard routing is confirmed working
      console.log("[Auth][getProfileCompletionState] attempt", attempt, {
        userId: authUser.id,
        profileRow: profile,
        profileErr: profileErr?.message ?? null,
      });

      if (profileErr) {
        sawReadError = true;
        logPostgrestError("Auth.tsx profiles select (completion check)", profileErr);
      }

      if (!profileErr) {
        let resolvedProfile = profile;

        if (!resolvedProfile) {
          // Bootstrap an empty profile row. Do NOT pre-populate `name` here —
          // a truthy name would make hasName=true and skip the onboarding wizard.
          // The wizard pre-fills the name field from getFallbackProfileName itself.
          const { data: bootstrappedProfile, error: bootstrapError } = await supabase
            .from("profiles")
            .upsert(
              {
                user_id: authUser.id,
              },
              { onConflict: "user_id" }
            )
            .select("name, avatar_url, onboarding_completed_at")
            .maybeSingle();

          if (bootstrapError) {
            sawReadError = true;
            logPostgrestError("Auth.tsx profiles upsert (completion bootstrap)", bootstrapError);
          } else {
            resolvedProfile = bootstrappedProfile ?? resolvedProfile;
          }
        }

        // Completeness is keyed off onboarding_completed_at, set exactly once
        // by the wizard's own save — not inferred from name/avatar being
        // present, since other code paths can populate those independently
        // of the user ever completing the wizard. isEmailPrefixName is a
        // belt-and-suspenders guard for any row that predates this flag.
        const hasName =
          !!resolvedProfile?.onboarding_completed_at &&
          !isEmailPrefixName(resolvedProfile.name, authUser.email);

        // DEBUG — remove once wizard routing is confirmed working
        console.log("[Auth][getProfileCompletionState] result", {
          resolvedProfileName: resolvedProfile?.name ?? null,
          resolvedProfileAvatar: resolvedProfile?.avatar_url ?? null,
          hasName,
          isComplete: hasName,
          isIncomplete: !hasName,
        });

        // Avatar completeness is enforced separately by MandatoryPhotoScreen
        // in IOSAppLayout. Auth.tsx only gates on name so that a user who has
        // an avatar (e.g. from the DB trigger preset) but no name goes through
        // the name-entry step, while a user with a name but no avatar skips
        // the auth wizard entirely and lands on MandatoryPhotoScreen instead.
        return {
          isComplete: hasName,
          isIncomplete: !hasName,
        };
      }
    }

    // If reads failed repeatedly, avoid forcing onboarding for existing users.
    return {
      isComplete: sawReadError,
      isIncomplete: !sawReadError,
    };
  };

  useEffect(() => {
    const intent = searchParams.get("intent");
    const legacySetPassword = searchParams.get("setPassword") === "1";

    if (intent === "reset" && user) {
      setStep("resetPassword");
      setIsResolvingSessionRoute(false);
      setSearchParams({}, { replace: true });
      return;
    }

    if ((intent === "signup" || legacySetPassword) && user) {
      setStep("setPassword");
      setIsResolvingSessionRoute(false);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, user]);

  // After sign-in: magic-link signup users must set a password first; then profile completion or home.
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      setIsResolvingSessionRoute(false);
      return;
    }

    let cancelled = false;
    setIsResolvingSessionRoute(true);
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setIsResolvingSessionRoute(false);
      }
    }, 3000);

    const resolveSessionRouteDone = () => {
      clearTimeout(timeoutId);
      if (!cancelled) {
        setIsResolvingSessionRoute(false);
      }
    };

    setTimeout(() => {
      (async () => {
        let needSetPassword = false;
        try {
          needSetPassword = sessionStorage.getItem(STORAGE_NEED_PASSWORD) === "1";
        } catch {
          needSetPassword = false;
        }
        if (needSetPassword) {
          if (!cancelled) {
            setStep("setPassword");
            resolveSessionRouteDone();
          }
          return;
        }

        if (AUTH_WIZARD_STEPS.has(step)) {
          resolveSessionRouteDone();
          return;
        }

        if (cancelled) return;

        const completion = await getProfileCompletionState(user);
        if (cancelled) return;

        if (completion.isIncomplete) {
          setStep("name");
          resolveSessionRouteDone();
          return;
        }

        clearTimeout(timeoutId);
        await navigateHome(true);
      })().catch(() => {
          resolveSessionRouteDone();
        // If anything fails, don't block the user
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [user, isAuthLoading, navigate, step]);

  // After a successful login, check for a pending activity join and process it.
  const navigateHome = async (replace = false) => {
    const pendingActivityId = localStorage.getItem("shake_pending_activity_id");
    if (pendingActivityId) {
      localStorage.removeItem("shake_pending_activity_id");
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          await supabase.from("activity_joins").insert({
            user_id: u.id,
            activity_id: pendingActivityId,
          });
        }
      } catch (err) {
        console.error("[Auth] pending activity join failed", err);
      }
      navigate("/plans", { replace });
      return;
    }
    navigate("/", { replace });
  };

  // ── Profile wizard helpers ─────────────────────────────────────────────────

  const isProfileStep = (PROFILE_STEPS as readonly string[]).includes(step);
  const profileStepIndex = PROFILE_STEPS.indexOf(step as ProfileStepName);

  const advanceProfileStep = () => {
    const next = PROFILE_STEPS[profileStepIndex + 1];
    if (next) setStep(next);
  };

  const goBackProfileStep = () => {
    const prev = PROFILE_STEPS[profileStepIndex - 1];
    if (prev) setStep(prev);
    else setStep("method"); // back to login screen from first profile step
  };

  const getProfileStepAnswer = (s: ProfileStepName): string => {
    switch (s) {
      case "name": return name || "—";
      case "birthday": return dateOfBirth || "—";
      case "phone": return phone.trim() || "Skipped";
      case "gender": return gender
        ? { woman: "Woman", man: "Man", other: "Other" }[gender] ?? gender
        : "—";
      case "nationality": return nationality || "—";
      case "occupation": return occupation.trim() || "Skipped";
      case "interests": return selectedInterests.length > 0 ? selectedInterests.join(", ") : "Skipped";
      case "social": {
        const links = [instagramUrl, linkedinUrl, twitterUrl].filter(Boolean);
        return links.length > 0 ? links.join(", ") : "Skipped";
      }
      case "avatar": return selectedAvatar ? "Photo selected" : "—";
    }
  };

  // Scroll to bottom whenever the step advances
  useEffect(() => {
    if (isProfileStep && profileScrollRef.current) {
      setTimeout(() => {
        profileScrollRef.current?.scrollTo({ top: profileScrollRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    }
  }, [step, isProfileStep]);

  const handleNameContinue = () => {
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    advanceProfileStep();
  };

  const handleBirthdayContinue = () => {
    if (!dateOfBirth) { toast.error("Please enter your date of birth"); return; }
    if (calculateAge(dateOfBirth) < 18) { toast.error("You must be 18 or older to use Shake"); return; }
    advanceProfileStep();
  };

  const handleGenderContinue = () => {
    if (!gender) { toast.error("Please select an option"); return; }
    advanceProfileStep();
  };

  const handleNationalityContinue = () => {
    const err = validateNationality(nationality, nationalityInteracted);
    setNationalityError(err);
    if (err) return;
    advanceProfileStep();
  };

  const handleOccupationContinue = () => {
    setOccupationTouched(true);
    const err = validateOccupation(occupation);
    setOccupationError(err);
    if (err) return;
    advanceProfileStep();
  };

  // ── End profile wizard helpers ─────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomAvatarPreview(reader.result as string);
        setSelectedAvatar("custom");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent, attemptNumber = 1) => {
    e.preventDefault();

    const validation = validateEmail(email);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    setIsLoading(true);

    try {
      const result = await sendEmailOtp(email, "signup", attemptNumber);

      if (!result.success) {
        if (result.retryable) {
          console.log("[Auth][handleSendMagicLink] Retryable error detected, retrying in 3 seconds", {
            attempt: attemptNumber,
          });

          toast.info("Retrying... please wait", undefined);
          setIsLoading(true);

          await new Promise((resolve) => setTimeout(resolve, 3000));

          if (!email) return;
          await handleSendMagicLink(
            { preventDefault: () => {} } as React.FormEvent,
            attemptNumber + 1
          );
          return;
        }

        toast.error(toFriendlyAuthMessage(result.message, "email"));
      } else {
        // Only tag the email as "pending signup" for genuinely new users.
        // Existing users received a plain login link (no ?intent=signup) and
        // must not be routed to the set-password screen on return.
        if (!result.isExistingUser) {
          try {
            sessionStorage.setItem(STORAGE_SIGNUP_EMAIL, email.toLowerCase().trim());
          } catch {
            /* ignore */
          }
        }
        setConfirmationKind("signup");
        toast.success("Check your email for a link to sign in");
        setStep("confirmation");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const routeAfterPasswordOrProfile = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return;

    const completion = await getProfileCompletionState(u);
    if (completion.isIncomplete) {
      setStep("name");
    } else {
      await navigateHome(true);
    }
  };

  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateEmail(email);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    setIsLoading(true);
    try {
      const { error, status } = await sendPasswordResetEmail(email);
      if (error) {
        if (status === 429 || error.message === "rate_limited") {
          toast.error("Too many requests — please try again in an hour.");
        } else {
          toast.error("Unable to send password reset email. Please check your connection and try again.");
        }
        return;
      }

      setConfirmationKind("reset");
      toast.success("Check your email for a password reset link.");
      setStep("confirmation");
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteSignupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        toast.error(toFriendlyAuthMessage(error.message, "signup"));
        return;
      }
      try {
        sessionStorage.removeItem(STORAGE_NEED_PASSWORD);
      } catch {
        /* ignore */
      }
      setPassword("");
      setConfirmPassword("");
      toast.success("Password saved. You're signed in.");
      await routeAfterPasswordOrProfile();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        toast.error(toFriendlyAuthMessage(error.message, "general"));
        return;
      }

      setPassword("");
      setConfirmPassword("");
      toast.success("Your password has been reset.");
      await routeAfterPasswordOrProfile();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateEmail(email);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    if (!password) {
      toast.error("Please enter your password");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signInWithPassword(email, password);
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password");
        } else {
          toast.error(toFriendlyAuthMessage(error.message, "login"));
        }
      } else {
        toast.success("Welcome!");
        await navigateHome();
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (isResolvingSessionRoute && (isAuthLoading || !!user)) {
    return (
      <div className="h-[100dvh] bg-white flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const handleSaveProfile = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!selectedAvatar) {
      toast.error("Please choose a profile picture or avatar");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        toast.error("Not logged in");
        navigate("/auth", { replace: true });
        return;
      }

      const [{ data: existingProfile, error: existingProfileError }, { data: existingPrivate, error: existingPrivateError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("name, avatar_url, gender, nationality, occupation, interests")
            .eq("user_id", currentUser.id)
            .maybeSingle(),
          supabase
            .from("profiles_private")
            .select("date_of_birth")
            .eq("user_id", currentUser.id)
            .maybeSingle(),
        ]);

      if (existingProfileError) {
        logPostgrestError("Auth.tsx profiles select (handleSaveProfile)", existingProfileError);
      }
      if (existingPrivateError) {
        logPostgrestError("Auth.tsx profiles_private select (handleSaveProfile)", existingPrivateError);
      }

      const resolvedName =
        name.trim() ||
        existingProfile?.name?.trim() ||
        getFallbackProfileName(currentUser) ||
        currentUser.email?.split("@")[0]?.trim() ||
        "Shake User";

      const resolvedDateOfBirth = dateOfBirth || existingPrivate?.date_of_birth || null;

      if (!resolvedDateOfBirth) {
        toast.error("Please enter your date of birth");
        return;
      }

      const age = calculateAge(resolvedDateOfBirth);
      if (age < 18) {
        toast.error("You must be 18 or older to use Shake");
        return;
      }

      if (!resolvedName.trim()) {
        toast.error("Please enter your name");
        return;
      }

      let avatarUrl: string | null = null;
      if (selectedAvatar === "custom" && customAvatarPreview) {
        try {
          const avatarBlob = await (await fetch(customAvatarPreview)).blob();
          // Storage/CDN content-type sniffing can behave inconsistently for
          // extension-less keys — derive a real extension from the blob's
          // MIME type instead of relying on that.
          const ext = (avatarBlob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
          // Storage RLS requires the first path segment to be the uploader's
          // user id (see storage.foldername policy) — a flat "id-timestamp"
          // key fails that check silently and falls through to the catch
          // block below, which is why this used to always "fail".
          const filePath = `${currentUser.id}/avatar-${Date.now()}.${ext}`;
          const { error } = await supabase.storage
            .from("avatars")
            .upload(filePath, avatarBlob, { upsert: true, contentType: avatarBlob.type || "image/jpeg" });

          if (error) {
            throw error;
          }

          const { data: publicUrlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);
          avatarUrl = publicUrlData.publicUrl;
        } catch (avatarError) {
          console.error("Avatar upload error:", avatarError);
          toast.error("Failed to upload avatar, but your setup will still continue");
          avatarUrl = customAvatarPreview;
        }
      } else if (selectedAvatar && selectedAvatar !== "custom") {
        avatarUrl = avatarOptions.find((avatar) => avatar.id === selectedAvatar)?.src || existingProfile?.avatar_url || null;
      }

      if (!hasValidAvatarUrl(avatarUrl)) {
        toast.error("Please choose a valid profile picture or avatar");
        return;
      }

      const { data: savedProfile, error: profileError } = await supabase.from("profiles").upsert(
        {
          user_id: currentUser.id,
          name: resolvedName.trim(),
          avatar_url: avatarUrl,
          gender: gender || existingProfile?.gender || null,
          nationality: nationality || existingProfile?.nationality || null,
          occupation: occupation || existingProfile?.occupation || null,
          interests: selectedInterests.length > 0 ? selectedInterests : (existingProfile?.interests ?? null),
          instagram_url: instagramUrl || null,
          linkedin_url: linkedinUrl || null,
          twitter_url: twitterUrl || null,
          // Set exactly once, only here — the completeness checks key off this
          // instead of inferring "done" from name/avatar being present, since
          // other code paths (DB trigger defaults, backfills) can populate
          // those columns without the user ever having seen the wizard.
          onboarding_completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      ).select("user_id, name, avatar_url, onboarding_completed_at").single();

      if (profileError) {
        logPostgrestError("Auth.tsx profiles upsert", profileError);
        toast.error("We couldn't save your profile photo. Please try again.");
        return;
      }

      if (!savedProfile?.name?.trim() || !hasValidAvatarUrl(savedProfile.avatar_url)) {
        toast.error("We couldn't verify your profile photo. Please try again.");
        return;
      }

      const privatePayload: Record<string, unknown> = {
        user_id: currentUser.id,
        date_of_birth: resolvedDateOfBirth,
      };
      if (phone.trim()) privatePayload.phone_number = phone.trim();

      const { data: savedPrivate, error: privateError } = await supabase.from("profiles_private").upsert(
        privatePayload,
        { onConflict: "user_id" }
      ).select("user_id, date_of_birth").single();

      if (privateError) {
        logPostgrestError("Auth.tsx profiles_private upsert", privateError);
        toast.error("We couldn't finish saving your profile. Please try again.");
        return;
      }

      if (!savedPrivate?.date_of_birth) {
        toast.error("We couldn't verify your date of birth. Please try again.");
        return;
      }

      try {
        sessionStorage.setItem("shake_profile_just_saved", String(Date.now()));
      } catch {
        /* ignore */
      }

      toast.success("Profile complete!");
      triggerConfettiWaterfall();
      await navigateHome(true);
    } catch (error) {
      console.error("Profile save error:", error);
      toast.error("We couldn't save your profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFaceAuth = () => {
    setFaceMode('authenticate');
    setIsFaceCaptureOpen(true);
  };

  const handleFaceCaptureSuccess = async (descriptor?: Float32Array) => {
    if (!descriptor) {
      toast.warning("Face not recognized. Try again or use another method");
      setIsFaceCaptureOpen(false);
      return;
    }

    if (faceMode === 'enroll') {
      try {
        const fallbackUser = (await supabase.auth.getUser()).data.user;
        const targetUserId = pendingFaceSetupUserId ?? fallbackUser?.id;
        if (!targetUserId) {
          toast.error("Could not set up Face ID right now");
          setIsFaceCaptureOpen(false);
          return;
        }

        await storeFaceDescriptor(targetUserId, descriptor);
        toast.success("Face ID set up! You can now sign in with your face");
      } catch (error) {
        console.error("Failed to store Face ID descriptor", error);
        toast.error("Could not set up Face ID. Please try again later");
      } finally {
        setPendingFaceSetupUserId(null);
        setIsFaceCaptureOpen(false);
        await navigateHome();
      }
      return;
    }

    setIsFaceAuthLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, face_descriptor")
        .not("face_descriptor", "is", null);

      if (profilesError) {
        throw profilesError;
      }

      const matchingProfile = (profilesData ?? []).find((profile: any) => {
        if (!Array.isArray(profile.face_descriptor)) return false;
        try {
          return compareFaces(profile.face_descriptor as number[], descriptor);
        } catch {
          return false;
        }
      });

      if (!matchingProfile?.user_id) {
        toast.warning("Face not recognized. Try again or use another method");
        return;
      }

      const { data: faceAuthData, error: faceAuthError } = await supabase.functions.invoke("face-auth", {
        body: { userId: matchingProfile.user_id },
      });

      if (faceAuthError) {
        throw faceAuthError;
      }

      const accessToken = faceAuthData?.session?.access_token ?? faceAuthData?.access_token;
      const refreshToken = faceAuthData?.session?.refresh_token ?? faceAuthData?.refresh_token;

      if (!accessToken || !refreshToken) {
        throw new Error("Face auth session token missing");
      }

      // @ts-ignore - setSession exists on the auth client
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (setSessionError) {
        throw setSessionError;
      }

      toast.success("Welcome!");
      setIsFaceCaptureOpen(false);
      await navigateHome();
    } catch (error) {
      console.error("Face auth failed", error);
      toast.warning("Face not recognized. Try again or use another method");
    } finally {
      setIsFaceAuthLoading(false);
      setIsFaceCaptureOpen(false);
    }
  };

  // ── Full-screen conversational profile setup ───────────────────────────────
  if (isProfileStep) {
    const currentProfileStep = PROFILE_STEPS[profileStepIndex];
    const hasFixedComposer = COMPOSER_STEPS.includes(currentProfileStep);

    // Photo picker is its own full-page step — no chat history, matches the
    // "alone in a full page" request. Back still works to edit earlier answers.
    if (currentProfileStep === "avatar") {
      return (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div
            className="flex items-center gap-3 px-4 border-b border-border/40 shrink-0"
            style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 16px)", paddingBottom: "12px" }}
          >
            <button
              type="button"
              onClick={goBackProfileStep}
              className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="flex-1 flex justify-center">
              <img src={logoShake} alt="SHAKE" className="h-8 w-auto object-contain" />
            </div>
            <div className="flex gap-1 items-center">
              {PROFILE_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i < profileStepIndex ? "w-4 bg-violet-500" : i === profileStepIndex ? "w-5 bg-violet-700" : "w-1.5 bg-gray-200"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-4 gap-2">
            <h2 className="text-xl font-bold text-foreground mb-2">{PROFILE_BOT_QUESTIONS.avatar}</h2>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="user" onChange={handleFileChange} className="hidden" />
            <AvatarPicker
              selectedAvatar={selectedAvatar}
              onSelectAvatar={setSelectedAvatar}
              onUploadClick={() => fileInputRef.current?.click()}
              onCameraClick={() => cameraInputRef.current?.click()}
              customAvatarPreview={customAvatarPreview}
            />
          </div>

          <div
            className="px-4 pt-3 shrink-0"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}
          >
            <button
              type="button"
              onClick={() => handleSaveProfile()}
              disabled={isLoading || !selectedAvatar}
              className="w-full h-14 rounded-full text-base font-semibold text-white disabled:opacity-40 animate-gradient-shift"
            >
              {isLoading ? "Saving…" : "Complete Setup"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 border-b border-border/40 shrink-0"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 16px)", paddingBottom: "12px" }}
        >
          <button
            type="button"
            onClick={goBackProfileStep}
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="flex-1 flex justify-center">
            <img src={logoShake} alt="SHAKE" className="h-8 w-auto object-contain" />
          </div>
          {/* Step progress dots */}
          <div className="flex gap-1 items-center">
            {PROFILE_STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i < profileStepIndex
                    ? "w-4 bg-violet-500"
                    : i === profileStepIndex
                    ? "w-5 bg-violet-700"
                    : "w-1.5 bg-gray-200"
                )}
              />
            ))}
          </div>
        </div>

        {/* Scrollable chat history + current step */}
        <div
          ref={profileScrollRef}
          className="flex-1 overflow-y-auto px-4 py-6"
          style={{ paddingBottom: hasFixedComposer ? "104px" : "max(env(safe-area-inset-bottom, 0px), 24px)" }}
        >
          {/* Completed steps shown as history — same crescendo pattern as
              ProposePlanPage: most-recent largest/clearest, older entries
              smaller and fainter. Tap any past answer to jump back and edit it. */}
          {profileStepIndex > 0 && (
            <div className="space-y-4 mb-6">
              {PROFILE_STEPS.slice(0, profileStepIndex).map((s, i) => {
                const stepsBack = profileStepIndex - i;
                const opacity = stepsBack === 1 ? "opacity-80" : stepsBack === 2 ? "opacity-70" : "opacity-60";
                const labelSize = stepsBack === 1 ? "text-sm" : stepsBack === 2 ? "text-xs" : "text-[11px]";
                const answerSize =
                  stepsBack === 1 ? "text-xl" : stepsBack === 2 ? "text-base" : stepsBack === 3 ? "text-sm" : "text-xs";
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStep(s)}
                    className={cn("w-full text-left space-y-0.5 transition-all hover:opacity-90 active:opacity-100", opacity)}
                  >
                    <p className={cn("text-muted-foreground leading-tight", labelSize)}>{PROFILE_BOT_QUESTIONS[s]}</p>
                    <p className={cn("font-semibold text-foreground leading-tight", answerSize)}>{getProfileStepAnswer(s)}</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Current step bot bubble */}
          <BotBubble
            message={PROFILE_BOT_QUESTIONS[currentProfileStep]}
            subtext={PROFILE_BOT_SUBTEXTS[currentProfileStep]}
            avatarColor={STEP_AVATAR_COLORS[currentProfileStep]}
          />

          {/* Step-specific input UI — only for steps with taller custom UI.
              Simple single-input steps render in the fixed bottom composer below. */}

          {currentProfileStep === "interests" && (
            <OnboardingInterestsStep
              selected={selectedInterests}
              onToggle={(interest) => {
                if (selectedInterests.includes(interest)) {
                  setSelectedInterests((prev) => prev.filter((i) => i !== interest));
                } else {
                  setSelectedInterests((prev) => [...prev, interest]);
                }
              }}
              onContinue={advanceProfileStep}
              onSkip={advanceProfileStep}
            />
          )}

          {currentProfileStep === "social" && (
            <OnboardingSocialStep
              instagramUrl={instagramUrl}
              linkedinUrl={linkedinUrl}
              twitterUrl={twitterUrl}
              onChangeInstagram={setInstagramUrl}
              onChangeLinkedin={setLinkedinUrl}
              onChangeTwitter={setTwitterUrl}
              onDone={advanceProfileStep}
              onSkip={advanceProfileStep}
              isSaving={isLoading}
            />
          )}
        </div>

        {/* Fixed bottom composer — chat-style input for simple single-answer
            steps, matching ProposePlanPage. Always the same "up arrow" submit
            affordance; only the question and input type change per step. */}
        {hasFixedComposer && (
          <div
            className="fixed left-0 right-0 bottom-0 z-20 bg-background/95 backdrop-blur border-t border-border/40 px-4 pt-3"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }}
          >
            {currentProfileStep === "name" && (
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNameContinue()}
                    className="w-full h-14 pl-10 pr-4 rounded-2xl border border-border bg-muted/60 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500/40"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={handleNameContinue}
                  disabled={!name.trim()}
                  className="w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-40 text-white shrink-0 transition-opacity hover:opacity-90 bg-black"
                  aria-label="Continue"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
            )}

            {currentProfileStep === "birthday" && (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <BirthdayPicker value={dateOfBirth} onChange={setDateOfBirth} maxDate={getMaxDate()} />
                </div>
                <button
                  type="button"
                  onClick={handleBirthdayContinue}
                  disabled={!dateOfBirth}
                  className="w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-40 text-white shrink-0 transition-opacity hover:opacity-90 bg-black"
                  aria-label="Continue"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
            )}

            {currentProfileStep === "phone" && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && advanceProfileStep()}
                    className="flex-1 h-14 px-5 rounded-2xl border border-border bg-muted/60 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500/40"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={advanceProfileStep}
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white shrink-0 transition-opacity hover:opacity-90 bg-black"
                    aria-label="Continue"
                  >
                    <ArrowUp className="w-5 h-5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={advanceProfileStep}
                  className="text-sm text-muted-foreground underline underline-offset-2 w-full text-center"
                >
                  Skip
                </button>
              </div>
            )}

            {currentProfileStep === "gender" && (
              <div className="flex gap-3 justify-center pb-1">
                {([
                  { value: "woman", label: "Woman" },
                  { value: "man", label: "Man" },
                  { value: "other", label: "Other" },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setGender(option.value);
                      // Brief visual confirmation before advancing
                      setTimeout(() => {
                        setGender(option.value);
                        advanceProfileStep();
                      }, 180);
                    }}
                    className={cn(
                      "px-5 py-3.5 rounded-full text-base font-medium border transition-all",
                      gender === option.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-muted/60 text-foreground border-border hover:border-blue-400"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {currentProfileStep === "nationality" && (
              <div className="space-y-2 pb-1">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <NationalitySelector
                      value={nationality}
                      onChange={(value) => {
                        setNationality(value);
                        setNationalityInteracted(true);
                        setNationalityError(validateNationality(value, true));
                      }}
                      placeholder="Select your nationality"
                      onOpenChange={(open) => {
                        if (open) {
                          setNationalityInteracted(true);
                          setNationalityError(validateNationality(nationality, true));
                        }
                      }}
                      onSearchChange={() => {
                        if (!nationalityInteracted) setNationalityInteracted(true);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleNationalityContinue}
                    disabled={!nationality.trim()}
                    className="w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-40 text-white shrink-0 transition-opacity hover:opacity-90 bg-black"
                    aria-label="Continue"
                  >
                    <ArrowUp className="w-5 h-5" />
                  </button>
                </div>
                {nationalityError && <p className="text-xs text-destructive">{nationalityError}</p>}
              </div>
            )}

            {currentProfileStep === "occupation" && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">💼</span>
                    <input
                      type="text"
                      placeholder="e.g. Software Engineer, Designer, Student"
                      value={occupation}
                      onChange={(e) => {
                        const next = e.target.value;
                        setOccupation(next);
                        if (occupationTouched) setOccupationError(validateOccupation(next));
                      }}
                      onBlur={() => {
                        setOccupationTouched(true);
                        setOccupationError(validateOccupation(occupation));
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleOccupationContinue()}
                      className="w-full h-14 pl-10 pr-4 rounded-2xl border border-border bg-muted/60 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500/40"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleOccupationContinue}
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white shrink-0 transition-opacity hover:opacity-90 bg-black"
                    aria-label="Continue"
                  >
                    <ArrowUp className="w-5 h-5" />
                  </button>
                </div>
                {occupationError && <p className="text-xs text-destructive">{occupationError}</p>}
                <button
                  type="button"
                  onClick={() => { setOccupation(""); advanceProfileStep(); }}
                  className="text-sm text-muted-foreground underline underline-offset-2 w-full text-center"
                >
                  Skip
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  // ── End profile setup ──────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-white overflow-hidden">
      {step === 'confirmation' && (
        <>
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-b from-violet-100/45 via-purple-50/35 to-white" />
            {fallingStars.map((star) => (
              <span
                key={star.id}
                className="absolute text-violet-500"
                style={{
                  left: `${star.left}%`,
                  top: "-10%",
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  fontSize: `${star.size * 1.8}px`,
                  lineHeight: 1,
                  opacity: star.opacity,
                  animation: `fallStar ${star.duration}s linear ${star.delay}s infinite, twinkleStar ${star.twinkleDuration}s ease-in-out ${star.twinkleDelay}s infinite`,
                }}
              >
                ✦
              </span>
            ))}
          </div>
          <style>{`
            @keyframes fallStar {
              0% {
                transform: translateY(-8vh) translateX(0);
              }
              100% {
                transform: translateY(110vh) translateX(8px);
              }
            }

            @keyframes twinkleStar {
              0%,
              100% {
                opacity: 0.25;
                transform: scale(0.85);
              }
              50% {
                opacity: 1;
                transform: scale(1.2);
              }
            }
          `}</style>
        </>
      )}
      <div
        className={`relative z-10 flex-1 flex flex-col items-center px-4 ${
          step === 'method' ? 'justify-center py-8' : 'justify-center py-8'
        }`}
      >
        <div className="w-full max-w-md px-6 sm:px-0 space-y-6">
          {/* Back Button */}
          {step !== "method" && step !== "confirmation" && step !== "setPassword" && step !== "resetPassword" && (
            <MinimalBackButton
              onClick={() => {
                setStep('method');
                setShowEmailLogin(false);
                setEmail("");
                setPassword("");
                setConfirmPassword("");
              }}
              aria-label="Back"
              className="absolute top-[60px] left-4 text-gray-900 hover:text-gray-600"
              iconClassName="w-4 h-4"
            />
          )}

          {/* Method Selection */}
          {step === 'method' && (
            <div className="space-y-4">
              <div className="space-y-2 text-center">
                <img src={logoShake} alt="SHAKE" className="h-20 w-20 mx-auto mb-8" />
                <h1 className="text-2xl font-bold text-black">{t('auth.welcomeTitle', 'Welcome to SHAKE')}</h1>
                <p className="text-muted-foreground">{t('auth.loginOrCreate', 'Log In or create your account')}</p>
              </div>

              <div className="space-y-3">
                {!showEmailLogin && (
                  <>
                    <Button
                      onClick={() => signInWithOAuth('google')}
                      variant="outline"
                      className="w-full border-2 border-gray-300 text-gray-900 hover:text-white"
                      size="lg"
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none">
                        <g clipPath="url(#clip0)">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </g>
                      </svg>
                      {t('auth.googleBtn', 'Google')}
                    </Button>

                    <Button
                      onClick={() => signInWithOAuth('apple')}
                      variant="outline"
                      className="w-full border-2 border-gray-300 text-gray-900 hover:text-white"
                      size="lg"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="mr-2">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      {t('auth.appleBtn', 'Apple')}
                    </Button>
                  </>
                )}

                {!showEmailLogin && (
                  <Button
                    onClick={() => {
                      setStep("email");
                    }}
                    className="w-full text-white animate-gradient-shift hover:opacity-95"
                    size="lg"
                  >
                    <Mail className="w-4 h-4 mr-2 text-white" />
                    {t('auth.createAccount', 'Create Account')}
                  </Button>
                )}

                {!showEmailLogin ? (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setShowEmailLogin(true)}
                      className="text-sm text-gray-900 hover:text-gray-500"
                    >
                      {t('auth.loginWithEmail', 'Login with email')}
                    </button>
                  </div>
                ) : (
                  <form ref={emailLoginFormRef} onSubmit={handleSignInWithPassword} className="space-y-3 rounded-2xl border border-border/60 p-4 bg-white/90">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-black">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 bg-gray-100 text-gray-900 placeholder:text-gray-400 border-gray-200"
                          required
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-black">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10 bg-gray-100 text-gray-900 placeholder:text-gray-400 border-gray-200"
                          required
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setShowPassword((s) => !s)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gray-800 text-white hover:bg-gray-700"
                      size="lg"
                      disabled={isLoading}
                    >
                      <Mail className="w-4 h-4 mr-2 text-white" />
                      {isLoading ? "Logging in..." : "Login"}
                    </Button>

                    <div className="text-center space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStep("forgotPassword");
                          setShowEmailLogin(false);
                        }}
                        className="text-sm text-gray-900 hover:text-gray-600"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="pt-4 flex justify-center">
                <LanguageSelector />
              </div>
            </div>
          )}

          {/* Sign up: verify email with magic link, then create password on return */}
          {step === "email" && (
            <form onSubmit={handleSendMagicLink} className="space-y-4">
              <div className="space-y-2 text-center">
                <img src={catHead} alt="" className="w-20 h-20 mx-auto object-contain" />
                <h2 className="text-xl font-bold text-black">Verify your email</h2>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-black">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-gray-100 text-gray-900 placeholder:text-gray-400 border-gray-200"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full text-white animate-gradient-shift hover:opacity-95"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : "Send verification link"}
              </Button>
            </form>
          )}

          {step === "setPassword" && (
            <form onSubmit={handleCompleteSignupPassword} className="space-y-4">
              <div className="space-y-2 text-center">
                <img src={manHead} alt="" className="w-20 h-20 mx-auto object-contain" />
                <h2 className="text-xl font-bold text-black">Set your password</h2>
                <p className="text-sm text-white/80">
                  Choose a password for <span className="font-medium">{user?.email ?? email}</span>. You&apos;ll use it
                  next time you log in.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    minLength={6}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm-new-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    minLength={6}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowConfirmPassword((s) => !s)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full text-white animate-gradient-shift hover:opacity-95"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save Password"}
              </Button>
            </form>
          )}

          {step === "forgotPassword" && (
            <form onSubmit={handleSendPasswordReset} className="space-y-4">
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-bold text-black">Forgot password?</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-black">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-gray-100 text-gray-900 placeholder:text-gray-400 border-gray-200"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gray-800 text-white hover:bg-gray-700"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          )}

          {step === "resetPassword" && (
            <form onSubmit={handleCompleteResetPassword} className="space-y-4">
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-bold text-black">Set new password</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your new password and confirm it.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-new-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="reset-new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    minLength={6}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="reset-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    minLength={6}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowConfirmPassword((s) => !s)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full text-white"
                style={{ background: "linear-gradient(to right, #6D28D9, #4F46E5)" }}
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save Password"}
              </Button>
            </form>
          )}

          {/* Confirmation Screen */}
          {step === 'confirmation' && (
            <div className="space-y-6 text-center">
              <div className="space-y-3 text-center">
                <img src={dogHead} alt="" className="w-20 h-20 mx-auto object-contain animate-shake-x" />
                <h2 className="text-xl font-bold text-black">Check your email</h2>
                <p className="text-sm text-muted-foreground">
                  {confirmationKind === "reset"
                    ? "We've sent you a password reset link."
                    : "We've sent you a sign-in link."}
                </p>
              </div>

              <Button
                onClick={() => {
                  setStep('method');
                  setShowEmailLogin(false);
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="w-full text-white animate-gradient-shift hover:opacity-95"
                size="lg"
              >
                Back to Log In
              </Button>
            </div>
          )}

        </div>
      </div>


      {FACE_ID_FEATURE_ENABLED && (
        <>
          <AlertDialog open={showFaceSetupPrompt} onOpenChange={setShowFaceSetupPrompt}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Set up Face ID for faster login next time?</AlertDialogTitle>
                <AlertDialogDescription>
                  You can skip now and enable it later from your profile settings.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={async () => {
                    setShowFaceSetupPrompt(false);
                    setPendingFaceSetupUserId(null);
                    await navigateHome();
                  }}
                >
                  Skip
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setShowFaceSetupPrompt(false);
                    setFaceMode('enroll');
                    setIsFaceCaptureOpen(true);
                  }}
                >
                  Yes
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <FaceCaptureModal
            open={isFaceCaptureOpen}
            mode={faceMode}
            onSuccess={handleFaceCaptureSuccess}
            onCancel={() => {
              setIsFaceCaptureOpen(false);
              if (faceMode === 'enroll') {
                setPendingFaceSetupUserId(null);
              }
            }}
          />
        </>
      )}
    </div>
  );
}
