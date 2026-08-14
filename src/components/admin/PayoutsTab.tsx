import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Loader2, DollarSign, CreditCard, Wallet, AlertCircle, CheckCircle2, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/app-toast";
import { supabase } from "@/integrations/supabase/client";

interface CreatorActivity {
  id: string;
  type: string;
  city: string;
  note: string | null;
  price: string;
  participants: number;
  gross: number;
  net: number;
  scheduled_for: string;
  created_at: string;
}

interface CreatorPayout {
  user_id: string;
  name: string | null;
  phone_number: string | null;
  preferred_payout_method: string | null;
  stripe_account_id: string | null;
  stripe_account_status: string | null;
  stripe_email: string | null;
  paypal_connected: boolean;
  paypal_email: string | null;
  total_gross: number;
  total_net: number;
  already_paid: number;
  pending_payout: number;
  currency: string;
  activity_count: number;
  participant_count: number;
  activities: CreatorActivity[];
}

interface PayoutHistory {
  id: string;
  creator_user_id: string;
  amount: number;
  currency: string;
  payout_method: string;
  payout_email: string | null;
  stripe_account_id: string | null;
  notes: string | null;
  paid_at: string;
  paid_by: string | null;
}

interface ProfilePayoutMethods {
  user_id: string;
  name: string | null;
  payout_paypal: string | null;
  payout_venmo: string | null;
  payout_cashapp: string | null;
}

