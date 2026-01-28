import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, FlaskConical, UserCheck, Loader2, Eye, EyeOff, Crown, Key, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface UserData {
  user_id: string;
  name: string | null;
  phone_number: string | null;
  created_at: string;
  isPremium?: boolean;
}

interface TestUserFormProps {
  password: string;
  onUserCreated: () => void;
}

function TestUserForm({ password, onUserCreated }: TestUserFormProps) {
  const [phone, setPhone] = useState("+1 555 ");
  const [userPassword, setUserPassword] = useState("Test1234!");
  const [name, setName] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
        toast({ title: "✅ Test user created!", description: `${phone} can now login` });
        setPhone("+1 555 ");
        setUserPassword("Test1234!");
        setName("");
        setIsPremium(false);
        onUserCreated();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error creating user", variant: "destructive" });
    }
    setIsLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Create New Test User
        </CardTitle>
        <CardDescription>
          Test users use +1 555 phone numbers and bypass SMS verification
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
            <label className="text-sm font-medium text-gray-600">Name</label>
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
        </div>
        <Button 
          onClick={createUser} 
          className="mt-4"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Plus className="mr-2 w-4 h-4" />}
          Create Test User
        </Button>
      </CardContent>
    </Card>
  );
}

export function UsersTab({ adminPassword }: { adminPassword: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Fetch all users from profiles
  const { data: allUsers = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          name,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch phone numbers separately (profiles_private has RLS)
      const userIds = data.map(u => u.user_id);
      const usersWithPhones: UserData[] = [];

      // For each user, try to get their phone from profiles_private
      for (const user of data) {
        const { data: privateData } = await supabase
          .from('profiles_private')
          .select('phone_number, premium_override')
          .eq('user_id', user.user_id)
          .maybeSingle();

        usersWithPhones.push({
          user_id: user.user_id,
          name: user.name,
          phone_number: privateData?.phone_number || null,
          created_at: user.created_at,
          isPremium: privateData?.premium_override || false,
        });
      }

      return usersWithPhones;
    },
  });

  // Separate test users from real users
  const { testUsers, realUsers } = useMemo(() => {
    const test: UserData[] = [];
    const real: UserData[] = [];

    allUsers.forEach(user => {
      const phone = user.phone_number || '';
      // Test users have +1555 or 1555 phone numbers (fake US numbers)
      if (phone.includes('555') && (phone.startsWith('+1') || phone.startsWith('1'))) {
        test.push(user);
      } else {
        real.push(user);
      }
    });

    return { testUsers: test, realUsers: real };
  }, [allUsers]);

  // Filter by search
  const filteredTestUsers = useMemo(() => {
    if (!searchQuery.trim()) return testUsers;
    const q = searchQuery.toLowerCase();
    return testUsers.filter(u => 
      u.name?.toLowerCase().includes(q) || 
      u.phone_number?.includes(q)
    );
  }, [testUsers, searchQuery]);

  const filteredRealUsers = useMemo(() => {
    if (!searchQuery.trim()) return realUsers;
    const q = searchQuery.toLowerCase();
    return realUsers.filter(u => 
      u.name?.toLowerCase().includes(q) || 
      u.phone_number?.includes(q)
    );
  }, [realUsers, searchQuery]);

  const deleteTestUser = async (userId: string, phone: string) => {
    if (!confirm(`Delete test user ${phone}?`)) return;
    
    try {
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${adminPassword}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        toast({ title: "Test user deleted" });
        refetch();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error deleting user", variant: "destructive" });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-3xl font-bold text-blue-700">{allUsers.length}</span>
            </div>
            <p className="text-sm text-blue-600 font-medium">Total Users</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-green-600" />
              <span className="text-3xl font-bold text-green-700">{realUsers.length}</span>
            </div>
            <p className="text-sm text-green-600 font-medium">Real Users</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-purple-600" />
              <span className="text-3xl font-bold text-purple-700">{testUsers.length}</span>
            </div>
            <p className="text-sm text-purple-600 font-medium">Test Users</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Create Test User Form */}
      <TestUserForm password={adminPassword} onUserCreated={() => refetch()} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-green-600" />
              Real Users ({filteredRealUsers.length})
            </CardTitle>
            <CardDescription>
              Users who signed up through the app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRealUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No real users found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRealUsers.map((user, idx) => (
                      <TableRow key={user.user_id}>
                        <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{user.name || "—"}</span>
                            {user.isPremium && (
                              <Crown className="w-3 h-3 text-amber-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {user.phone_number || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(user.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Test Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-purple-600" />
              Test Users ({filteredTestUsers.length})
            </CardTitle>
            <CardDescription>
              Users created via admin panel (+1 555 numbers)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTestUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No test users found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTestUsers.map((user, idx) => (
                      <TableRow key={user.user_id}>
                        <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{user.name || "—"}</span>
                            {user.isPremium && (
                              <Crown className="w-3 h-3 text-amber-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {user.phone_number || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTestUser(user.user_id, user.phone_number || "")}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
