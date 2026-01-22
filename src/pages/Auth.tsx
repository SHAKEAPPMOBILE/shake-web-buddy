import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoShake from "@/assets/shake-logo-new.png";
import { ArrowLeft, ChevronDown, Phone, User, Instagram, Linkedin, Twitter, Lock, Eye, EyeOff } from "lucide-react";
import { BirthdayPicker } from "@/components/BirthdayPicker";
import { AvatarPicker, avatarOptions } from "@/components/AvatarPicker";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { countryCodes, CountryCode } from "@/data/countryCodes";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { NationalitySelector } from "@/components/NationalitySelector";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'method' | 'phone' | 'otp' | 'name' | 'nationality' | 'occupation' | 'social' | 'avatar' | 'password' | 'forgot' | 'reset'>('method');
  const [isLogin, setIsLogin] = useState(() => searchParams.get('mode') !== 'signup');
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usePasswordLogin, setUsePasswordLogin] = useState(() => searchParams.get('mode') !== 'signup');
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationality, setNationality] = useState("");
  const [occupation, setOccupation] = useState("");
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
  const { user, signUpWithPhone, signInWithPhone, signInWithPassword, signInWithGoogle, updatePassword, verifyOtp } = useAuth();
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
      
      // Send OTP
      const { error } = await signInWithPhone(formattedPhone);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Verification code sent!");
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
      const { error } = await signInWithPhone(formattedPhone);
      
      if (error) {
        toast.error(error.message);
      } else {
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
      const { error } = await verifyOtp(formattedPhone, otpCode);
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
      const { error } = await updatePassword(password);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated! You're now logged in.");
        navigate("/");
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

      // Save date of birth to profiles_private
      const { error: privateError } = await supabase
        .from("profiles_private")
        .update({ date_of_birth: dateOfBirth })
        .eq("user_id", currentUser.id);

      if (privateError) {
        console.error("Error saving date of birth:", privateError);
      }

      // Trigger confetti celebration!
      triggerConfettiWaterfall();
      
      toast.success("Welcome to Shake! 🎉");
      navigate("/");
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
      const { error } = await verifyOtp(formattedPhone, otpCode);
      if (error) {
        toast.error(error.message);
      } else {
        // Check if user has completed their profile
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (currentUser) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", currentUser.id)
            .maybeSingle();

          // If profile has no name, this is a new user
          if (!profile?.name) {
            // If password was set during signup, save it now and go to profile
            if (password && password.length >= 6) {
              const { error: pwError } = await updatePassword(password);
              if (pwError) {
                console.error("Error setting password:", pwError);
              }
              toast.success("Phone verified! Now complete your profile.");
              setStep('name');
            } else {
              // Fallback to old flow if no password was set
              toast.success("Phone verified! Now set a password.");
              setStep('password');
            }
          } else {
            toast.success("Welcome!");
            navigate("/");
          }
        } else {
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
    <div className="min-h-screen bg-white flex flex-col overflow-hidden fixed inset-0">
      {/* Background effects - only show for non-method steps */}
      {step !== 'method' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full overflow-hidden px-4 py-6 sm:py-10">
        <button
          onClick={handleBack}
          className="fixed flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors z-50 p-2"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + clamp(0.5rem, 2.2vh, 1.25rem))",
            left: "calc(env(safe-area-inset-left, 0px) + clamp(0.5rem, 2.2vw, 1.25rem))",
          }}
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
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
          <div className="flex-1 min-h-0 overflow-y-auto pt-[clamp(0.75rem,2vh,2rem)]">
            {/* Method selection step - clean white background with centered options */}
            {step === 'method' && (
              <div className="flex flex-col items-center justify-center h-full gap-6 animate-fade-in">
                <img 
                  src={logoShake} 
                  alt="SHAKE" 
                  className="w-20 h-20 sm:w-24 sm:h-24 object-contain mb-2"
                />
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-display font-bold text-black tracking-wider">SHAKE</h1>
                  <p className="text-lg font-display font-medium text-gray-600 tracking-[0.3em] mt-1">SOCIAL</p>
                </div>
                
                {/* Continue with Google */}
                <button
                  type="button"
                  onClick={async () => {
                    setIsLoading(true);
                    const { error } = await signInWithGoogle();
                    if (error) {
                      toast.error(error.message);
                    }
                    setIsLoading(false);
                  }}
                  disabled={isLoading}
                  className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-3 rounded-full border border-gray-300 bg-transparent hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="text-gray-700 font-medium">Continue with Google</span>
                </button>

                {/* Continue with Phone - Login */}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setUsePasswordLogin(true);
                    setStep('phone');
                  }}
                  className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-3 rounded-full border border-gray-300 bg-transparent hover:bg-gray-50 transition-colors"
                >
                  <Phone className="w-5 h-5 text-gray-600" />
                  <span className="text-gray-700 font-medium">Sign in with Phone</span>
                </button>

                {/* Create Account with Phone - Signup */}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setUsePasswordLogin(false);
                    setStep('phone');
                  }}
                  className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-3 rounded-full bg-black text-white hover:bg-gray-800 transition-colors"
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">Create an Account</span>
                </button>
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
                              <span className="flex-1 text-left">{country.name}</span>
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
                              <span className="flex-1 text-left">{country.name}</span>
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
                    const { error } = await signInWithPhone(formatPhoneNumber(phoneNumber));
                    if (error) {
                      toast.error(error.message);
                    } else {
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
              setStep('occupation');
            }} className="space-y-6">
              <div className="space-y-2">
                <Label>Nationality</Label>
                <NationalitySelector
                  value={nationality}
                  onChange={setNationality}
                  placeholder="Select your nationality"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  size="lg"
                  onClick={() => setStep('occupation')}
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
                    onChange={(e) => setOccupation(e.target.value)}
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
                    const { error } = await signInWithPhone(formatPhoneNumber(phoneNumber));
                    if (error) {
                      toast.error(error.message);
                    } else {
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

          {/* Toggle - only show on phone step */}
          {step === 'phone' && (
            <p className="text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline font-medium"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          )}

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
