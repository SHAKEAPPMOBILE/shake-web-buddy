import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, ArrowLeft, Loader2, User, Crown, CreditCard, Bell, Trash2, Phone, Instagram, Linkedin, Twitter, Lock, Eye, EyeOff } from "lucide-react";
import { countryCodes } from "@/data/countryCodes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { triggerConfettiWaterfall } from "@/lib/confetti";

export default function Profile() {
  const { user, isLoading: authLoading, isPremium, subscriptionEnd, signOut, updatePassword } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  
  // Check if user signed up with phone (has phone in auth.users)
  const isPhoneUser = !!user?.phone;

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
      
      // Fetch public profile data
      const { data: publicData, error: publicError } = await supabase
        .from("profiles")
        .select("name, avatar_url, instagram_url, linkedin_url, twitter_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (publicError) {
        console.error("Error fetching public profile:", publicError);
      } else if (publicData) {
        setName(publicData.name || "");
        setAvatarUrl(publicData.avatar_url);
        setInstagramUrl(publicData.instagram_url || "");
        setLinkedinUrl(publicData.linkedin_url || "");
        setTwitterUrl(publicData.twitter_url || "");
      }

      // Fetch private profile data (billing_email, sms_notifications_enabled, phone_number)
      const { data: privateData, error: privateError } = await supabase
        .from("profiles_private")
        .select("billing_email, sms_notifications_enabled, phone_number")
        .eq("user_id", user.id)
        .maybeSingle();

      if (privateError && privateError.code !== 'PGRST116') {
        console.error("Error fetching private profile:", privateError);
      } else if (privateData) {
        setBillingEmail(privateData.billing_email || "");
        setSmsNotificationsEnabled(privateData.sms_notifications_enabled ?? true);
        
        // Parse phone number if it exists (for email users who added a phone)
        if (privateData.phone_number && !user.phone) {
          const foundCode = countryCodes.find(c => privateData.phone_number?.startsWith(c.code));
          if (foundCode) {
            setCountryCode(foundCode.code);
            setPhoneNumber(privateData.phone_number.replace(foundCode.code, ""));
          } else {
            setPhoneNumber(privateData.phone_number);
          }
        }
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

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profile with new avatar URL
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

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      // Upsert public profile (name, avatar_url, social links)
      const { error: publicError } = await supabase
        .from("profiles")
        .upsert({ 
          user_id: user.id,
          name,
          avatar_url: avatarUrl,
          instagram_url: instagramUrl || null,
          linkedin_url: linkedinUrl || null,
          twitter_url: twitterUrl || null
        }, { onConflict: 'user_id' });

      if (publicError) throw publicError;

      // Update private profile (billing_email, sms_notifications_enabled, phone_number for email users)
      const privateUpdate: {
        user_id: string;
        billing_email: string | null;
        sms_notifications_enabled: boolean;
        phone_number?: string | null;
      } = { 
        user_id: user.id,
        billing_email: billingEmail || null,
        sms_notifications_enabled: smsNotificationsEnabled
      };

      // Only update phone_number for email users (phone users have it in auth.users)
      if (!isPhoneUser) {
        privateUpdate.phone_number = phoneNumber ? `${countryCode}${phoneNumber}` : null;
      }

      const { error: privateError } = await supabase
        .from("profiles_private")
        .upsert(privateUpdate, { onConflict: 'user_id' });

      if (privateError) throw privateError;

      toast.success("Profile updated!");
      navigate("/");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error opening customer portal:", error);
      toast.error("Failed to open subscription management. Make sure you have an active subscription.");
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      
      if (error) throw error;
      
      await signOut();
      toast.success("Your account has been deleted");
      navigate("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) throw error;
      
      toast.success("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Failed to update password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-36 md:pt-44 pb-16">
        <div className="container mx-auto px-4 max-w-md">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <div className="bg-card border border-border rounded-2xl p-6 space-y-8">
            <h1 className="text-2xl font-display font-bold text-center">
              Your Profile
            </h1>

            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-muted border-4 border-border">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5" />
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
              
              <p className="text-sm text-muted-foreground">
                Click the camera icon to change your photo
              </p>
            </div>

            {/* Name Section */}
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="bg-muted/50"
              />
            </div>

            {/* Billing Email Section */}
            <div className="space-y-2">
              <Label htmlFor="billingEmail">Email</Label>
              <Input
                id="billingEmail"
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Used for subscription receipts and invoices
              </p>
            </div>

            {/* Phone Number Section */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone Number
              </Label>
              {isPhoneUser ? (
                <>
                  <Input
                    id="phone"
                    type="text"
                    value={user?.phone || "Not set"}
                    disabled
                    className="bg-muted/30 text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Phone number cannot be changed (used for login)
                  </p>
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-24 h-10 rounded-md border border-input bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {countryCodes.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.code}
                        </option>
                      ))}
                    </select>
                    <Input
                      id="phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                      placeholder="912345678"
                      className="bg-muted/50 flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add your phone to receive SMS notifications about activities
                  </p>
                </>
              )}
            </div>

            {/* Social Media Links */}
            <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border">
              <h3 className="font-medium text-sm text-foreground">Social Links</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Instagram className="w-5 h-5 text-pink-500 shrink-0" />
                  <Input
                    type="url"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    placeholder="https://instagram.com/username"
                    className="bg-background/50"
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <Linkedin className="w-5 h-5 text-blue-600 shrink-0" />
                  <Input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="bg-background/50"
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <Twitter className="w-5 h-5 text-sky-500 shrink-0" />
                  <Input
                    type="url"
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    placeholder="https://x.com/username"
                    className="bg-background/50"
                  />
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Add your social profiles so others can connect with you
              </p>
            </div>

            {/* SMS Notifications Toggle */}
            <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="sms-notifications" className="font-medium cursor-pointer">
                      SMS Notifications
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Get notified when someone joins your plans or sends messages
                    </p>
                  </div>
                </div>
                <Switch
                  id="sms-notifications"
                  checked={smsNotificationsEnabled}
                  onCheckedChange={setSmsNotificationsEnabled}
                />
              </div>
            </div>

            {/* Password Section */}
            <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-medium text-sm text-foreground">
                  {isPhoneUser ? "Set Password" : "Change Password"}
                </h3>
              </div>
              
              <p className="text-xs text-muted-foreground">
                {isPhoneUser 
                  ? "Set a password to log in faster without SMS verification"
                  : "Update your account password"
                }
              </p>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="bg-background/50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="bg-background/50 pr-10"
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
                  variant="outline"
                  className="w-full"
                  onClick={handlePasswordUpdate}
                  disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      {isPhoneUser ? "Set Password" : "Update Password"}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Subscription Section */}
            {isPremium && (
              <div className="space-y-3 p-4 rounded-xl bg-shake-yellow/10 border border-shake-yellow/30">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-shake-yellow" />
                  <span className="font-semibold text-foreground">Premium Member</span>
                </div>
                {subscriptionEnd && (
                  <p className="text-sm text-muted-foreground">
                    Renews on {new Date(subscriptionEnd).toLocaleDateString()}
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleManageSubscription}
                  disabled={isOpeningPortal}
                >
                  {isOpeningPortal ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Opening...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Manage Subscription
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Save Button */}
            <Button
              variant="shake"
              className="w-full"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>

            {/* Delete Account Section */}
            <div className="pt-6 border-t border-border">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your
                      account and remove all your data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        "Delete Account"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