export function PayoutsTab({ adminPassword }: { adminPassword: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCreators, setExpandedCreators] = useState<Set<string>>(new Set());
  const [markPaidDialog, setMarkPaidDialog] = useState<CreatorPayout | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const queryClient = useQueryClient();

  // Fetch payout data via edge function
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: async () => {
      const response = await fetch(
        `https://mpgrjzubegorcijgfjri.supabase.co/functions/v1/seed-test-users?password=${adminPassword}&action=list-payouts`
      );
      const result = await response.json();
      if (!result.success) {
        console.error("Failed to fetch payouts:", result.error);
        return { payouts: [], payout_history: [] };
      }
      return {
        payouts: result.payouts as CreatorPayout[],
        payout_history: result.payout_history as PayoutHistory[],
      };
    },
  });

  const payouts = data?.payouts || [];
  const payoutHistory = data?.payout_history || [];

  // Fetch payout method handles from profiles for all creators
  const { data: profileMethods } = useQuery({
    queryKey: ['admin-payout-profiles', payouts.map(p => p.user_id).join(',')],
    queryFn: async () => {
      if (!payouts.length) return {} as Record<string, ProfilePayoutMethods>;
      const { data: rows } = await supabase
        .from("profiles")
        .select("user_id, name, payout_paypal, payout_venmo, payout_cashapp")
        .in("user_id", payouts.map(p => p.user_id));
      return Object.fromEntries(
        (rows || []).map(r => [r.user_id, r as ProfilePayoutMethods])
      ) as Record<string, ProfilePayoutMethods>;
    },
    enabled: payouts.length > 0,
  });

  // Fetch Venmo / CashApp counts from profiles (independent of payout list)
  const { data: methodCounts } = useQuery({
    queryKey: ['admin-payout-method-counts'],
    queryFn: async () => {
      const [venmoRes, cashappRes, paypalRes] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact", head: true }).not("payout_venmo", "is", null),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }).not("payout_cashapp", "is", null),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }).not("payout_paypal", "is", null),
      ]);
      return {
        venmo: venmoRes.count ?? 0,
        cashapp: cashappRes.count ?? 0,
        paypal: paypalRes.count ?? 0,
      };
    },
  });

  // Mark as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async (params: {
      creator_user_id: string;
      amount: number;
      payout_method: string;
      payout_email?: string;
      stripe_account_id?: string;
      notes?: string;
    }) => {
      const response = await fetch(
        `https://mpgrjzubegorcijgfjri.supabase.co/functions/v1/seed-test-users?password=${adminPassword}&action=mark-paid`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        }
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("Payout recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      setMarkPaidDialog(null);
      setPayoutAmount("");
      setPayoutNotes("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to record payout");
    },
  });

  // Filter by search (includes venmo/cashapp handles)
  const filteredPayouts = useMemo(() => {
    if (!searchQuery.trim()) return payouts;
    const q = searchQuery.toLowerCase();
    return payouts.filter(p => {
      const profile = profileMethods?.[p.user_id];
      return (
        p.name?.toLowerCase().includes(q) ||
        p.phone_number?.includes(q) ||
        p.paypal_email?.toLowerCase().includes(q) ||
        p.stripe_email?.toLowerCase().includes(q) ||
        p.stripe_account_id?.toLowerCase().includes(q) ||
        profile?.payout_paypal?.toLowerCase().includes(q) ||
        profile?.payout_venmo?.toLowerCase().includes(q) ||
        profile?.payout_cashapp?.toLowerCase().includes(q)
      );
    });
  }, [payouts, searchQuery, profileMethods]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalGross = payouts.reduce((sum, p) => sum + p.total_gross, 0);
    const totalNet = payouts.reduce((sum, p) => sum + p.total_net, 0);
    const totalPaid = payouts.reduce((sum, p) => sum + p.already_paid, 0);
    const totalPending = payouts.reduce((sum, p) => sum + p.pending_payout, 0);
    return { totalGross, totalNet, totalPaid, totalPending };
  }, [payouts]);

  const formatCurrency = (amount: number, currency: string = "USD") =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const toggleExpanded = (userId: string) => {
    setExpandedCreators(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const handleMarkPaid = () => {
    if (!markPaidDialog || !payoutAmount) return;
    const profile = profileMethods?.[markPaidDialog.user_id];
    markPaidMutation.mutate({
      creator_user_id: markPaidDialog.user_id,
      amount: parseFloat(payoutAmount),
      payout_method: markPaidDialog.preferred_payout_method || "manual",
      payout_email:
        profile?.payout_paypal ||
        profile?.payout_venmo ||
        profile?.payout_cashapp ||
        markPaidDialog.paypal_email ||
        markPaidDialog.stripe_email ||
        undefined,
      stripe_account_id: markPaidDialog.stripe_account_id || undefined,
      notes: payoutNotes || undefined,
    });
  };

  // Returns all method badges for a creator
  const getPayoutMethodBadges = (payout: CreatorPayout) => {
    const profile = profileMethods?.[payout.user_id];
    const badges: React.ReactNode[] = [];

    if (profile?.payout_paypal) {
      badges.push(
        <Badge key="paypal" className="bg-[#0070BA]/10 text-[#0070BA] border-[#0070BA]/30 gap-1">
          <Wallet className="w-3 h-3" />
          PayPal
        </Badge>
      );
    }
    if (profile?.payout_venmo) {
      badges.push(
        <Badge key="venmo" className="bg-[#3D95CE]/10 text-[#3D95CE] border-[#3D95CE]/30 gap-1">
          <span className="text-[10px] font-bold">V</span>
          Venmo
        </Badge>
      );
    }
    if (profile?.payout_cashapp) {
      badges.push(
        <Badge key="cashapp" className="bg-[#00D632]/10 text-[#00D632] border-[#00D632]/30 gap-1">
          <span className="text-[10px] font-bold">$</span>
          CashApp
        </Badge>
      );
    }
    // Legacy Stripe / PayPal-connected fields
    if (!badges.length && payout.stripe_account_id) {
      badges.push(
        <Badge key="stripe" className="bg-[#635BFF]/10 text-[#635BFF] border-[#635BFF]/30 gap-1">
          <CreditCard className="w-3 h-3" />
          Stripe
        </Badge>
      );
    }
    if (!badges.length && payout.paypal_email) {
      badges.push(
        <Badge key="paypal-legacy" className="bg-[#0070BA]/10 text-[#0070BA] border-[#0070BA]/30 gap-1">
          <Wallet className="w-3 h-3" />
          PayPal
        </Badge>
      );
    }
    if (!badges.length) {
      badges.push(
        <Badge key="none" variant="outline" className="text-muted-foreground gap-1">
          <AlertCircle className="w-3 h-3" />
          Not Set
        </Badge>
      );
    }
    return <div className="flex flex-wrap gap-1">{badges}</div>;
  };

  return (
    <div className="space-y-6">
      {/* Financial Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold text-green-700">{formatCurrency(totals.totalPending)}</span>
            </div>
            <p className="text-sm text-green-600 font-medium">Pending Payouts</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold text-blue-700">{formatCurrency(totals.totalPaid)}</span>
            </div>
            <p className="text-sm text-blue-600 font-medium">Already Paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Method Counts */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-[#0070BA]/10 to-[#0070BA]/20 border-[#0070BA]/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#0070BA]" />
              <span className="text-3xl font-bold text-[#0070BA]">{methodCounts?.paypal ?? "—"}</span>
            </div>
            <p className="text-sm text-[#0070BA] font-medium">PayPal Users</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#3D95CE]/10 to-[#3D95CE]/20 border-[#3D95CE]/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-[#3D95CE]">V</span>
              <span className="text-3xl font-bold text-[#3D95CE]">{methodCounts?.venmo ?? "—"}</span>
            </div>
            <p className="text-sm text-[#3D95CE] font-medium">Venmo Users</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#00D632]/10 to-[#00D632]/20 border-[#00D632]/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-[#00D632]">$</span>
              <span className="text-3xl font-bold text-[#00D632]">{methodCounts?.cashapp ?? "—"}</span>
            </div>
            <p className="text-sm text-[#00D632] font-medium">CashApp Users</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-blue-900">Manual Payout System</p>
              <p className="text-blue-700 mt-1">
                All payments go to SHAKE's Stripe account. Creators receive their 85% share via manual transfer to their PayPal, Venmo, or CashApp account.
                Click "Mark Paid" after transferring funds to record the payout.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, email, @venmo, $cashtag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Payouts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Creator Earnings ({filteredPayouts.length})
          </CardTitle>
          <CardDescription>
            Click on a creator to see their activity details and mark payouts as complete
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="text-center text-destructive py-8">Error loading payouts</p>
            ) : filteredPayouts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No creators with paid activities found</p>
            ) : (
              <div className="space-y-2">
                {filteredPayouts.map((payout) => {
                  const isExpanded = expandedCreators.has(payout.user_id);
                  const profile = profileMethods?.[payout.user_id];
                  return (
                    <div key={payout.user_id} className="border rounded-2xl overflow-hidden">
                      {/* Header Row */}
                      <div
                        className="flex items-center gap-4 p-4 bg-card hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleExpanded(payout.user_id)}
                      >
                        <button className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{payout.name || "—"}</span>
                            {getPayoutMethodBadges(payout)}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {payout.phone_number || "—"}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-medium text-green-600">
                            {formatCurrency(payout.pending_payout)} pending
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(payout.total_net)} total ({payout.activity_count} activities)
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant={payout.pending_payout > 0 ? "default" : "outline"}
                          disabled={payout.pending_payout <= 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMarkPaidDialog(payout);
                            setPayoutAmount(payout.pending_payout.toFixed(2));
                          }}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Mark Paid
                        </Button>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t bg-muted/20 p-4 space-y-4">
                          {/* User + Payout Methods */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground text-xs uppercase tracking-wide">Name</span>
                              <p className="font-medium mt-0.5">{payout.name || "—"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs uppercase tracking-wide">Phone</span>
                              <p className="font-mono text-xs mt-0.5">{payout.phone_number || "—"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs uppercase tracking-wide">Already Paid</span>
                              <p className="font-medium text-blue-600 mt-0.5">{formatCurrency(payout.already_paid)}</p>
                            </div>
                          </div>

                          {/* Payout Handles */}
                          <div className="rounded-xl border bg-white p-3 space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payout Methods</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-[#0070BA] rounded-lg flex items-center justify-center shrink-0">
                                  <span className="text-white text-[9px] font-bold">PP</span>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">PayPal</p>
                                  <p className="text-xs font-mono font-medium">
                                    {profile?.payout_paypal || payout.paypal_email || <span className="text-muted-foreground italic">not set</span>}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-[#3D95CE] rounded-lg flex items-center justify-center shrink-0">
                                  <span className="text-white text-[9px] font-bold">V</span>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Venmo</p>
                                  <p className="text-xs font-mono font-medium">
                                    {profile?.payout_venmo || <span className="text-muted-foreground italic">not set</span>}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-[#00D632] rounded-lg flex items-center justify-center shrink-0">
                                  <span className="text-white text-[9px] font-bold">$</span>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">CashApp</p>
                                  <p className="text-xs font-mono font-medium">
                                    {profile?.payout_cashapp || <span className="text-muted-foreground italic">not set</span>}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Activities Table */}
                          <div>
                            <h4 className="font-medium mb-2">Paid Activities</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Activity</TableHead>
                                  <TableHead>City</TableHead>
                                  <TableHead>Price</TableHead>
                                  <TableHead className="text-center">Joined</TableHead>
                                  <TableHead className="text-right">Gross</TableHead>
                                  <TableHead className="text-right">Net (85%)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {payout.activities.map((activity) => (
                                  <TableRow key={activity.id}>
                                    <TableCell>
                                      <div>
                                        <span className="font-medium">{activity.type}</span>
                                        {activity.note && (
                                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                            {activity.note}
                                          </p>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-sm">{activity.city}</TableCell>
                                    <TableCell className="text-sm">{activity.price}</TableCell>
                                    <TableCell className="text-center">{activity.participants}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(activity.gross)}</TableCell>
                                    <TableCell className="text-right text-green-600 font-medium">
                                      {formatCurrency(activity.net)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recent Payout History */}
      {payoutHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Recent Payout History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Email/Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutHistory.slice(0, 10).map((history) => {
                  const creator = payouts.find(p => p.user_id === history.creator_user_id);
                  return (
                    <TableRow key={history.id}>
                      <TableCell className="text-sm">
                        {new Date(history.paid_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {creator?.name || history.creator_user_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {history.payout_method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {history.payout_email || history.stripe_account_id || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(history.amount, history.currency)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                        {history.notes || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Mark Paid Dialog */}
      <Dialog open={!!markPaidDialog} onOpenChange={() => setMarkPaidDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payout</DialogTitle>
            <DialogDescription>
              Record a manual payout to {markPaidDialog?.name || "creator"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Payout Methods</Label>
              <div className="rounded-xl border bg-muted/30 p-3 space-y-2 text-sm">
                {(() => {
                  const profile = markPaidDialog ? profileMethods?.[markPaidDialog.user_id] : null;
                  const methods = [
                    profile?.payout_paypal && { label: "PayPal", value: profile.payout_paypal, color: "#0070BA" },
                    profile?.payout_venmo && { label: "Venmo", value: profile.payout_venmo, color: "#3D95CE" },
                    profile?.payout_cashapp && { label: "CashApp", value: profile.payout_cashapp, color: "#00D632" },
                    markPaidDialog?.paypal_email && !profile?.payout_paypal && { label: "PayPal (legacy)", value: markPaidDialog.paypal_email, color: "#0070BA" },
                  ].filter(Boolean) as { label: string; value: string; color: string }[];
                  return methods.length > 0 ? (
                    <div className="space-y-1">
                      {methods.map(m => (
                        <div key={m.label} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-20">{m.label}:</span>
                          <span className="font-mono text-xs font-medium" style={{ color: m.color }}>{m.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No payout methods configured</p>
                  );
                })()}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount Paid (USD)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Pending: {formatCurrency(markPaidDialog?.pending_payout || 0)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                placeholder="Transaction ID, reference, etc."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleMarkPaid}
              disabled={!payoutAmount || markPaidMutation.isPending}
            >
              {markPaidMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Record Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
