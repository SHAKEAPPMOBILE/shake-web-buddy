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
        : "https://app.shakeapp.today/auth/callback";

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
    toast.error(`Failed to log in with ${provider}`);
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
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
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

  const handleSendMagicLink = async (e: React.FormEvent, attemptNumber = 1) => {
    e.preventDefault();
    
    const validation = validateEmail(email);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    setIsLoading(true);

    try {
      const result = await sendEmailOtp(email, isLogin ? "login" : "signup", attemptNumber);
      
      if (!result.success) {
        // Check if this is a retryable error
        if (result.retryable) {
          console.log("[Auth][handleSendMagicLink] Retryable error detected, retrying in 3 seconds", {
            attempt: attemptNumber,
          });
          
          toast.info("Retrying... please wait", undefined);
          setIsLoading(true);
          
          // Wait 3 seconds before retrying
          await new Promise((resolve) => setTimeout(resolve, 3000));
          
          // Recursively call with attempt number incremented
          if (!email) return; // Safety check
          await handleSendMagicLink(
            { preventDefault: () => {} } as React.FormEvent,
            attemptNumber + 1
          );
          return;
        }

        const lower = (result.message || "").toLowerCase();
        const isNoAccountError =
          lower.includes("no account found") ||
          lower.includes("signups not allowed") ||
          lower.includes("user not found");

        if (isLogin && isNoAccountError) {
          setShowCreateAccountPrompt(true);
        } else {
          toast.error(toFriendlyAuthMessage(result.message, "email"));
        }
      } else {
        toast.success(
          isLogin
            ? "Magic link sent! Check your email."
            : "Check your email to verify and finish creating your account!"
        );
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

    if (!selectedAvatar) {
      toast.error("Please choose a profile picture or avatar");
      return;
    }

    setIsLoading(true);
    let shouldNavigateHome = true;

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        toast.error("Not logged in");
        navigate("/", { replace: true });
        return;
      }

      const [{ data: existingProfile, error: existingProfileError }, { data: existingPrivate, error: existingPrivateError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("name, avatar_url")
            .eq("user_id", currentUser.id)
            .maybeSingle(),
          supabase
            .from("profiles_private")
            .select("date_of_birth, nationality, occupation")
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
        String(currentUser.user_metadata?.full_name ?? currentUser.user_metadata?.name ?? "").trim() ||
        currentUser.email?.split("@")[0]?.trim() ||
        "Shake User";

      const resolvedDateOfBirth = dateOfBirth || existingPrivate?.date_of_birth || null;

      if (resolvedDateOfBirth) {
        const age = calculateAge(resolvedDateOfBirth);
        if (age < 18) {
          shouldNavigateHome = false;
          toast.error("You must be 18 or older to use Shake");
          return;
        }
      }

      let avatarUrl: string | null = null;
      if (selectedAvatar === "custom" && customAvatarPreview) {
        const fileName = `${currentUser.id}-${Date.now()}`;
        try {
          const avatarBlob = await (await fetch(customAvatarPreview)).blob();
          const { error } = await supabase.storage
            .from("avatars")
            .upload(fileName, avatarBlob, { upsert: true });

          if (error) {
            throw error;
          }

          const { data: publicUrlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(fileName);
          avatarUrl = publicUrlData.publicUrl;
        } catch (avatarError) {
          console.error("Avatar upload error:", avatarError);
          toast.error("Failed to upload avatar, but your setup will still continue");
          avatarUrl = customAvatarPreview;
        }
      } else if (selectedAvatar && selectedAvatar !== "custom") {
        avatarUrl = avatarOptions.find((avatar) => avatar.id === selectedAvatar)?.src || existingProfile?.avatar_url || null;
      }

      let profileSaveSucceeded = false;

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          user_id: currentUser.id,
          name: resolvedName,
          avatar_url: avatarUrl,
          instagram_url: instagramUrl || null,
          linkedin_url: linkedinUrl || null,
          twitter_url: twitterUrl || null,
        },
        { onConflict: "user_id" }
      );

      if (profileError) {
        logPostgrestError("Auth.tsx profiles upsert", profileError);
        toast.error("Failed to save part of your profile, but we'll still continue");
      } else {
        profileSaveSucceeded = true;
      }

      const { error: privateError } = await supabase.from("profiles_private").upsert(
        {
          user_id: currentUser.id,
          date_of_birth: resolvedDateOfBirth,
          nationality: nationality || existingPrivate?.nationality || null,
          occupation: occupation || existingPrivate?.occupation || null,
        },
        { onConflict: "user_id" }
      );

      if (privateError) {
        logPostgrestError("Auth.tsx profiles_private upsert", privateError);
        toast.error("Failed to save some profile details, but we'll still continue");
      } else {
        profileSaveSucceeded = true;
      }

      if (profileSaveSucceeded) {
        toast.success("Profile complete!");
        triggerConfettiWaterfall();
      }
    } catch (error) {
      console.error("Profile save error:", error);
      toast.error("We couldn't save everything, but we'll still take you to the app");
    } finally {
      setIsLoading(false);
      if (shouldNavigateHome) {
        navigate("/", { replace: true });
      }
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
      <div
        className={`flex-1 flex flex-col items-center px-4 ${
          step === 'method' ? 'justify-center py-8' : 'justify-center py-8'
        }`}
      >
        <div className="w-full max-w-md px-6 sm:px-0 space-y-6">
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
              aria-label="Back"
              className="absolute top-4 left-4 p-0 bg-transparent border-0 text-primary hover:text-primary/80 leading-none"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          {/* Method Selection */}
          {step === 'method' && (
            <div className="space-y-4">
              <div className="space-y-2 text-center">
                <img src={logoShake} alt="SHAKE" className="h-20 w-20 mx-auto mb-8" />
                <h1 className="text-2xl font-bold text-black">Welcome to SHAKE</h1>
                <p className="text-muted-foreground">Log In or create your account</p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => {
                    setIsLogin(true);
                    setStep('email');
                  }}
                  className="w-full text-white animate-gradient-shift hover:opacity-95"
                  size="lg"
                >
                  Log In
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
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none">
                    <g clipPath="url(#clip0)">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </g>
                  </svg>
                  Google
                </Button>

                <Button
                  onClick={() => signInWithOAuth('apple')}
                  variant="outline"
                  className="w-full border-2"
                  size="lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="mr-2">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
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
                  {isLogin ? "Log In with Email" : "Create Account"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isLogin ? "We'll send you a magic link to log in" : "We'll send you a link to verify your email"}
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

              <Button
                type="submit"
                className="w-full text-white animate-gradient-shift hover:opacity-95"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : isLogin ? "Send Magic Link" : "Create Account"}
              </Button>
            </form>
          )}

          {/* Confirmation Screen */}
          {step === 'confirmation' && (
            <div className="space-y-6 text-center">
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-bold text-black">Check your email</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a magic link to <span className="font-medium">{email}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Click the link to {isLogin ? "log in" : "verify your email and create your account"}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
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
                Back to Log In
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

      {step === 'method' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10">
          <LanguageSelector />
        </div>
      )}

      <AlertDialog open={showCreateAccountPrompt} onOpenChange={setShowCreateAccountPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No account found with this email</AlertDialogTitle>
            <AlertDialogDescription>
              No account found with this email. Would you like to create one?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowCreateAccountPrompt(false);
                setIsLogin(false);
                setStep('email');
              }}
            >
              Create Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
