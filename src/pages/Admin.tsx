import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, MapPin } from "lucide-react";
import { VenuesTab } from "@/components/admin/VenuesTab";
import { UsersTab } from "@/components/admin/UsersTab";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
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
          <p className="opacity-90 mt-1">Manage users and venues</p>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="venues" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Venues
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <UsersTab adminPassword={password} />
          </TabsContent>

          <TabsContent value="venues" className="mt-6">
            <VenuesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
