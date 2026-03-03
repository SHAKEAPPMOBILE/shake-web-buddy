import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Browser } from "@capacitor/browser";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoShake from "@/assets/shake-logo-new.png";
import { ArrowLeft, ChevronDown, Phone, User, Instagram, Linkedin, Twitter, Lock, Eye, EyeOff, Mail } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { BirthdayPicker } from "@/components/BirthdayPicker";
import { AvatarPicker, avatarOptions } from "@/components/AvatarPicker";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { countryCodes, CountryCode } from "@/data/countryCodes";
import { isAfricanCountry, getSmsAvailabilityMessage } from "@/data/smsEnabledCountries";
import { z } from "zod";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { NationalitySelector } from "@/components/NationalitySelector";
import { isNativePlatform } from "@/lib/platform-utils";

// OAuth: on web (including mobile browser) use redirect flow; on native app use Capacitor Browser
async function signInWithOAuth(provider: 'google' | 'apple') {
  try {
    if (isNativePlatform()) {
      // Native app: open OAuth in Capacitor Browser, return via deep link
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: 'com.shakeapp.shakeapp://auth/callback',
          skipBrowserRedirect: true,
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
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : "https://shake-web-app.netlify.app/auth/callback";
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) throw error;
      // Supabase will redirect the window to the provider; no need to do anything else
    }
  } catch (error) {
    console.error(`OAuth error (${provider}):`, error);
    toast.error(`Failed to sign in with ${provider}`);
  }
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'method' | 'phone' | 'otp' | 'name' | 'nationality' | 'occupation' | 'social' | 'avatar' | 'password' | 'forgot' | 'reset'>('method');
  const [isLogin, setIsLogin] = useState(() => searchParams.get('mode') !== 'signup');
  const [authMethod, setAuthMethod] = useState<'phone'>('phone');
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usePasswordLogin, setUsePasswordLogin] = useState(() => searchParams.get('mode') !== 'signup');
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationality, setNationality] = useState("");
  const [nationalityInteracted, setNationalityInteracted] = useState(false);
  const [nationalityError, setNationalityError] = useState<string | null>(null);
  const [occupation, setOccupation] = useState("");
  const [occupationTouched, setOccupationTouched] = useState(false);
  const [occupationError, setOccupationError] = useState<string | null>(null);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    countryCodes.find(c => c.code === "PT") || countryCodes[0]
  );
  const [countrySearchOpen, setCountrySearchOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const { user, sendOtp, signInWithPassword, updatePassword, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
    // Keep it permissive: prevent extreme values; actual value comes from selector.
    if (trimmed.length > 60) return "Please keep it under 60 characters";
    return null;
  };

  const getMaxDate = (): string => {
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    return maxDate.toISOString().split('T')[0];
  };

  // Auto-detect user's country on mount
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.country_code) {
          const detectedCountry = countryCodes.find(
            c => c.code === data.country_code
          );
          if (detectedCountry) {
            setSelectedCountry(detectedCountry);
          }
        }
      } catch (error) {
        // Silently fail, keep default country
        console.log('Could not detect country, using default');
      }
    };
    detectCountry();
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // After any sign-in (including Google), route new users into profile completion
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    setTimeout(() => {
      (async () => {
        const [{ data: profile }, { data: profilePrivate }] = await Promise.all([
          supabase
            .from("profiles")
            .select("name")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("profiles_private")
            .select("date_of_birth")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const needsProfile = !profile?.name || !profilePrivate?.date_of_birth;

        if (needsProfile) {
          setIsLogin(false);
          setUsePasswordLogin(false);
          setStep("name");

          // Prefill name from Google if available
          setName((prev) =>
            prev ||
            String(
              (user.user_metadata?.full_name ??
                user.user_metadata?.name ??
                "") as string
            )
          );
        } else {
          navigate("/");
        }
      })().catch(() => {
        // If anything fails, don't block the user
      });
    }, 0);

    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

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

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Combine with selected country dial code
    return selectedCountry.dialCode + cleaned;
  };

  const filteredCountries = countryCodes.filter(country =>
    country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    country.dialCode.includes(countrySearch) ||
    country.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const validatePhoneNumber = (phone: string): { isValid: boolean; error?: string } => {
    const cleaned = phone.replace(/\D/g, '');
    
    // Check if empty
    if (!cleaned) {
      return { isValid: false, error: "Please enter your phone number" };
    }
    
    // Check minimum length (at least 6 digits for the number itself)
    if (cleaned.length < 6) {
      return { isValid: false, error: "Phone number is too short" };
    }
    
    // Check maximum length (max 15 digits per E.164 standard, minus country code)
    if (cleaned.length > 12) {
      return { isValid: false, error: "Phone number is too long" };
    }
    
    return { isValid: true };
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    // For signup, also validate password
    if (!isLogin) {
      if (!password || password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
    }

    setIsLoading(true);

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      // For signup, check if phone number already exists
      if (!isLogin) {
        const { data: existingProfile } = await supabase
          .from("profiles_private")
          .select("phone_number")
          .eq("phone_number", formattedPhone)
          .maybeSingle();
        
        if (existingProfile) {
          toast.info("You already have an account, please login instead");
          setIsLogin(true);
          setUsePasswordLogin(true);
          setStep('phone');
          setPassword("");
          setConfirmPassword("");
          setOtpCode("");
          setIsLoading(false);
          return;
        }
      }
      
      // Send OTP via Bird WhatsApp
      const { error, verificationId: vId } = await sendOtp(formattedPhone, isLogin ? "login" : "signup");
      if (error) {
        toast.error(error.message);
      } else {
        setVerificationId(vId || "");
        toast.success("Verification code sent via WhatsApp!");
        setResendCountdown(60);
        setStep('otp');
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validatePhoneNumber(phoneNumber);
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
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const { error } = await signInWithPassword(formattedPhone, password);
      
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid phone number or password");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Welcome!");
        navigate("/");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      toast.error("Please enter your phone number first");
      return;
    }

    setIsLoading(true);

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const { error, verificationId: vId } = await sendOtp(formattedPhone, "forgot_password");
      
      if (error) {
        toast.error(error.message);
      } else {
        setVerificationId(vId || "");
        toast.success("Verification code sent to reset your password!");
        setResendCountdown(60);
        setStep('forgot');
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyForPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otpCode.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setIsLoading(true);

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const { error } = await verifyOtp(formattedPhone, otpCode, verificationId, { purpose: "forgot_password" });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Phone verified! Now set your new password.");
        setStep('reset');
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
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
      const formattedPhone = formatPhoneNumber(phoneNumber);
      // Use verify-bird-otp with password to reset it server-side
      const { error } = await verifyOtp(formattedPhone, otpCode, verificationId, {
        purpose: "forgot_password",
        password,
      });
      if (error) {
        toast.error(error.message);
      } else {
        // Sign in with the new password
        const { error: signInError } = await signInWithPassword(formattedPhone, password);
        if (signInError) {
          toast.error(signInError.message);
        } else {
          toast.success("Password updated! You're now logged in.");
          navigate("/");
        }
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (!dateOfBirth) {
      toast.error("Please enter your date of birth");
      return;
    }

    const age = calculateAge(dateOfBirth);
    if (age < 18) {
      toast.error("You must be 18 or older to use Shake");
      return;
    }

    if (!selectedAvatar) {
      toast.error("Please choose a profile picture or avatar");
      return;
    }

    // Validate optional fields before saving
    const occError = validateOccupation(occupation);
    if (occError) {
      toast.error(`Occupation: ${occError}`);
      return;
    }

    setIsLoading(true);

    try {
      // Get the current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        toast.error("User not found");
        return;
      }

      // Build profile data with name and avatar
      let avatarUrl: string | undefined;

      // If a preset avatar is selected, get the actual image source
      if (selectedAvatar && selectedAvatar !== "custom") {
        const presetAvatar = avatarOptions.find(a => a.id === selectedAvatar);
        if (presetAvatar) {
          avatarUrl = presetAvatar.src;
        }
      } else if (selectedAvatar === "custom" && customAvatarPreview) {
        // Upload custom avatar
        const response = await fetch(customAvatarPreview);
        const blob = await response.blob();
        const fileExt = 'jpg';
        const filePath = `${currentUser.id}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, blob, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);
          avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        }
      }

      // Use upsert to handle both new and existing profiles
      const { error } = await supabase
        .from("profiles")
        .upsert({
          user_id: currentUser.id,
          name: name.trim(),
          avatar_url: avatarUrl,
          nationality: nationality.trim() || null,
          occupation: occupation.trim() || null,
          instagram_url: instagramUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          twitter_url: twitterUrl.trim() || null
        }, { onConflict: 'user_id' });

      if (error) throw error;

      // Save date of birth and optional email to profiles_private
      const privateUpdateData: { date_of_birth: string; billing_email?: string } = { 
        date_of_birth: dateOfBirth 
      };
      if (email.trim()) {
        privateUpdateData.billing_email = email.trim();
      }
      
      const { error: privateError } = await supabase
        .from("profiles_private")
        .update(privateUpdateData)
        .eq("user_id", currentUser.id);

      if (privateError) {
        console.error("Error saving private profile:", privateError);
      }

      // Trigger confetti celebration!
      triggerConfettiWaterfall();
      
      toast.success("Welcome to Shake! 🎉");
      navigate("/welcome");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otpCode.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setIsLoading(true);

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const purpose = isLogin ? "login" : "signup";
      const { error, data } = await verifyOtp(formattedPhone, otpCode, verificationId, {
        purpose,
        password: !isLogin ? password : undefined,
        name: !isLogin ? name : undefined,
      });
      if (error) {
        toast.error(error.message);
      } else {
        if (purpose === "signup") {
          // Signup: user created server-side, now sign in with password
          const { error: signInError } = await signInWithPassword(formattedPhone, password);
          if (signInError) {
            toast.error(signInError.message);
          } else {
            toast.success("Phone verified! Now complete your profile.");
            setStep('name');
          }
        } else {
          // Login OTP verified — sign in with password
          toast.success("Welcome!");
          navigate("/");
        }
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
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
        toast.error(error.message);
      } else {
        toast.success("Password set! Now complete your profile.");
        setStep('name');
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'phone') {
      setStep('method');
      setPhoneNumber("");
    } else if (step === 'otp') {
      setStep('phone');
      setOtpCode("");
    } else if (step === 'forgot') {
      setStep('phone');
      setOtpCode("");
    } else if (step === 'reset') {
      setStep('phone');
      setPassword("");
      setConfirmPassword("");
    } else if (step === 'password') {
      // After OTP verification, don't allow going back
      navigate("/");
    } else if (step === 'name') {
      // For signup, after password set, don't allow going back
      navigate("/");
    } else if (step === 'nationality') {
      setStep('name');
    } else if (step === 'occupation') {
      setStep('nationality');
    } else if (step === 'social') {
      setStep('occupation');
    } else if (step === 'avatar') {
      setStep('social');
    } else if (step === 'method') {
      navigate("/");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="h-[100dvh] bg-white flex flex-col overflow-hidden safe-area-top safe-area-bottom">

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full overflow-hidden px-4 py-6 sm:py-10 touch-manipulation">
        <button
          onClick={handleBack}
          className="fixed z-50 pointer-events-auto active:scale-90 transition-transform"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + clamp(0.5rem, 2.2vh, 1.25rem))",
            left: "calc(env(safe-area-inset-left, 0px) + clamp(0.5rem, 2.2vw, 1.25rem))",
          }}
          aria-label="Go back"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <polyline points="15 18 9 12 15 6" stroke="#1a1814" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="w-full max-w-md px-2 flex flex-col flex-1 min-h-0">
          {/* Fixed logo/header (so only the form scrolls on short screens) */}
          {step !== 'method' && (
            <div className="shrink-0 pt-[clamp(0.25rem,1.2vh,0.75rem)]">
              <div className="flex flex-col items-center">
                <img
                  src={logoShake}
                  alt="SHAKE"
                  className="h-[clamp(4.25rem,14vh,7rem)] w-auto object-contain mb-[clamp(0.4rem,1.2vh,0.75rem)]"
                />
                <div className="text-center">
                  <h1 className="text-3xl font-display font-bold text-black tracking-wider">SHAKE</h1>
                  <p className="text-lg font-display font-medium text-gray-600 tracking-[0.3em] mt-1">SOCIAL</p>
                </div>
              </div>
            </div>
          )}

          {/* Scrollable content area (only when needed) */}
          <div className="flex-1 min-h-0 overflow-y-auto pt-[clamp(0.75rem,2vh,2rem)] touch-manipulation">
            {/* Method selection step - clean white background with centered options */}
            {step === 'method' && (
              <div className="flex flex-col items-center justify-center h-full gap-6 animate-fade-in pointer-events-auto">
                <img 
                  src={logoShake} 
                  alt="SHAKE" 
                  className="w-20 h-20 sm:w-24 sm:h-24 object-contain mb-2"
                />
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-display font-bold text-black tracking-wider">SHAKE</h1>
                  <p className="text-lg font-display font-medium text-gray-600 tracking-[0.3em] mt-1">SOCIAL</p>
                </div>
                {/* Sign in with Phone */}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setAuthMethod('phone');
                    setUsePasswordLogin(true);
                    setStep('phone');
                  }}
                  className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-3 rounded-full border border-gray-300 bg-transparent hover:bg-gray-50 transition-colors pointer-events-auto active:scale-95"
                >
                  <Phone className="w-5 h-5 text-gray-600" />
                  <span className="text-gray-700 font-medium">Sign in with Phone</span>
                </button>

                {/* Create Account */}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setAuthMethod('phone');
                    setUsePasswordLogin(false);
                    setStep('phone');
                  }}
                  className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-3 rounded-full bg-black text-white hover:bg-gray-800 transition-colors pointer-events-auto active:scale-95"
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">Create an Account</span>
                </button>

                <div className="flex items-center gap-3 w-full max-w-xs">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <button
                  type="button"
                  onClick={() => signInWithOAuth('google')}
                  className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-3 rounded-full border border-gray-300 bg-white hover:bg-gray-50 transition-colors pointer-events-auto active:scale-95"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
                  <span className="text-gray-700 font-medium">Continue with Google</span>
                </button>
                <button
                  type="button"
                  onClick={() => signInWithOAuth('apple')}
                  className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-3 rounded-full bg-black text-white hover:bg-gray-900 transition-colors pointer-events-auto active:scale-95"
                >
                  <svg width="18" height="18" viewBox="0 0 814 1000" fill="white"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.8 0 663.9 0 541.3c0-195.3 127.4-298.5 252.3-298.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/></svg>
                  <span className="font-medium">Continue with Apple</span>
                </button>
                {/* Language Selector */}
                <div className="pt-4">
                  <LanguageSelector showLabel={true} />
                </div>
              </div>
            )}

            {/* Step title */}
            {!(
              step === 'name' ||
              step === 'nationality' ||
              step === 'occupation' ||
              step === 'social' ||
              step === 'avatar' ||
              step === 'method'
            ) && (
              <div className="flex flex-col items-center gap-2 mb-6">
                <h1 className="text-2xl font-display font-bold text-black">
                  {step === 'otp' 
                    ? "Enter verification code" 
                    : step === 'password'
                    ? "Set your password"
                    : step === 'forgot'
                    ? "Reset your password"
                    : step === 'reset'
                    ? "Create new password"
                    : isLogin 
                      ? "Welcome"
                      : "Create your account"}
                </h1>
                <p className="text-gray-600 text-center">
                  {step === 'otp'
                    ? `We sent a code to ${phoneNumber}`
                    : step === 'password'
                    ? "You'll use this to sign in next time"
                    : step === 'forgot'
                    ? `We sent a code to ${phoneNumber}`
                    : step === 'reset'
                    ? "Enter your new password"
                    : isLogin
                      ? (usePasswordLogin ? "Sign in with your password" : "Sign in with your phone number")
                      : "Create your account with your phone number"}
                </p>
              </div>
            )}

            {/* Profile steps header */}
            {(step === 'name' || step === 'social' || step === 'avatar') && (
              <div className="flex flex-col items-center gap-2 mb-6 sm:mb-8">
                <h1 className="text-2xl font-display font-bold text-foreground">
                  {step === 'name'
                    ? "Let's create your profile."
                    : step === 'social'
                    ? "Social Links"
                    : "Profile Picture"}
                </h1>
                <p className="text-muted-foreground text-center">
                  {step === 'social'
                    ? "Connect your social profiles (optional)"
                    : step === 'avatar'
                    ? "Choose an avatar or upload your own"
                    : null}
                </p>
              </div>
            )}
          {/* Phone Number Form - for signup or login with OTP */}
          {step === 'phone' && !usePasswordLogin && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-black">Phone Number</Label>
                <div className="flex gap-2">
                  {/* Country Code Selector */}
                  <Popover open={countrySearchOpen} onOpenChange={setCountrySearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={countrySearchOpen}
                        className="w-[120px] justify-between px-3 bg-white text-foreground hover:bg-gray-50 border-gray-300"
                      >
                        <span className="flex items-center gap-1">
                          <span className="text-lg">{selectedCountry.flag}</span>
                          <span className="text-sm">{selectedCountry.dialCode}</span>
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <div className="p-2 border-b">
                        <Input
                          placeholder="Search country..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {filteredCountries.map((country) => (
                            <button
                              key={country.code}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(country);
                                setCountrySearchOpen(false);
                                setCountrySearch("");
                              }}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent ${
                                selectedCountry.code === country.code ? "bg-accent" : ""
                              }`}
                            >
                              <span className="text-lg">{country.flag}</span>
                              <span className="flex-1 text-left">
                                {country.name}
                              </span>
                              <span className="text-muted-foreground">{country.dialCode}</span>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  
                  {/* Phone Number Input */}
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="123 456 789"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d\s]/g, ''))}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  We'll send you a verification code via SMS
                </p>
                {isAfricanCountry(selectedCountry.code) && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md mt-2">
                    ⚠️ {getSmsAvailabilityMessage(selectedCountry.code)}
                  </p>
                )}
              </div>

              {/* Password fields for signup */}
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-black">Create Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password" className="text-black">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : "Send Code"}
              </Button>

              {isLogin && (
                <button
                  type="button"
                  onClick={() => setUsePasswordLogin(true)}
                  className="w-full text-sm text-primary hover:underline"
                >
                  Sign in with password instead
                </button>
              )}
            </form>
          )}

          {/* Password Login Form */}
          {step === 'phone' && usePasswordLogin && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone-password" className="text-black">Phone Number</Label>
                <div className="flex gap-2">
                  {/* Country Code Selector */}
                  <Popover open={countrySearchOpen} onOpenChange={setCountrySearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={countrySearchOpen}
                        className="w-[120px] justify-between px-3 bg-white text-foreground hover:bg-gray-50 border-gray-300"
                      >
                        <span className="flex items-center gap-1">
                          <span className="text-lg">{selectedCountry.flag}</span>
                          <span className="text-sm">{selectedCountry.dialCode}</span>
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <div className="p-2 border-b">
                        <Input
                          placeholder="Search country..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {filteredCountries.map((country) => (
                            <button
                              key={country.code}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(country);
                                setCountrySearchOpen(false);
                                setCountrySearch("");
                              }}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent ${
                                selectedCountry.code === country.code ? "bg-accent" : ""
                              }`}
                            >
                              <span className="text-lg">{country.flag}</span>
                              <span className="flex-1 text-left">
                                {country.name}
                              </span>
                              <span className="text-muted-foreground">{country.dialCode}</span>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  
                  {/* Phone Number Input */}
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone-password"
                      type="tel"
                      placeholder="123 456 789"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d\s]/g, ''))}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-black">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>


              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-muted-foreground hover:text-primary"
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUsePasswordLogin(false);
                    setPassword("");
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Sign in with SMS code instead
                </button>
              </div>
            </form>
          )}

          {/* Password Setup Form (after OTP verification during signup) */}
          {step === 'password' && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password (min. 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-shake-yellow text-background hover:bg-shake-yellow/90"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Setting password..." : "Set Password & Continue"}
              </Button>
            </form>
          )}

          {/* Forgot Password OTP Verification */}
          {step === 'forgot' && (
            <form onSubmit={handleVerifyForPasswordReset} className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <Label htmlFor="otp-forgot">Verification Code</Label>
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={(value) => setOtpCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <button
                  type="button"
                  disabled={resendCountdown > 0}
                  onClick={async () => {
                    setOtpCode("");
                    const { error, verificationId: vId } = await sendOtp(formatPhoneNumber(phoneNumber));
                    if (error) {
                      toast.error(error.message);
                    } else {
                      setVerificationId(vId || "");
                      toast.success("New code sent!");
                      setResendCountdown(60);
                    }
                  }}
                  className={`text-sm ${resendCountdown > 0 ? 'text-muted-foreground cursor-not-allowed' : 'text-primary hover:underline'}`}
                >
                  {resendCountdown > 0 
                    ? `Resend code in ${resendCountdown}s` 
                    : "Didn't receive a code? Resend"}
                </button>
              </div>

              <Button
                type="submit"
                className="w-full bg-shake-yellow text-background hover:bg-shake-yellow/90"
                size="lg"
                disabled={isLoading || otpCode.length !== 6}
              >
                {isLoading ? "Verifying..." : "Verify & Reset Password"}
              </Button>
            </form>
          )}

          {/* Reset Password Form (after forgot password OTP verification) */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="reset-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a new password (min. 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="reset-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-shake-yellow text-background hover:bg-shake-yellow/90"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}

          {/* Name Form - Step 1 of profile (Signup only) */}
          {step === 'name' && (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) {
                toast.error("Please enter your name");
                return;
              }
              if (!dateOfBirth) {
                toast.error("Please enter your date of birth");
                return;
              }
              const age = calculateAge(dateOfBirth);
              if (age < 18) {
                toast.error("You must be 18 or older to use Shake");
                return;
              }
              // Validate email format if provided
              if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                toast.error("Please enter a valid email address");
                return;
              }
              setStep('nationality');
            }} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Date of Birth */}
              <div className="space-y-2">
                <Label>Date of Birth <span className="text-destructive">*</span></Label>
                <BirthdayPicker
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  maxDate={getMaxDate()}
                />
                <p className="text-xs text-muted-foreground">You must be 18 or older to join</p>
              </div>

              {/* Optional Email */}
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="profile-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Used for account recovery and notifications</p>
              </div>

              <Button
                type="submit"
                className="w-full bg-shake-green text-background hover:bg-shake-green/90"
                size="lg"
              >
                Continue
              </Button>
            </form>
          )}

          {/* Nationality Form - Step 2 of profile */}
          {step === 'nationality' && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const err = validateNationality(nationality, nationalityInteracted);
              setNationalityError(err);
              if (err) return;
              setStep('occupation');
            }} className="space-y-6">
              <div className="space-y-2">
                <Label>Nationality</Label>
                <NationalitySelector
                  value={nationality}
                  onChange={(value) => {
                    setNationality(value);
                    if (nationalityInteracted) {
                      setNationalityError(validateNationality(value, true));
                    }
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
                {nationalityError ? (
                  <p className="text-xs text-destructive">{nationalityError}</p>
                ) : null}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  size="lg"
                  onClick={() => {
                    setNationalityError(null);
                    setStep('occupation');
                  }}
                >
                  Skip
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-shake-green text-background hover:bg-shake-green/90"
                  size="lg"
                >
                  Continue
                </Button>
              </div>
            </form>
          )}

          {/* Occupation Form - Step 3 of profile */}
          {step === 'occupation' && (
            <form onSubmit={(e) => {
              e.preventDefault();
              setOccupationTouched(true);
              const err = validateOccupation(occupation);
              setOccupationError(err);
              if (err) return;
              setStep('social');
            }} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="occupation">Occupation</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">💼</span>
                  <Input
                    id="occupation"
                    type="text"
                    placeholder="e.g. Software Engineer, Designer, Student"
                    value={occupation}
                    onChange={(e) => {
                      const next = e.target.value;
                      setOccupation(next);
                      if (occupationTouched) {
                        setOccupationError(validateOccupation(next));
                      }
                    }}
                    onBlur={() => {
                      setOccupationTouched(true);
                      setOccupationError(validateOccupation(occupation));
                    }}
                    aria-invalid={!!occupationError}
                    aria-describedby={occupationError ? "occupation-error" : undefined}
                    className="pl-10"
                  />
                </div>
                {occupationError ? (
                  <p id="occupation-error" className="text-xs text-destructive">
                    {occupationError}
                  </p>
                ) : null}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  size="lg"
                  onClick={() => setStep('social')}
                >
                  Skip
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-shake-green text-background hover:bg-shake-green/90"
                  size="lg"
                >
                  Continue
                </Button>
              </div>
            </form>
          )}

          {/* Social Links Form - Step 4 of profile */}
          {step === 'social' && (
            <form onSubmit={(e) => {
              e.preventDefault();
              setStep('avatar');
            }} className="space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder="Instagram URL"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="relative">
                  <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder="LinkedIn URL"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="relative">
                  <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder="X (Twitter) URL"
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  size="lg"
                  onClick={() => setStep('avatar')}
                >
                  Skip
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-shake-green text-background hover:bg-shake-green/90"
                  size="lg"
                >
                  Continue
                </Button>
              </div>
            </form>
          )}

          {/* Avatar Picker Form - Step 3 of profile */}
          {step === 'avatar' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <AvatarPicker
                  selectedAvatar={selectedAvatar}
                  onSelectAvatar={setSelectedAvatar}
                  onUploadClick={() => fileInputRef.current?.click()}
                  onCameraClick={() => cameraInputRef.current?.click()}
                  customAvatarPreview={customAvatarPreview}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-shake-green text-background hover:bg-shake-green/90"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Complete Setup"}
              </Button>
            </form>
          )}

          {/* OTP Verification Form */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <Label htmlFor="otp">Verification Code</Label>
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={(value) => setOtpCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <button
                  type="button"
                  disabled={resendCountdown > 0}
                  onClick={async () => {
                    setOtpCode("");
                    const { error, verificationId: vId } = await sendOtp(formatPhoneNumber(phoneNumber), "forgot_password");
                    if (error) {
                      toast.error(error.message);
                    } else {
                      setVerificationId(vId || "");
                      toast.success("New code sent!");
                      setResendCountdown(60);
                    }
                  }}
                  className={`text-sm ${resendCountdown > 0 ? 'text-muted-foreground cursor-not-allowed' : 'text-primary hover:underline'}`}
                >
                  {resendCountdown > 0 
                    ? `Resend code in ${resendCountdown}s` 
                    : "Didn't receive a code? Resend"}
                </button>
              </div>

              <Button
                type="submit"
                className="w-full bg-shake-yellow text-background hover:bg-shake-yellow/90"
                size="lg"
                disabled={isLoading || otpCode.length !== 6}
              >
                {isLoading ? "Verifying..." : "Verify & Continue"}
              </Button>
            </form>
          )}

          {/* Phone step: no sign up/sign in toggle copy */}

          {/* Subtle progress dots for profile creation steps */}
          {(step === 'name' || step === 'social' || step === 'avatar') && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <div className={`w-2 h-2 rounded-full transition-colors ${step === 'name' ? 'bg-primary' : 'bg-primary/30'}`} />
              <div className={`w-2 h-2 rounded-full transition-colors ${step === 'social' ? 'bg-primary' : 'bg-primary/30'}`} />
              <div className={`w-2 h-2 rounded-full transition-colors ${step === 'avatar' ? 'bg-primary' : 'bg-primary/30'}`} />
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
