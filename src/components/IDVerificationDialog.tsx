import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, Clock, XCircle, AlertTriangle, Shield } from "lucide-react";
import { useCreatorVerification } from "@/hooks/useCreatorVerification";
import { LoadingSpinner } from "./LoadingSpinner";
import { useTranslation } from "react-i18next";

interface IDVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerificationComplete?: () => void;
}

export function IDVerificationDialog({
  open,
  onOpenChange,
  onVerificationComplete,
}: IDVerificationDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { verification, isUploading, isVerified, isPending, isRejected, uploadVerification } = useCreatorVerification();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!validTypes.includes(file.type)) {
        alert("Please upload a JPG, PNG, WebP, or PDF file");
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB");
        return;
      }

      setSelectedFile(file);
      
      // Create preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => setPreviewUrl(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    
    const success = await uploadVerification(selectedFile);
    if (success) {
      setSelectedFile(null);
      setPreviewUrl(null);
      onVerificationComplete?.();
    }
  };

  const renderStatus = () => {
    if (isVerified) {
      return (
        <div className="flex flex-col items-center text-center py-6">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-green-500">Verified</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Your identity has been verified. You can now create paid activities.
          </p>
          <Button onClick={() => onOpenChange(false)} className="mt-4">
            Continue
          </Button>
        </div>
      );
    }

    if (isPending) {
      return (
        <div className="flex flex-col items-center text-center py-6">
          <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
          <h3 className="text-lg font-semibold text-yellow-500">Under Review</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Your ID is being reviewed. You'll be verified within 1 hour.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Submitted: {new Date(verification!.submitted_at).toLocaleString()}
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-4">
            Close
          </Button>
        </div>
      );
    }

    if (isRejected) {
      return (
        <div className="flex flex-col items-center text-center py-6">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-destructive">Verification Rejected</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {verification?.rejection_reason || "Your ID could not be verified. Please resubmit."}
          </p>
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            className="mt-4"
          >
            Upload New ID
          </Button>
        </div>
      );
    }

    // Default: Upload form
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <Shield className="w-5 h-5 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            To create paid activities, we need to verify your identity. This helps keep our community safe.
          </p>
        </div>

        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 cursor-pointer hover:border-primary/50 transition-colors flex flex-col items-center"
        >
          {previewUrl ? (
            <img 
              src={previewUrl} 
              alt="ID Preview" 
              className="max-h-48 rounded-lg object-contain mb-4"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          
          <p className="font-medium">
            {selectedFile ? selectedFile.name : "Click to upload your ID"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Passport, driver's license, or national ID
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WebP, or PDF (max 10MB)
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Your ID is stored securely and only accessible to our admin team for verification purposes.
          </p>
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={!selectedFile || isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <LoadingSpinner size="sm" />
              <span className="ml-2">Uploading...</span>
            </>
          ) : (
            "Submit for Verification"
          )}
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            ID Verification
          </DialogTitle>
          <DialogDescription>
            Verify your identity to create paid activities
          </DialogDescription>
        </DialogHeader>

        {renderStatus()}
      </DialogContent>
    </Dialog>
  );
}
