import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import logoShake from "@/assets/logo_shake_original_color.png";
import { ArrowLeft, Phone, User } from "lucide-react";
import { AvatarPicker } from "@/components/AvatarPicker";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function Auth() {
  const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone');
  const [isLogin, setIsLogin] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const { signUpWithPhone, signInWithPhone, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    // Ensure it starts with +
    if (!cleaned.startsWith('+')) {
      cleaned = '+1' + cleaned; // Default to US
    }
    return cleaned;
  };

  const validatePhoneNumber = (phone: string): { isValid: boolean; error?: string } => {
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Check if empty
    if (!cleaned || cleaned === '+') {
      return { isValid: false, error: "Please enter your phone number" };
    }
    
    // Check minimum length (country code + at least 6 digits)
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      return { isValid: false, error: "Phone number is too short" };
    }
    
    // Check maximum length (max 15 digits per E.164 standard)
    if (digitsOnly.length > 15) {
      return { isValid: false, error: "Phone number is too long" };
    }
    
    // Basic format check - should have country code and number
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    if (!phoneRegex.test(cleaned)) {
      return { isValid: false, error: "Please enter a valid phone number with country code (e.g., +1 234 567 8900)" };
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

    // Profile is already created via trigger, just navigate home
    toast.success("Profile saved!");
    navigate("/");
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
        if (isLogin) {
          toast.success("Welcome back!");
          navigate("/");
        } else {
          // For signup, go to profile configuration
          toast.success("Phone verified! Now set up your profile.");
          setStep('name');
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl" />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-4">
            <img src={logoShake} alt="Shake Social" className="h-20" />
            <h1 className="text-2xl font-display font-bold text-foreground">
              {step === 'otp' 
                ? "Enter verification code" 
                : step === 'name'
                ? "What's your name?"
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
                  : "Join Shake Social with your phone number"}
            </p>
          </div>

          {/* Phone Number Form */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 234 567 8900"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  We'll send you a verification code
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
                <Label htmlFor="name">Your Name</Label>
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
                <Label>Profile Picture (optional)</Label>
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
