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
          <h3 className="text-lg font-semibold text-green-500">{t("idVerification.verified")}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {t("idVerification.verifiedMessage")}
          </p>
          <Button onClick={() => onOpenChange(false)} className="mt-4">
            {t("idVerification.continue")}
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
          <h3 className="text-lg font-semibold text-yellow-500">{t("idVerification.underReview")}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {t("idVerification.underReviewMessage")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("idVerification.submitted")}: {new Date(verification!.submitted_at).toLocaleString()}
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-4">
            {t("common.close")}
          </Button>
        </div>
      );
    }

    if (isRejected && !selectedFile) {
      return (
        <div className="flex flex-col items-center text-center py-6">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-destructive">{t("idVerification.rejected")}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {verification?.rejection_reason || t("idVerification.rejectedMessage")}
          </p>
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            className="mt-4"
          >
            {t("idVerification.uploadNewId")}
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
            {t("idVerification.securityNote")}
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
            {selectedFile ? selectedFile.name : t("idVerification.clickToUpload")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("idVerification.acceptedDocuments")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("idVerification.fileFormats")}
          </p>
        </div>


        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            {t("idVerification.privacyNote")}
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
              <span className="ml-2">{t("idVerification.uploading")}</span>
            </>
          ) : (
            t("idVerification.submitButton")
          )}
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {t("idVerification.title")}
          </DialogTitle>
          <DialogDescription>
            {t("idVerification.description")}
          </DialogDescription>
        </DialogHeader>

        {renderStatus()}
        
        {/* Hidden file input - always present for rejected state reupload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </DialogContent>
    </Dialog>
  );
}
