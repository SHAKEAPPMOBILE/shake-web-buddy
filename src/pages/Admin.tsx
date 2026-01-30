import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, MapPin, DollarSign, ArrowLeft, Mail, Shield } from "lucide-react";
import { VenuesTab } from "@/components/admin/VenuesTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { PayoutsTab } from "@/components/admin/PayoutsTab";
import { VerificationsTab } from "@/components/admin/VerificationsTab";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Recovery flow states
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [recoveredPassword, setRecoveredPassword] = useState("");
  
  const { toast } = useToast();

  const authenticate = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${password}`,
        { method: "GET" }
      );
      
      const text = await response.text();
      
      // If it returns HTML with "Admin Access", we need the right password
      if (text.includes("Admin Access") && text.includes("Enter the admin password")) {
        toast({ title: "Invalid password", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      
      // If it contains user data or admin dashboard HTML, we're in
      if (text.includes("SHAKE Admin") || text.includes("Create New Test User")) {
        setIsAuthenticated(true);
      } else {
        toast({ title: "Invalid password", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error connecting to admin", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const sendRecoveryOtp = async () => {
    if (!recoveryEmail.trim()) {
      toast({ title: "Please enter your email", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/admin-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send-otp", email: recoveryEmail }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast({ title: data.error || "Failed to send code", variant: "destructive" });
      } else {
        setOtpSent(true);
        toast({ title: "Verification code sent to your email" });
      }
    } catch (err) {
      toast({ title: "Error sending verification code", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const verifyRecoveryOtp = async () => {
    if (otp.length !== 6) {
      toast({ title: "Please enter the 6-digit code", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/admin-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify-otp", email: recoveryEmail, otp }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast({ title: data.error || "Invalid code", variant: "destructive" });
      } else {
        setRecoveredPassword(data.password);
        toast({ title: "Password recovered successfully!" });
      }
    } catch (err) {
      toast({ title: "Error verifying code", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const resetRecovery = () => {
    setShowRecovery(false);
    setRecoveryEmail("");
    setOtpSent(false);
    setOtp("");
    setRecoveredPassword("");
  };

  // Password recovery flow
  if (showRecovery) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4 top-4"
              onClick={resetRecovery}
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <CardTitle className="text-2xl">🔑 Password Recovery</CardTitle>
            <CardDescription>
              {recoveredPassword 
                ? "Your admin password" 
                : otpSent 
                  ? "Enter the 6-digit code sent to your email" 
                  : "Enter your authorized admin email"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recoveredPassword ? (
              // Show recovered password
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl p-6 text-center">
                  <p className="text-white/80 text-sm mb-2">Your admin password is:</p>
                  <p className="text-white text-2xl font-mono font-bold tracking-wider">
                    {recoveredPassword}
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    setPassword(recoveredPassword);
                    resetRecovery();
                  }}
                  className="w-full"
                >
                  Use this password to login
                </Button>
              </div>
            ) : otpSent ? (
              // OTP verification step
              <div className="space-y-4">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button 
                  onClick={verifyRecoveryOtp}
                  className="w-full"
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                  Verify Code
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp("");
                  }}
                >
                  Use a different email
                </Button>
              </div>
            ) : (
              // Email input step
              <div className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    className="pl-10"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendRecoveryOtp()}
                  />
                </div>
                <Button 
                  onClick={sendRecoveryOtp}
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                  Send Verification Code
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Only authorized admin emails can recover the password
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">🔐 Admin Access</CardTitle>
            <CardDescription>Enter admin password to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && authenticate()}
            />
            <Button 
              onClick={authenticate} 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
              Continue
            </Button>
            <Button
              variant="ghost"
              className="w-full text-sm"
              onClick={() => setShowRecovery(true)}
            >
              Forgot password?
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
          <h1 className="text-3xl font-bold">🎯 SHAKE Admin</h1>
          <p className="opacity-90 mt-1">Manage users, venues, and payouts</p>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="verifications" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              IDs
            </TabsTrigger>
            <TabsTrigger value="payouts" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Payouts
            </TabsTrigger>
            <TabsTrigger value="venues" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Venues
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <UsersTab adminPassword={password} />
          </TabsContent>

          <TabsContent value="verifications" className="mt-6">
            <VerificationsTab adminPassword={password} />
          </TabsContent>

          <TabsContent value="payouts" className="mt-6">
            <PayoutsTab adminPassword={password} />
          </TabsContent>

          <TabsContent value="venues" className="mt-6">
            <VenuesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
