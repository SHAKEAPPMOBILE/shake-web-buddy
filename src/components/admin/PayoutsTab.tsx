import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, DollarSign, CreditCard, Wallet, AlertCircle, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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
  pending_payout: number; // Amount to pay manually (PayPal users)
  currency: string;
  activity_count: number;
  participant_count: number;
}

export function PayoutsTab({ adminPassword }: { adminPassword: string }) {
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch payout data via edge function
  const { data: payouts = [], isLoading, error } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: async () => {
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${adminPassword}&action=list-payouts`
      );
      
      const data = await response.json();
      
      if (!data.success || !data.payouts) {
        console.error("Failed to fetch payouts:", data.error);
        return [];
      }
      
      return data.payouts as CreatorPayout[];
    },
  });

  // Filter by search
  const filteredPayouts = useMemo(() => {
    if (!searchQuery.trim()) return payouts;
    const q = searchQuery.toLowerCase();
    return payouts.filter(p => 
      p.name?.toLowerCase().includes(q) || 
      p.phone_number?.includes(q) ||
      p.paypal_email?.toLowerCase().includes(q) ||
      p.stripe_email?.toLowerCase().includes(q)
    );
  }, [payouts, searchQuery]);

  // Calculate totals
  const totals = useMemo(() => {
    const stripeCreators = payouts.filter(p => p.preferred_payout_method === "stripe" && p.stripe_account_status === "complete");
    const paypalCreators = payouts.filter(p => p.preferred_payout_method === "paypal" && p.paypal_connected);
    const pendingSetup = payouts.filter(p => !p.preferred_payout_method || 
      (p.preferred_payout_method === "stripe" && p.stripe_account_status !== "complete") ||
      (p.preferred_payout_method === "paypal" && !p.paypal_connected)
    );
    
    const totalGross = payouts.reduce((sum, p) => sum + p.total_gross, 0);
    const totalNet = payouts.reduce((sum, p) => sum + p.total_net, 0);
    const manualPayoutNeeded = paypalCreators.reduce((sum, p) => sum + p.total_net, 0);

    return {
      stripeCount: stripeCreators.length,
      paypalCount: paypalCreators.length,
      pendingCount: pendingSetup.length,
      totalGross,
      totalNet,
      manualPayoutNeeded,
    };
  }, [payouts]);

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-[#635BFF]/10 to-[#635BFF]/20 border-[#635BFF]/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#635BFF]" />
              <span className="text-3xl font-bold text-[#635BFF]">{totals.stripeCount}</span>
            </div>
            <p className="text-sm text-[#635BFF] font-medium">Stripe (Auto)</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#0070BA]/10 to-[#0070BA]/20 border-[#0070BA]/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#0070BA]" />
              <span className="text-3xl font-bold text-[#0070BA]">{totals.paypalCount}</span>
            </div>
            <p className="text-sm text-[#0070BA] font-medium">PayPal (Manual)</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span className="text-3xl font-bold text-amber-700">{totals.pendingCount}</span>
            </div>
            <p className="text-sm text-amber-600 font-medium">Pending Setup</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold text-green-700">{formatCurrency(totals.manualPayoutNeeded)}</span>
            </div>
            <p className="text-sm text-green-600 font-medium">Manual Payout Needed</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-blue-900">Payout Methods</p>
              <p className="text-blue-700 mt-1">
                <strong>Stripe:</strong> Creators receive 85% automatically via Stripe Connect destination charges.<br/>
                <strong>PayPal:</strong> You receive 100% in your Stripe account, then manually pay creators via PayPal.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or email..."
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
            All creators with paid activities and their payout information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="text-center text-destructive py-8">Error loading payouts</p>
            ) : filteredPayouts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No creators with paid activities found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead>Payout Method</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net (85%)</TableHead>
                    <TableHead className="text-center">Activities</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayouts.map((payout) => (
                    <TableRow key={payout.user_id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{payout.name || "—"}</span>
                          <p className="text-xs text-muted-foreground font-mono">
                            {payout.phone_number || "—"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {payout.preferred_payout_method === "stripe" && payout.stripe_account_status === "complete" ? (
                          <Badge className="bg-[#635BFF]/10 text-[#635BFF] border-[#635BFF]/30 gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Stripe (Auto)
                          </Badge>
                        ) : payout.preferred_payout_method === "paypal" && payout.paypal_connected ? (
                          <Badge className="bg-[#0070BA]/10 text-[#0070BA] border-[#0070BA]/30 gap-1">
                            <Wallet className="w-3 h-3" />
                            PayPal (Manual)
                          </Badge>
                        ) : payout.preferred_payout_method === "stripe" && payout.stripe_account_status === "pending" ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Stripe Pending
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Not Set
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {payout.preferred_payout_method === "paypal" && payout.paypal_email ? (
                          <span className="text-[#0070BA]">{payout.paypal_email}</span>
                        ) : payout.stripe_email ? (
                          <span className="text-[#635BFF]">{payout.stripe_email}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(payout.total_gross, payout.currency)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(payout.total_net, payout.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">{payout.activity_count}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({payout.participant_count} joined)
                        </span>
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
