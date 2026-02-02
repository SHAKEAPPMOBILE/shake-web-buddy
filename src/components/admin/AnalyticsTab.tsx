import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, Users, MapPin, Calendar, Activity, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AnalyticsTabProps {
  adminPassword: string;
}

interface MessageStats {
  total_messages: number;
  activity_messages: number;
  plan_messages: number;
  private_messages: number;
  messages_by_month: Array<{ month: string; count: number }>;
}

interface UserStats {
  total_users: number;
  users_by_country: Array<{ country: string; count: number }>;
  users_by_city: Array<{ city: string; count: number }>;
}

interface ActivityStats {
  total_activities: number;
  activities_by_city: Array<{ city: string; count: number }>;
  activities_by_type: Array<{ type: string; count: number }>;
}

interface CheckInRecord {
  id: string;
  venue_name: string;
  city: string;
  activity_type: string;
  check_in_date: string;
  user_name: string;
}

interface CheckInStats {
  total_check_ins: number;
  check_ins_by_city: Array<{ city: string; count: number }>;
  check_ins_by_venue: Array<{ venue: string; city: string; count: number }>;
  recent_check_ins: CheckInRecord[];
}

interface AnalyticsData {
  messages: MessageStats;
  users: UserStats;
  activities: ActivityStats;
  check_ins: CheckInStats;
}

export function AnalyticsTab({ adminPassword }: AnalyticsTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${adminPassword}&action=analytics`
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch analytics");
      }
      
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [adminPassword]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchAnalytics}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={fetchAnalytics} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh Data
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-2xl font-bold">{data.messages.total_messages.toLocaleString()}</p>
                <p className="text-sm opacity-90">Total Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-2xl font-bold">{data.users.total_users.toLocaleString()}</p>
                <p className="text-sm opacity-90">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-2xl font-bold">{data.activities.total_activities.toLocaleString()}</p>
                <p className="text-sm opacity-90">Activities Created</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MapPin className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-2xl font-bold">{data.check_ins.total_check_ins.toLocaleString()}</p>
                <p className="text-sm opacity-90">Total Check-ins</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="messages" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="checkins">Check-ins</TabsTrigger>
        </TabsList>

        {/* Messages Tab */}
        <TabsContent value="messages" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Activity Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.messages.activity_messages.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Plan Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.messages.plan_messages.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Private Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.messages.private_messages.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Messages by Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.messages.messages_by_month.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No message data available</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Messages</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.messages.messages_by_month.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium">{row.month}</TableCell>
                        <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Users by Country (Nationality)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.users.users_by_country.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No nationality data available</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Country</TableHead>
                        <TableHead className="text-right">Users</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.users.users_by_country.slice(0, 15).map((row) => (
                        <TableRow key={row.country}>
                          <TableCell className="font-medium">{row.country || "Not Set"}</TableCell>
                          <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Users Active by City
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.users.users_by_city.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No city activity data available</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>City</TableHead>
                        <TableHead className="text-right">Users</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.users.users_by_city.slice(0, 15).map((row) => (
                        <TableRow key={row.city}>
                          <TableCell className="font-medium">{row.city}</TableCell>
                          <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Activities by City
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.activities.activities_by_city.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No activity data available</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>City</TableHead>
                        <TableHead className="text-right">Activities</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.activities.activities_by_city.map((row) => (
                        <TableRow key={row.city}>
                          <TableCell className="font-medium">{row.city}</TableCell>
                          <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Activities by Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.activities.activities_by_type.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No activity data available</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.activities.activities_by_type.map((row) => (
                        <TableRow key={row.type}>
                          <TableCell className="font-medium capitalize">{row.type}</TableCell>
                          <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Check-ins Tab */}
        <TabsContent value="checkins" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Check-ins by City
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.check_ins.check_ins_by_city.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No check-in data available</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>City</TableHead>
                        <TableHead className="text-right">Check-ins</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.check_ins.check_ins_by_city.map((row) => (
                        <TableRow key={row.city}>
                          <TableCell className="font-medium">{row.city}</TableCell>
                          <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Check-ins by Venue
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.check_ins.check_ins_by_venue.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No check-in data available</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Venue</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.check_ins.check_ins_by_venue.slice(0, 15).map((row, idx) => (
                        <TableRow key={`${row.venue}-${row.city}-${idx}`}>
                          <TableCell className="font-medium">{row.venue}</TableCell>
                          <TableCell>{row.city}</TableCell>
                          <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Recent Check-ins
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.check_ins.recent_check_ins.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No recent check-ins</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.check_ins.recent_check_ins.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{new Date(row.check_in_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{row.user_name || "Unknown"}</TableCell>
                        <TableCell>{row.venue_name}</TableCell>
                        <TableCell>{row.city}</TableCell>
                        <TableCell className="capitalize">{row.activity_type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
