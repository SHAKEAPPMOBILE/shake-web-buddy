import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Check, X, Eye, Search, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Verification {
  id: string;
  user_id: string;
  document_url: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  auto_approved_at: string | null;
  user_name?: string;
  user_email?: string;
}

interface VerificationsTabProps {
  adminPassword: string;
}

export function VerificationsTab({ adminPassword }: VerificationsTabProps) {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchVerifications = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch verifications using edge function with password in query params
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${adminPassword}&action=list-verifications`
      );
      
      if (!response.ok) throw new Error("Failed to fetch verifications");
      const data = await response.json();
      setVerifications(data?.verifications || []);
    } catch (error) {
      console.error("Error fetching verifications:", error);
      toast.error("Failed to load verifications");
    } finally {
      setIsLoading(false);
    }
  }, [adminPassword]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  const handleViewDocument = async (verification: Verification) => {
    setSelectedVerification(verification);
    setRejectionReason("");
    
    try {
      // Get signed URL for the document using password in query params
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${adminPassword}&action=get-verification-document`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentPath: verification.document_url }),
        }
      );
      
      if (!response.ok) throw new Error("Failed to get document");
      const data = await response.json();
      setPreviewUrl(data?.signedUrl || null);
    } catch (error) {
      console.error("Error getting document URL:", error);
      toast.error("Failed to load document");
      setPreviewUrl(null);
    }
  };

  const handleApprove = async (verification: Verification) => {
    setIsProcessing(true);
    try {
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${adminPassword}&action=update-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            verificationId: verification.id,
            status: "approved",
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to approve");
      
      toast.success("Verification approved!");
      setSelectedVerification(null);
      fetchVerifications();
    } catch (error) {
      console.error("Error approving verification:", error);
      toast.error("Failed to approve");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (verification: Verification) => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    
    setIsProcessing(true);
    try {
      const response = await fetch(
        `https://tgodytoqakzycabncfpo.supabase.co/functions/v1/seed-test-users?password=${adminPassword}&action=update-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            verificationId: verification.id,
            status: "rejected",
            rejectionReason: rejectionReason.trim(),
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to reject");
      
      toast.success("Verification rejected");
      setSelectedVerification(null);
      fetchVerifications();
    } catch (error) {
      console.error("Error rejecting verification:", error);
      toast.error("Failed to reject");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredVerifications = verifications.filter(v => 
    v.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = verifications.filter(v => v.status === "pending").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">ID Verifications</h3>
          {pendingCount > 0 && (
            <Badge variant="destructive">{pendingCount} pending</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchVerifications}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredVerifications.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No verifications found
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reviewed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVerifications.map((verification) => (
              <TableRow key={verification.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{verification.user_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{verification.user_email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  {format(new Date(verification.submitted_at), "MMM d, yyyy HH:mm")}
                </TableCell>
                <TableCell>
                  {getStatusBadge(verification.status)}
                  {verification.auto_approved_at && (
                    <span className="ml-2 text-xs text-muted-foreground">(auto)</span>
                  )}
                </TableCell>
                <TableCell>
                  {verification.reviewed_at ? (
                    <span className="text-sm">
                      {format(new Date(verification.reviewed_at), "MMM d, yyyy HH:mm")}
                      {verification.reviewed_by && (
                        <span className="text-xs text-muted-foreground block">
                          by {verification.reviewed_by}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDocument(verification)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Document Preview Dialog */}
      <Dialog open={!!selectedVerification} onOpenChange={() => setSelectedVerification(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              ID Verification - {selectedVerification?.user_name || "Unknown User"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* User Info */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <p className="text-sm"><strong>User:</strong> {selectedVerification?.user_name}</p>
              <p className="text-sm"><strong>Email:</strong> {selectedVerification?.user_email}</p>
              <p className="text-sm">
                <strong>Submitted:</strong>{" "}
                {selectedVerification && format(new Date(selectedVerification.submitted_at), "PPpp")}
              </p>
              <p className="text-sm">
                <strong>Status:</strong> {selectedVerification?.status}
                {selectedVerification?.auto_approved_at && " (auto-approved)"}
              </p>
            </div>

            {/* Document Preview */}
            <div className="border rounded-lg p-4 bg-muted/30">
              {previewUrl ? (
                previewUrl.includes(".pdf") ? (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">PDF Document</p>
                    <a 
                      href={previewUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary hover:underline"
                    >
                      <Download className="w-4 h-4" />
                      View PDF
                    </a>
                  </div>
                ) : (
                  <img
                    src={previewUrl}
                    alt="ID Document"
                    className="max-w-full max-h-96 mx-auto rounded-lg object-contain"
                  />
                )
              ) : (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              )}
            </div>

            {/* Actions */}
            {selectedVerification?.status === "pending" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(selectedVerification)}
                    disabled={isProcessing}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleReject(selectedVerification)}
                    disabled={isProcessing || !rejectionReason.trim()}
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
                <Textarea
                  placeholder="Rejection reason (required for rejection)"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            )}

            {selectedVerification?.status === "rejected" && selectedVerification.rejection_reason && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
                <p className="text-sm">{selectedVerification.rejection_reason}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
