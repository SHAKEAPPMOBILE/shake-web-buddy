import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoShake from "@/assets/logo_shake_original_color.png";
import { ArrowLeft, ChevronDown, Phone, User } from "lucide-react";
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

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone');
  const [isLogin, setIsLogin] = useState(() => searchParams.get('mode') !== 'signup');
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    countryCodes.find(c => c.code === "PT") || countryCodes[0]
  );
  const [countrySearchOpen, setCountrySearchOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const { signUpWithPhone, signInWithPhone, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
          toast.info("You already have an account! Switching to sign in...");
          setIsLogin(true);
          // Continue with login flow - don't return, just proceed
        }
      }
      
      // For both login and signup, send OTP first
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Please enter your name");
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
          avatar_url: avatarUrl
        }, { onConflict: 'user_id' });

      if (error) throw error;

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
            .single();

          // If profile has no name, this is a new user - show profile setup
          if (!profile?.name) {
            toast.success("Phone verified! Now set up your profile.");
            setStep('name');
          } else {
            toast.success("Welcome back!");
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

  const handleBack = () => {
    if (step === 'otp') {
      setStep('phone');
      setOtpCode("");
    } else if (step === 'name') {
      // For signup, after OTP verification, don't allow going back
      navigate("/");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 w-full max-w-full">
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="w-full max-w-md space-y-8 px-2">
          {/* Progress Indicator - only show during signup flow */}
          {!isLogin && (step === 'phone' || step === 'otp' || step === 'name') && (
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === 'name' 
                    ? 'bg-shake-yellow/20 text-shake-yellow' 
                    : 'bg-shake-yellow text-background'
                }`}>
                  {step === 'name' ? '✓' : '1'}
                </div>
                <span className={`text-sm ${step === 'name' ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                  Verify Phone
                </span>
              </div>
              <div className="w-8 h-px bg-border" />
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === 'name' 
                    ? 'bg-shake-yellow text-background' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  2
                </div>
                <span className={`text-sm ${step === 'name' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  Profile
                </span>
              </div>
            </div>
          )}

          {/* Logo */}
          <div className="flex flex-col items-center gap-4">
            <img src={logoShake} alt="Shake Social" className="h-20" />
            <h1 className="text-2xl font-display font-bold text-foreground">
              {step === 'otp' 
                ? "Enter verification code" 
                : step === 'name'
                ? "Let's create your profile."
                : isLogin 
                  ? "Welcome back"
                  : "Create your account"}
            </h1>
            <p className="text-muted-foreground text-center">
              {step === 'otp'
                ? `We sent a code to ${phoneNumber}`
                : step === 'name'
                ? "This is how others will see you"
                : isLogin
                  ? "Sign in with your phone number"
                  : "Create your account just with your phone number"}
            </p>
          </div>

          {/* Phone Number Form */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex gap-2">
                  {/* Country Code Selector */}
                  <Popover open={countrySearchOpen} onOpenChange={setCountrySearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={countrySearchOpen}
                        className="w-[120px] justify-between px-3"
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

              <Button
                type="submit"
                className="w-full bg-shake-yellow text-background hover:bg-shake-yellow/90"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : "Send Code"}
              </Button>
            </form>
          )}

          {/* Name Form (Signup only - after OTP verification) */}
          {step === 'name' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
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

              {/* Avatar Picker */}
              <div className="space-y-2 pt-2">
                <Label>Profile Picture <span className="text-destructive">*</span></Label>
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
                className="w-full bg-shake-yellow text-background hover:bg-shake-yellow/90"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Complete Setup"}
              </Button>
              
              <button
                type="button"
                onClick={() => {
                  toast.success("Welcome! You can complete your profile anytime.");
                  navigate("/");
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
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
        </div>
      </div>
    </div>
  );
}
