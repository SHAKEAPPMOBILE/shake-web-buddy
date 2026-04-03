import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Browser } from "@capacitor/browser";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/app-toast";
import logoShake from "@/assets/shake-logo-new.png";
import { ArrowLeft, User, Instagram, Linkedin, Twitter, Lock, Eye, EyeOff, Mail } from "lucide-react";
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
import { isNativePlatform } from "@/lib/platform-utils";
import { logPostgrestError } from "@/lib/supabaseErrorLog";
import { FaceCaptureModal } from "@/components/FaceCaptureModal";
import { compareFaces, storeFaceDescriptor } from "@/services/faceAuthService";

// Temporary rollout flag: keep implementation in codebase but hide from users.
const FACE_ID_FEATURE_ENABLED = false;

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
      const redirectTo = import.meta.env.DEV
        ? "http://localhost:5173/auth/callback"
        : "https://shake-web-app.netlify.app/auth/callback";

      const options: any = { redirectTo };

      // On Google, always show account picker so users can switch accounts
      if (provider === "google") {
        options.queryParams = { prompt: "select_account" };
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options,
      });
      if (error) throw error;
    }
  } catch (error) {
    console.error(`OAuth error (${provider}):`, error);
    toast.error(`Failed to sign in with ${provider}`);
  }
}

