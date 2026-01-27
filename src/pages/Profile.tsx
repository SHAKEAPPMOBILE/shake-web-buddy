import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, ArrowLeft, User, LogOut, Save, Instagram, Linkedin, Twitter, Bell, Mail } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { AvatarPicker, avatarOptions } from "@/components/AvatarPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SuperHumanIcon } from "@/components/SuperHumanIcon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { normalizeInstagramUrl, normalizeTwitterUrl } from "@/lib/social-utils";
import { Switch } from "@/components/ui/switch";
import { NationalitySelector } from "@/components/NationalitySelector";
import { ChangePhoneDialog } from "@/components/ChangePhoneDialog";
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

export default function Profile() {
  const { user, isLoading: authLoading, isPremium, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState("");
  const [nationality, setNationality] = useState("");
  const [occupation, setOccupation] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [showChangePhone, setShowChangePhone] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      // Fetch public profile
      const { data: publicProfile, error: publicError } = await supabase
        .from("profiles")
        .select("name, avatar_url, nationality, occupation, instagram_url, linkedin_url, twitter_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (publicError) {
        console.error("Error fetching public profile:", publicError);
      } else if (publicProfile) {
        setName(publicProfile.name || "");
        setAvatarUrl(publicProfile.avatar_url);
        setNationality(publicProfile.nationality || "");
        setOccupation(publicProfile.occupation || "");
        setInstagramUrl(publicProfile.instagram_url || "");
        setLinkedinUrl(publicProfile.linkedin_url || "");
        setTwitterUrl(publicProfile.twitter_url || "");
      }

      // Fetch private profile for phone number, email and push notifications
      const { data: privateProfile, error: privateError } = await supabase
        .from("profiles_private")
        .select("phone_number, billing_email, push_notifications_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (privateError) {
        console.error("Error fetching private profile:", privateError);
      } else if (privateProfile) {
        setPhoneNumber(privateProfile.phone_number || "");
        setBillingEmail(privateProfile.billing_email || "");
        setPushNotificationsEnabled(privateProfile.push_notifications_enabled ?? true);
      }

      setIsLoading(false);
    };

    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(newAvatarUrl);
      toast.success("Profile picture updated!");
      triggerConfettiWaterfall();
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload profile picture");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      // Update public profile
      const { error: publicError } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          nationality: nationality.trim() || null,
          occupation: occupation.trim() || null,
          instagram_url: instagramUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          twitter_url: twitterUrl.trim() || null,
        })
        .eq("user_id", user.id);

      if (publicError) throw publicError;

      // Update private profile for push notifications and billing email
      const privateUpdateData: { push_notifications_enabled: boolean; billing_email: string | null } = {
        push_notifications_enabled: pushNotificationsEnabled,
        billing_email: billingEmail.trim() || null,
      };
      
      const { error: privateError } = await supabase
        .from("profiles_private")
        .update(privateUpdateData)
        .eq("user_id", user.id);

      if (privateError) throw privateError;

      toast.success("Profile saved!");
      triggerConfettiWaterfall();
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOutClick = () => {
    setShowSignOutConfirm(true);
  };

  const handleConfirmSignOut = async () => {
    await signOut();
    setShowSignOutConfirm(false);
    navigate("/");
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Header with back button */}
      <header className="shrink-0 bg-card/95 backdrop-blur-xl border-b border-border pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-white hover:opacity-90 transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
            }}
          >
            {isSaving ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 px-4 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]">
        <div className="max-w-md mx-auto space-y-6">
          {/* Profile Header */}
          <div className="flex flex-col items-center py-6">
            {/* Avatar with camera button */}
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full bg-muted border-2 border-border overflow-hidden flex items-center justify-center">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="" 
                    className="w-full h-full object-cover"
                    onError={() => setAvatarUrl(null)}
                  />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              
              <button
                onClick={() => setShowAvatarPicker(true)}
                disabled={isUploading}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-50"
                style={{
                  background: "linear-gradient(to right, rgba(88, 28, 135, 0.9), rgba(67, 56, 202, 0.8))",
                }}
              >
                {isUploading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {/* Premium Badge */}
            {isPremium && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-shake-yellow/10 rounded-full">
                <SuperHumanIcon size={14} />
                <span className="text-sm font-medium text-shake-yellow">Super-Human</span>
              </div>
            )}
          </div>

          {/* Profile Form */}
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="space-y-2">
                <Input
                  id="phone"
                  value={phoneNumber}
                  readOnly
                  disabled
                  className="bg-muted"
                  placeholder="No phone number added"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => setShowChangePhone(true)}
                >
                  {phoneNumber ? "Change phone number" : "Add phone number"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  For safety, phone numbers can only be changed via SMS verification.
                </p>
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                placeholder="your@email.com"
              />
              <p className="text-xs text-muted-foreground">
                Used for billing and to receive updates from us.
              </p>
            </div>

            {/* Nationality */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="text-lg">🌍</span>
                Nationality
              </Label>
              <NationalitySelector
                value={nationality}
                onChange={setNationality}
                placeholder="Select your nationality"
              />
            </div>

            {/* Occupation */}
            <div className="space-y-2">
              <Label htmlFor="occupation" className="flex items-center gap-2">
                <span className="text-lg">💼</span>
                Occupation
              </Label>
              <Input
                id="occupation"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="e.g. Software Engineer, Designer, Student"
              />
            </div>

            {/* Social Links Section */}
            <div className="pt-4 border-t border-border">
              <h3 className="text-sm font-medium mb-4">Social Links</h3>
              
              {/* Instagram */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="instagram" className="flex items-center gap-2">
                  <Instagram className="w-4 h-4" />
                  Instagram
                </Label>
                <Input
                  id="instagram"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="@username or full URL"
                />
              </div>

              {/* LinkedIn */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="linkedin" className="flex items-center gap-2">
                  <Linkedin className="w-4 h-4" />
                  LinkedIn
                </Label>
                <Input
                  id="linkedin"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                />
              </div>

              {/* Twitter */}
              <div className="space-y-2">
                <Label htmlFor="twitter" className="flex items-center gap-2">
                  <Twitter className="w-4 h-4" />
                  Twitter / X
                </Label>
                <Input
                  id="twitter"
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  placeholder="@username or full URL"
                />
              </div>
            </div>

            {/* Notifications Section */}
            <div className="pt-4 border-t border-border">
              <h3 className="text-sm font-medium mb-4">Notifications</h3>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Push Notifications</p>
                    <p className="text-xs text-muted-foreground">Get notified when you receive new messages</p>
                  </div>
                </div>
                <Switch
                  checked={pushNotificationsEnabled}
                  onCheckedChange={setPushNotificationsEnabled}
                />
              </div>
            </div>
          </div>

          {/* Antisocial (Sign Out) Button */}
          <div className="pt-6 border-t border-border">
            <button
              onClick={handleSignOutClick}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-destructive" />
              </div>
              <span className="font-medium text-destructive">Antisocial</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="pb-8 px-4 safe-area-bottom">
        <p className="text-center text-sm text-muted-foreground">
          Made with ❤️ for social butterflies
        </p>
      </footer>

      {/* Sign Out Confirmation Dialog */}
      <AlertDialog open={showSignOutConfirm} onOpenChange={setShowSignOutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Going antisocial? 😢</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out? You'll miss all the fun activities!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay Social</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Avatar Picker Dialog */}
      <Dialog open={showAvatarPicker} onOpenChange={setShowAvatarPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Choose your avatar</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <AvatarPicker
              selectedAvatar={selectedAvatar}
              onSelectAvatar={async (avatarId) => {
                setSelectedAvatar(avatarId);
                const avatar = avatarOptions.find(a => a.id === avatarId);
                if (avatar) {
                  setAvatarUrl(avatar.src);
                  setShowAvatarPicker(false);
                }
              }}
              onUploadClick={() => {
                // Close dialog first, then trigger file input after a delay
                // This prevents iOS/iPadOS crash from simultaneous dialog close + file picker
                setShowAvatarPicker(false);
                setTimeout(() => {
                  fileInputRef.current?.click();
                }, 100);
              }}
              customAvatarPreview={avatarUrl}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ChangePhoneDialog
        open={showChangePhone}
        onOpenChange={setShowChangePhone}
        currentPhone={phoneNumber || null}
        onPhoneUpdated={(newPhone) => {
          setPhoneNumber(newPhone);
          toast.success("Phone number updated");
        }}
      />
    </div>
  );
}
