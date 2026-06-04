import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, FlaskConical, UserCheck, Loader2, Crown, Plus, Trash2, UsersRound, ChevronDown, ChevronRight, Instagram, Linkedin, Twitter, MapPin, Briefcase, Globe, Calendar, Heart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { useDailyTheme } from "@/hooks/useDailyTheme";
import { useToast } from "@/hooks/use-toast";

interface UserData {
  user_id: string;
  name: string | null;
  phone_number: string | null;
  email: string | null;
  created_at: string;
  isPremium?: boolean;
  password?: string | null;
  city?: string | null;
  occupation?: string | null;
  nationality?: string | null;
  date_of_birth?: string | null;
  interests?: string[] | null;
  instagram_url?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
}

interface TestUserFormProps {
  password: string;
  onUserCreated: () => void;
}

function TestUserForm({ password, onUserCreated }: TestUserFormProps) {
  const theme = useDailyTheme();
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
        <CardTitle className="flex items-center gap-2 text-gray-900">
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
            <Input type="tel" placeholder="+1 555 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Password</label>
            <Input type="text" placeholder="Test1234!" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Name</label>
            <Input type="text" placeholder="Test User" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 p-3 bg-amber-50 rounded-2xl border border-amber-200">
          <Switch checked={isPremium} onCheckedChange={setIsPremium} className="data-[state=checked]:bg-amber-500" />
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-600" />
            <span className="font-medium text-amber-800">Super-Human Status</span>
          </div>
        </div>
        <Button onClick={createUser} className="mt-4" disabled={isLoading}>
          {isLoading ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Plus className="mr-2 w-4 h-4" />}
          Create Test User
        </Button>
      </CardContent>
    </Card>
  );
}

