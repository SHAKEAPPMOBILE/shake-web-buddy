import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, UserCheck, UserX, Crown, Search, Eye, EyeOff, Key, Users, MapPin } from "lucide-react";
import { VenuesTab } from "@/components/admin/VenuesTab";

interface TestUser {
  id: string;
  phone: string | null;
  phone_confirmed_at: string | null;
  created_at: string;
  name?: string | null;
  isPremium?: boolean;
  password?: string | null;
}

interface SearchResult {
  id: string;
  phone: string;
  name: string | null;
  password: string | null;
  isPremium: boolean;
  created_at: string;
}

export default function Admin() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<TestUser[]>([]);
  
  // Form state
  const [phone, setPhone] = useState("+1 ");
  const [userPassword, setUserPassword] = useState("");
  const [name, setName] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  
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
        await loadUsers();
      } else {
        toast({ title: "Invalid password", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error connecting to admin", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const loadUsers = async () => {
    try {
      // We'll parse the users from the HTML response or make a direct query
      // For now, just set authenticated
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${password}`,
        { method: "GET" }
      );
      const text = await response.text();
      
      // Parse users from HTML (simplified - would need proper parsing in production)
      const userMatches = text.matchAll(/data-user-id="([^"]+)"[\s\S]*?class="user-phone">\s*([^<]+)/g);
      const parsedUsers: TestUser[] = [];
      for (const match of userMatches) {
        parsedUsers.push({
          id: match[1],
          phone: match[2].trim().split('<')[0].trim(),
          phone_confirmed_at: text.includes(`${match[1]}`) && text.includes('Verified') ? 'yes' : null,
          created_at: new Date().toISOString(),
        });
      }
      setUsers(parsedUsers);
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${password}&action=search&query=${encodeURIComponent(searchQuery)}`,
        { method: "GET" }
      );
      const data = await response.json();
      
      if (data.users) {
        setSearchResults(data.users);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Error searching users:", err);
      toast({ title: "Error searching users", variant: "destructive" });
    }
    setIsSearching(false);
  };

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const bulkSetPasswords = async () => {
    if (!confirm("This will set password 'Test1234!' for ALL users and save it to their metadata. Continue?")) return;
    
    setIsBulkUpdating(true);
    try {
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${password}&action=set-all-passwords&defaultPassword=Test1234!`,
        { method: "GET" }
      );
      const data = await response.json();
      
      if (data.success) {
        toast({ title: "✅ Passwords updated!", description: data.message });
      } else {
        toast({ title: "Error", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch (err) {
      console.error("Error updating passwords:", err);
      toast({ title: "Error updating passwords", variant: "destructive" });
    }
    setIsBulkUpdating(false);
  };

  const createUser = async () => {
    if (!phone || !userPassword) {
      toast({ title: "Phone and password required", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${password}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, userPassword, name, isPremium }),
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        toast({ title: "✅ User created!", description: `${phone} can now login${isPremium ? ' (Super-Human)' : ''}` });
        setPhone("+1 ");
        setUserPassword("");
        setName("");
        setIsPremium(false);
        await loadUsers();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error creating user", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const deleteUser = async (userId: string, userPhone: string) => {
    if (!confirm(`Delete user ${userPhone}?`)) return;
    
    try {
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${password}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        toast({ title: "User deleted" });
        setUsers(users.filter(u => u.id !== userId));
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error deleting user", variant: "destructive" });
    }
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
          <p className="opacity-90 mt-1">Manage test users and venues</p>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Test Users
            </TabsTrigger>
            <TabsTrigger value="venues" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Venues
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6 space-y-6">
            {/* Stats */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm border">
                <span className="text-2xl font-bold text-purple-600">{users.length}</span>
                <span className="ml-2 text-gray-600">Total Users</span>
              </div>
              <Button 
                onClick={bulkSetPasswords} 
                disabled={isBulkUpdating}
                variant="outline"
              >
                {isBulkUpdating ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Key className="mr-2 w-4 h-4" />}
                Set All Passwords to Test1234!
              </Button>
            </div>

            {/* Create User Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create New Test User
                </CardTitle>
                <CardDescription>
                  Users created here can login immediately with phone + password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Phone Number</label>
                    <Input
                      type="tel"
                      placeholder="+1 555 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Password</label>
                    <Input
                      type="text"
                      placeholder="Test1234!"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Name (optional)</label>
                    <Input
                      type="text"
                      placeholder="Test User"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <Switch
                    checked={isPremium}
                    onCheckedChange={setIsPremium}
                    className="data-[state=checked]:bg-amber-500"
                  />
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-800">Super-Human Status</span>
                  </div>
                  <span className="text-xs text-amber-600 ml-auto">
                    {isPremium ? "User will have premium features" : "Regular user"}
                  </span>
                </div>
                <Button 
                  onClick={createUser} 
                  className="mt-4"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Plus className="mr-2 w-4 h-4" />}
                  Create User
                </Button>
              </CardContent>
            </Card>

            {/* User Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Find User
                </CardTitle>
                <CardDescription>
                  Search by name or phone to find user credentials
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    type="text"
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                    className="flex-1"
                  />
                  <Button onClick={searchUsers} disabled={isSearching}>
                    {isSearching ? <Loader2 className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                
                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {searchResults.map((user) => (
                      <div 
                        key={user.id}
                        className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{user.name || "No name"}</span>
                              {user.isPremium && (
                                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Crown className="w-3 h-3" /> Premium
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{user.phone}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-gray-500">Password:</span>
                              <code className="bg-white px-2 py-1 rounded text-sm font-mono border">
                                {showPasswords[user.id] ? (user.password || "N/A") : "••••••••"}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePasswordVisibility(user.id)}
                                className="h-7 w-7 p-0"
                              >
                                {showPasswords[user.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-2">{user.id}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                {searchQuery && searchResults.length === 0 && !isSearching && (
                  <p className="text-center text-gray-500 mt-4">No users found matching "{searchQuery}"</p>
                )}
              </CardContent>
            </Card>

            {/* Users List */}
            <Card>
              <CardHeader>
                <CardTitle>👥 Existing Users ({users.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No users yet. Create your first test user above!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {users.map((user) => (
                      <div 
                        key={user.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{user.phone}</span>
                            {user.phone_confirmed_at ? (
                              <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                <UserCheck className="w-3 h-3" /> Verified
                              </span>
                            ) : (
                              <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                <UserX className="w-3 h-3" /> Unverified
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 font-mono mt-1">{user.id}</p>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => deleteUser(user.id, user.phone || "")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="venues" className="mt-6">
            <VenuesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