export default function Auth() {
  const [step, setStep] = useState<'method' | 'email' | 'confirmation' | 'name' | 'nationality' | 'occupation' | 'social' | 'avatar' | 'password'>('method');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
  const [isFaceCaptureOpen, setIsFaceCaptureOpen] = useState(false);
  const [faceMode, setFaceMode] = useState<'enroll' | 'authenticate'>('authenticate');
  const [isFaceAuthLoading, setIsFaceAuthLoading] = useState(false);
  const [showFaceSetupPrompt, setShowFaceSetupPrompt] = useState(false);
  const [pendingFaceSetupUserId, setPendingFaceSetupUserId] = useState<string | null>(null);
  
  const { user, sendEmailOtp, signUpWithPassword, signInWithPassword, updatePassword } = useAuth();
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

  // After any sign-in (including Google), route new users into profile completion
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    setTimeout(() => {
      (async () => {
        const [{ data: profile, error: profileErr }, { data: profilePrivate, error: privateErr }] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("name")
              .eq("user_id", user.id)
              .maybeSingle(),
            supabase
              .from("profiles_private")
              .select("*")
              .eq("user_id", user.id)
              .maybeSingle(),
          ]);

        if (cancelled) return;

        if (profileErr) logPostgrestError("Auth.tsx profiles select (post sign-in)", profileErr);
        if (privateErr) logPostgrestError("Auth.tsx profiles_private select (post sign-in)", privateErr);

        const needsProfile = !profile?.name || !profilePrivate?.date_of_birth;

        if (needsProfile) {
          setIsLogin(false);
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

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateEmail(email);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    setIsLoading(true);

    try {
      // For signup, validate password
      if (!isLogin) {
        if (!password || password.length < 6) {
          toast.error("Password must be at least 6 characters");
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          setIsLoading(false);
          return;
        }
      }

      const { error } = await sendEmailOtp(email, isLogin ? "login" : "signup");
      if (error) {
        toast.error(toFriendlyAuthMessage(error.message, "email"));
      } else {
        toast.success("Check your email for a magic link to sign in!");
        setStep('confirmation');
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateEmail(email);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

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
      const { error } = await signUpWithPassword(email, password);
      if (error) {
        toast.error(toFriendlyAuthMessage(error.message, "signup"));
      } else {
        toast.success("Account created! Check your email to verify.");
        setStep('name');
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
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
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        toast.error("Not logged in");
        return;
      }

      let avatarUrl: string | null = null;
      if (selectedAvatar === "custom" && customAvatarPreview) {
        const fileName = `${currentUser.id}-${Date.now()}`;
        const { data, error } = await supabase.storage
          .from("avatars")
          .upload(fileName, await (await fetch(customAvatarPreview)).blob());
        
        if (error) {
          console.error("Avatar upload error:", error);
          toast.error("Failed to upload avatar");
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);
        avatarUrl = publicUrlData.publicUrl;
      } else if (selectedAvatar && selectedAvatar !== "custom") {
        avatarUrl = `/avatars/${selectedAvatar}`;
      }

      // Update profiles table
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          user_id: currentUser.id,
          name: name.trim(),
          avatar_url: avatarUrl,
          instagram_url: instagramUrl || null,
          linkedin_url: linkedinUrl || null,
          twitter_url: twitterUrl || null,
        },
        { onConflict: "user_id" }
      );

      if (profileError) {
        logPostgrestError("Auth.tsx profiles upsert", profileError);
        toast.error("Failed to save profile");
        return;
      }

      // Update profiles_private table
      const { error: privateError } = await supabase.from("profiles_private").upsert(
        {
          user_id: currentUser.id,
          date_of_birth: dateOfBirth,
          nationality: nationality || null,
          occupation: occupation || null,
        },
        { onConflict: "user_id" }
      );

      if (privateError) {
        logPostgrestError("Auth.tsx profiles_private upsert", privateError);
        toast.error("Failed to save profile");
        return;
      }

      toast.success("Profile complete!");
      triggerConfettiWaterfall();

      if (FACE_ID_FEATURE_ENABLED) {
        setPendingFaceSetupUserId(currentUser.id);
        setShowFaceSetupPrompt(true);
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error("Profile save error:", error);
      toast.error("An unexpected error occurred");
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
        navigate("/");
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
      navigate("/");
    } catch (error) {
      console.error("Face auth failed", error);
      toast.warning("Face not recognized. Try again or use another method");
    } finally {
      setIsFaceAuthLoading(false);
      setIsFaceCaptureOpen(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-white">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          {/* Logo and Language Selector */}
          {step === 'method' && (
            <div className="flex items-center justify-between">
              <img src={logoShake} alt="SHAKE" className="h-12" />
              <LanguageSelector />
            </div>
          )}

          {/* Back Button */}
          {step !== 'method' && step !== 'confirmation' && (
            <button
              onClick={() => {
                if (step === 'email') {
                  setStep('method');
                } else {
                  setStep('method');
                }
                setEmail("");
                setPassword("");
                setConfirmPassword("");
              }}
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}

          {/* Method Selection */}
          {step === 'method' && (
            <div className="space-y-4">
              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-bold text-black">Welcome to SHAKE</h1>
                <p className="text-muted-foreground">Sign in or create your account</p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => {
                    setIsLogin(true);
                    setStep('email');
                  }}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  size="lg"
                >
                  Sign In
                </Button>

                <Button
                  onClick={() => {
                    setIsLogin(false);
                    setStep('email');
                  }}
                  variant="outline"
                  className="w-full border-2"
                  size="lg"
                >
                  Create Account
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <Button
                  onClick={() => signInWithOAuth('google')}
                  variant="outline"
                  className="w-full border-2"
                  size="lg"
                >
                  <img src="/icons/google.svg" alt="Google" className="w-4 h-4 mr-2" />
                  Google
                </Button>

                <Button
                  onClick={() => signInWithOAuth('apple')}
                  variant="outline"
                  className="w-full border-2"
                  size="lg"
                >
                  <img src="/icons/apple.svg" alt="Apple" className="w-4 h-4 mr-2" />
                  Apple
                </Button>
              </div>
            </div>
          )}

          {/* Email Login/Signup */}
          {step === 'email' && (
            <form onSubmit={handleSendMagicLink} className="space-y-4">
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-bold text-black">
                  {isLogin ? "Sign In with Email" : "Create Account"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isLogin ? "We'll send you a magic link to sign in" : "We'll send you a link to verify your email"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-black">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-black">Password</Label>
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
                {isLoading ? "Sending..." : isLogin ? "Send Magic Link" : "Create Account"}
              </Button>

              {isLogin && (
                <button
                  type="button"
                  onClick={() => {
                    setPassword("");
                    // Can add password login option here if needed
                  }}
                  className="w-full text-sm text-primary hover:underline"
                >
                  Sign in with password instead
                </button>
              )}
            </form>
          )}

          {/* Confirmation Screen */}
          {step === 'confirmation' && (
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-bold text-black">Check your email</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a magic link to <span className="font-medium">{email}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Click the link to {isLogin ? "sign in" : "verify your email and create your account"}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  💡 If you don't see the email, check your spam folder or try another email address.
                </p>
              </div>

              <Button
                onClick={() => {
                  setStep('method');
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
                }}
                variant="outline"
                className="w-full border-2"
                size="lg"
              >
                Back to Sign In
              </Button>
            </div>
          )}

          {/* Name Form - Step 1 of profile */}
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

          {/* Nationality Form */}
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

          {/* Occupation Form */}
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

          {/* Social Links Form */}
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

          {/* Avatar Picker Form */}
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
                  onClick={() => {
                    setShowFaceSetupPrompt(false);
                    setPendingFaceSetupUserId(null);
                    navigate("/");
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