function UserDetailRow({ user }: { user: UserData }) {
  const dob = user.date_of_birth
    ? new Date(user.date_of_birth).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  const interests = Array.isArray(user.interests)
    ? user.interests.join(", ")
    : user.interests
      ? String(user.interests)
      : null;

  return (
    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
      {user.email && (
        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wide">Email</span>
          <p className="text-gray-800 font-medium break-all">{user.email}</p>
        </div>
      )}
      {user.phone_number && (
        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wide">Phone</span>
          <p className="text-gray-800 font-mono">{user.phone_number}</p>
        </div>
      )}
      {user.city && (
        <div className="flex flex-col">
          <span className="text-gray-500 text-xs uppercase tracking-wide flex items-center gap-1"><MapPin className="w-3 h-3" />City</span>
          <p className="text-gray-800">{user.city}</p>
        </div>
      )}
      {user.nationality && (
        <div className="flex flex-col">
          <span className="text-gray-500 text-xs uppercase tracking-wide flex items-center gap-1"><Globe className="w-3 h-3" />Nationality</span>
          <p className="text-gray-800">{user.nationality}</p>
        </div>
      )}
      {user.occupation && (
        <div className="flex flex-col">
          <span className="text-gray-500 text-xs uppercase tracking-wide flex items-center gap-1"><Briefcase className="w-3 h-3" />Occupation</span>
          <p className="text-gray-800">{user.occupation}</p>
        </div>
      )}
      {dob && (
        <div className="flex flex-col">
          <span className="text-gray-500 text-xs uppercase tracking-wide flex items-center gap-1"><Calendar className="w-3 h-3" />Birthday</span>
          <p className="text-gray-800">{dob}</p>
        </div>
      )}
      {interests && (
        <div className="col-span-2 flex flex-col">
          <span className="text-gray-500 text-xs uppercase tracking-wide flex items-center gap-1"><Heart className="w-3 h-3" />Interests</span>
          <p className="text-gray-800">{interests}</p>
        </div>
      )}
      {user.bio && (
        <div className="col-span-2 md:col-span-3 flex flex-col">
          <span className="text-gray-500 text-xs uppercase tracking-wide">Bio</span>
          <p className="text-gray-700 italic">"{user.bio}"</p>
        </div>
      )}
      {(user.instagram_url || user.linkedin_url || user.twitter_url) && (
        <div className="col-span-2 md:col-span-3 flex gap-3">
          {user.instagram_url && (
            <a href={user.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-pink-600 hover:underline text-xs">
              <Instagram className="w-3.5 h-3.5" />Instagram
            </a>
          )}
          {user.linkedin_url && (
            <a href={user.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-700 hover:underline text-xs">
              <Linkedin className="w-3.5 h-3.5" />LinkedIn
            </a>
          )}
          {user.twitter_url && (
            <a href={user.twitter_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-500 hover:underline text-xs">
              <Twitter className="w-3.5 h-3.5" />Twitter
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function UsersTab({ adminPassword }: { adminPassword: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isBulkSeeding, setIsBulkSeeding] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const bulkSeedTestUsers = async () => {
    if (!confirm("This will create 20 test users with avatars and nationalities. Continue?")) return;

    setIsBulkSeeding(true);
    try {
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${adminPassword}&action=bulk-seed-test-users`
      );
      const data = await response.json();
      if (data.success) {
        toast({ title: "✅ Bulk seed complete!", description: `Created ${data.created} users, skipped ${data.skipped} existing` });
        refetch();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error bulk seeding users", variant: "destructive" });
    }
    setIsBulkSeeding(false);
  };

  const { data: allUsers = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: async () => {
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${adminPassword}&action=list-users`
      );
      const data = await response.json();
      if (!data.success || !data.users) {
        console.error("Failed to fetch users:", data.error);
        return [];
      }
      return data.users as UserData[];
    },
  });

  const { testUsers, realUsers } = useMemo(() => {
    const test: UserData[] = [];
    const real: UserData[] = [];
    allUsers.forEach(user => {
      const phone = user.phone_number || '';
      if (phone.includes('555') && (phone.startsWith('+1') || phone.startsWith('1'))) {
        test.push(user);
      } else {
        real.push(user);
      }
    });
    return { testUsers: test, realUsers: real };
  }, [allUsers]);

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
      u.phone_number?.includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.city?.toLowerCase().includes(q) ||
      u.occupation?.toLowerCase().includes(q) ||
      u.nationality?.toLowerCase().includes(q)
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

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const toggleExpand = (userId: string) =>
    setExpandedUserId(prev => prev === userId ? null : userId);

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
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              <span className="text-3xl font-bold text-primary">{testUsers.length}</span>
            </div>
            <p className="text-sm text-primary font-medium">Test Users</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          placeholder="Search by name, phone, email, city, occupation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Create Test User Form + Bulk Seed */}
      <div className="flex gap-4 items-start">
        <div className="flex-1">
          <TestUserForm password={adminPassword} onUserCreated={() => refetch()} />
        </div>
        <Card className="w-72">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-gray-900">
              <UsersRound className="w-4 h-4 text-indigo-600" />
              Bulk Seed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500 mb-3">
              Create 20 test users with avatars &amp; nationalities (USA, Colombia, Spain, France, Italy, UK, etc.)
            </p>
            <Button onClick={bulkSeedTestUsers} disabled={isBulkSeeding} className="w-full bg-indigo-600 hover:bg-indigo-700" size="sm">
              {isBulkSeeding ? (
                <><Loader2 className="animate-spin mr-2 w-4 h-4" />Creating...</>
              ) : (
                <><UsersRound className="mr-2 w-4 h-4" />Seed 20 Test Users</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Real Users — full width with expandable rows */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <UserCheck className="w-5 h-5 text-green-600" />
            Real Users ({filteredRealUsers.length})
          </CardTitle>
          <CardDescription>Click a row to expand full profile details</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : filteredRealUsers.length === 0 ? (
              <p className="text-center text-gray-600 py-8">No real users found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-gray-900 font-semibold w-8"></TableHead>
                    <TableHead className="text-gray-900 font-semibold">#</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Name</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Email</TableHead>
                    <TableHead className="text-gray-900 font-semibold">City</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRealUsers.map((user, idx) => (
                    <>
                      <TableRow
                        key={user.user_id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleExpand(user.user_id)}
                      >
                        <TableCell className="text-gray-400 w-8">
                          {expandedUserId === user.user_id
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />}
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{user.name || "—"}</span>
                            {user.isPremium && <Crown className="w-3 h-3 text-amber-500" />}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600 text-sm">{user.email || "—"}</TableCell>
                        <TableCell className="text-gray-600 text-sm">{user.city || "—"}</TableCell>
                        <TableCell className="text-gray-500 text-xs">{formatDate(user.created_at)}</TableCell>
                      </TableRow>
                      {expandedUserId === user.user_id && (
                        <tr key={`${user.user_id}-detail`}>
                          <td colSpan={6} className="p-0">
                            <UserDetailRow user={user} />
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Test Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <FlaskConical className="w-5 h-5 text-primary" />
            Test Users ({filteredTestUsers.length})
          </CardTitle>
          <CardDescription>Users created via admin panel (+1 555 numbers)</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : filteredTestUsers.length === 0 ? (
              <p className="text-center text-gray-600 py-8">No test users found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-gray-900 font-semibold">#</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Name</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Phone</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTestUsers.map((user, idx) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="text-gray-500 text-sm">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{user.name || "—"}</span>
                          {user.isPremium && <Crown className="w-3 h-3 text-amber-500" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600 text-xs font-mono">{user.phone_number || "—"}</TableCell>
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
  );
}
