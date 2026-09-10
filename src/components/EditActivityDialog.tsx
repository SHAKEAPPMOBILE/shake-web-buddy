import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect, useRef } from "react";
import { startOfDay, format } from "date-fns";
import { CalendarIcon, Trash2, ImagePlus, X } from "lucide-react";
import { VenueSearchInput, VenuePlace } from "@/components/VenueSearchInput";
import { cn } from "@/lib/utils";
import { useUserActivities } from "@/hooks/useUserActivities";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "./LoadingSpinner";
import { checkProfanity } from "@/lib/profanity-filter";
import { captureVideoFrame } from "@/lib/captureVideoFrame";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/app-toast";

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
];

const MAX_CHARACTERS = 50;

interface EditActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: string;
  city: string;
  onSaved?: () => void;
}

// Full row shape fetched fresh on open — the caller only ever has the
// narrow subset it needs for its own UI, not everything an edit needs.
interface FullActivityRow {
  note: string | null;
  description: string | null;
  scheduled_for: string;
  price_amount: string | null;
  price_tiers: { label: string; amount: number }[] | null;
  capacity: number | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  audience: "everyone" | "women_only" | "friends_only" | null;
  promo_image_url: string | null;
  promo_video_url: string | null;
}

export function EditActivityDialog({ open, onOpenChange, activityId, city, onSaved }: EditActivityDialogProps) {
  const { updateActivity, isLoading } = useUserActivities(city);
  const { user } = useAuth();
  const { t } = useTranslation();
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  const [loadingRow, setLoadingRow] = useState(true);
  const [planText, setPlanText] = useState("");
  const [description, setDescription] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("USD");
  const [extraPriceTiers, setExtraPriceTiers] = useState<{ label: string; amount: string }[]>([]);
  const [capacityInput, setCapacityInput] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venuePlace, setVenuePlace] = useState<VenuePlace | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [selectedTime, setSelectedTime] = useState("19:00");
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [audience, setAudience] = useState<"everyone" | "women_only" | "friends_only">("everyone");
  const [profanityError, setProfanityError] = useState<string | null>(null);

  // Media: the plan's existing photo/video (from the fetched row), plus a
  // pending replacement file picked but not yet uploaded (only uploaded on
  // Save, so cancelling the dialog never touches storage). removed=true
  // means "clear it" — distinct from "leave untouched" (both existing and
  // pendingFile null, removed false).
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [existingMediaKind, setExistingMediaKind] = useState<"video" | "image" | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [mediaRemoved, setMediaRemoved] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);

  // Fetch the full row fresh every time the dialog opens — the caller
  // only ever has the narrow subset of fields it needs for its own UI.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingRow(true);
    (async () => {
      const { data, error } = await supabase
        .from("user_activities")
        .select("note, description, scheduled_for, price_amount, price_tiers, capacity, venue_name, venue_address, venue_lat, venue_lng, audience, promo_image_url, promo_video_url")
        .eq("id", activityId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error(t("editPlan.loadFailed", "Couldn't load this plan"));
        setLoadingRow(false);
        onOpenChange(false);
        return;
      }
      const row = data as FullActivityRow;
      const d = new Date(row.scheduled_for);
      setPlanText(row.note ?? "");
      setDescription(row.description ?? "");
      setSelectedDate(startOfDay(d));
      setSelectedTime(format(d, "HH:mm"));
      const tiers = row.price_tiers ?? [];
      const general = tiers.find((tr) => tr.label === "General");
      setPriceAmount(general ? String(general.amount) : row.price_amount ? row.price_amount.replace(/[^\d.]/g, "") : "");
      setExtraPriceTiers(
        tiers.filter((tr) => tr.label !== "General").map((tr) => ({ label: tr.label, amount: String(tr.amount) }))
      );
      const matchedCurrency = CURRENCIES.find((c) => row.price_amount?.includes(c.code));
      setPriceCurrency(matchedCurrency?.code ?? "USD");
      setCapacityInput(row.capacity ? String(row.capacity) : "");
      setVenueName(row.venue_name ?? "");
      setVenuePlace(
        row.venue_name && typeof row.venue_lat === "number" && typeof row.venue_lng === "number"
          ? { name: row.venue_name, address: row.venue_address ?? "", lat: row.venue_lat, lng: row.venue_lng }
          : null
      );
      setAudience(row.audience ?? "everyone");
      setProfanityError(null);
      setExistingMediaUrl(row.promo_video_url || row.promo_image_url || null);
      setExistingMediaKind(row.promo_video_url ? "video" : row.promo_image_url ? "image" : null);
      setPendingFile(null);
      setPendingPreviewUrl(null);
      setMediaRemoved(false);
      setMediaError(null);
      setLoadingRow(false);
    })();
    return () => { cancelled = true; };
  }, [open, activityId, onOpenChange, t]);

  // Revoke the preview object URL whenever it's replaced or the dialog closes.
  useEffect(() => {
    return () => { if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl); };
  }, [pendingPreviewUrl]);

  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setMediaError(t("editPlan.mediaTypeError", "Pick a photo or video file"));
      return;
    }
    setMediaError(null);
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
    setMediaRemoved(false);
  };

  const handleRemoveMedia = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setMediaRemoved(true);
  };

  const isValid = planText.trim().length > 0 && !profanityError;
  const selectedCurrencySymbol = CURRENCIES.find((c) => c.code === priceCurrency)?.symbol || "$";
  const today = startOfDay(new Date());

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= MAX_CHARACTERS) {
      setPlanText(text);
      setProfanityError(checkProfanity(text).hasProfanity ? t("createPlan.profanityWarning") : null);
    }
  };

  const handleSave = async () => {
    if (!isValid) return;

    const selectedCurrencyObj = CURRENCIES.find((c) => c.code === priceCurrency);
    const formattedPrice = priceAmount.trim()
      ? `${selectedCurrencyObj?.symbol || "$"}${priceAmount.trim()} ${priceCurrency}`
      : null;

    const [hh, mm] = selectedTime.split(":").map((n) => parseInt(n, 10));
    const scheduledFor = new Date(selectedDate);
    scheduledFor.setHours(hh || 0, mm || 0, 0, 0);

    const validExtraTiers = extraPriceTiers
      .filter((tr) => tr.label.trim() && tr.amount.trim() && !isNaN(parseFloat(tr.amount)))
      .map((tr) => ({ label: tr.label.trim(), amount: parseFloat(tr.amount) }));
    const basePriceNum = priceAmount.trim() ? parseFloat(priceAmount.trim()) : NaN;
    const priceTiersPayload = validExtraTiers.length > 0
      ? [...(!isNaN(basePriceNum) ? [{ label: "General", amount: basePriceNum }] : []), ...validExtraTiers]
      : null;

    // Media upload happens first — if it fails, nothing else about the plan
    // should change either, so the whole save just stops here.
    let media: Parameters<typeof updateActivity>[1]["media"];
    if (pendingFile) {
      setMediaUploading(true);
      setMediaError(null);
      try {
        const isVideo = pendingFile.type.startsWith("video/");
        const ext = pendingFile.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
        const bucket = isVideo ? "plan-videos" : "plan-images";
        const path = `${user!.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, pendingFile, { contentType: pendingFile.type || undefined });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);

        if (isVideo) {
          let thumbnailUrl: string | null = null;
          const thumbBlob = await captureVideoFrame(pendingFile).catch(() => null);
          if (thumbBlob) {
            const thumbPath = `${user!.id}/${Date.now()}-thumb.jpg`;
            const { error: thumbErr } = await supabase.storage
              .from("plan-videos")
              .upload(thumbPath, thumbBlob, { contentType: "image/jpeg" });
            if (!thumbErr) {
              thumbnailUrl = supabase.storage.from("plan-videos").getPublicUrl(thumbPath).data.publicUrl;
            }
          }
          media = { type: "video", url: publicUrl, thumbnailUrl };
        } else {
          media = { type: "image", url: publicUrl };
        }
      } catch {
        setMediaError(t("editPlan.mediaUploadFailed", "Upload failed. Please try again."));
        setMediaUploading(false);
        return;
      }
      setMediaUploading(false);
    } else if (mediaRemoved) {
      media = { type: "none" };
    }

    const success = await updateActivity(activityId, {
      scheduled_for: scheduledFor,
      note: planText.trim(),
      description: description.trim() || null,
      price_amount: formattedPrice,
      price_tiers: priceTiersPayload,
      capacity: capacityInput.trim() ? parseInt(capacityInput.trim(), 10) : null,
      audience,
      venue: venuePlace
        ? { name: venuePlace.name, address: venuePlace.address, lat: venuePlace.lat, lng: venuePlace.lng }
        : venueName.trim()
        ? { name: venueName.trim() }
        : null,
      media,
    });

    if (success) {
      onOpenChange(false);
      onSaved?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card/95 backdrop-blur-xl border-border/50 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-display">
            {t("editPlan.title", "Edit plan")}
          </DialogTitle>
        </DialogHeader>

        {loadingRow ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Title */}
            <div className="space-y-3">
              <div className="relative">
                <Textarea
                  value={planText}
                  onChange={handleTextChange}
                  maxLength={MAX_CHARACTERS}
                  className="min-h-[80px] resize-none pr-16 text-base"
                  autoFocus
                />
                <span className="absolute right-3 bottom-3 text-xs text-muted-foreground">
                  {planText.length}/{MAX_CHARACTERS}
                </span>
              </div>
              {profanityError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-destructive" />
                  {profanityError}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("createPlan.descriptionLabel", "Description (optional)")}
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                className="min-h-[80px] resize-none text-sm"
                placeholder={t("createPlan.descriptionPlaceholder", "Any extra detail worth sharing")}
              />
            </div>

            {/* Photo / video */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("editPlan.mediaLabel", "Photo or video (optional)")}
              </label>
              <input
                ref={mediaFileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleMediaFileChange}
              />
              {pendingPreviewUrl ? (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  {pendingFile?.type.startsWith("video/") ? (
                    <video src={pendingPreviewUrl} className="w-full h-full object-cover" muted playsInline autoPlay loop />
                  ) : (
                    <img src={pendingPreviewUrl} className="w-full h-full object-cover" alt="" />
                  )}
                  <button
                    type="button"
                    onClick={handleRemoveMedia}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                    aria-label={t("editPlan.removeMedia", "Remove")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : existingMediaUrl && !mediaRemoved ? (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  {existingMediaKind === "video" ? (
                    <video src={existingMediaUrl} className="w-full h-full object-cover" muted playsInline autoPlay loop />
                  ) : (
                    <img src={existingMediaUrl} className="w-full h-full object-cover" alt="" />
                  )}
                  <div className="absolute inset-x-2 bottom-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => mediaFileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium hover:bg-black/80 transition-colors"
                    >
                      {t("editPlan.changeMedia", "Change")}
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveMedia}
                      className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                      aria-label={t("editPlan.removeMedia", "Remove")}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => mediaFileInputRef.current?.click()}
                  className="w-full py-6 rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                >
                  <ImagePlus className="w-5 h-5" />
                  <span className="text-sm">{t("editPlan.addMedia", "Add a photo or video")}</span>
                </button>
              )}
              {mediaError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-destructive" />
                  {mediaError}
                </p>
              )}
            </div>

            {/* Date + time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t("createPlan.dateLabel", "Date")}</label>
                <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, "MMM d")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => { if (date) { setSelectedDate(date); setDatePopoverOpen(false); } }}
                      disabled={(date) => date < today}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t("createPlan.timeLabel", "Time")}</label>
                <Input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                />
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t("createPlan.setPrice")}</label>
              <div className="flex gap-2">
                <Select value={priceCurrency} onValueChange={setPriceCurrency}>
                  <SelectTrigger className="w-24 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.symbol} {currency.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                  placeholder={t("createPlan.amountPlaceholder")}
                  className="flex-1"
                />
              </div>

              {priceAmount.trim() && (
                <div className="space-y-2 pt-2">
                  {extraPriceTiers.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("createPlan.generalTierHint", "The price above applies as \"General\"")}
                    </p>
                  )}
                  {extraPriceTiers.map((tierRow, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={tierRow.label}
                        onChange={(e) => {
                          const next = [...extraPriceTiers];
                          next[i] = { ...next[i], label: e.target.value };
                          setExtraPriceTiers(next);
                        }}
                        placeholder={t("createPlan.tierLabelPlaceholder", "e.g. Girls, Students")}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={tierRow.amount}
                        onChange={(e) => {
                          const next = [...extraPriceTiers];
                          next[i] = { ...next[i], amount: e.target.value };
                          setExtraPriceTiers(next);
                        }}
                        placeholder={selectedCurrencySymbol}
                        className="w-24"
                      />
                      <button
                        type="button"
                        onClick={() => setExtraPriceTiers(extraPriceTiers.filter((_, idx) => idx !== i))}
                        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label="Remove price option"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExtraPriceTiers([...extraPriceTiers, { label: "", amount: "" }])}
                    className="text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
                  >
                    + {t("createPlan.addPriceOption", "Add another price option")}
                  </button>
                </div>
              )}
            </div>

            {/* Venue */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("createPlan.venueLabel", "Where's it happening? (optional)")}
              </label>
              <VenueSearchInput
                value={venueName}
                onChange={(text) => { setVenueName(text); setVenuePlace(null); }}
                onSelectPlace={(place) => { setVenuePlace(place); setVenueName(place.name); }}
                placeholder={t("createPlan.venuePlaceholder", "Search a place or type an address")}
                inputClassName="h-10"
              />
            </div>

            {/* Capacity */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("createPlan.capacityLabel", "How many can join? (optional)")}
              </label>
              <Input
                type="number"
                min="1"
                value={capacityInput}
                onChange={(e) => setCapacityInput(e.target.value)}
                placeholder={t("createPlan.capacityPlaceholder", "No limit")}
              />
            </div>

            {/* Audience */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t("createPlan.audienceLabel", "Who can join?")}</label>
              <div className="flex flex-wrap gap-2">
                {([
                  ["everyone", t("createPlan.everyone")],
                  ["women_only", t("createPlan.womenOnly")],
                  ["friends_only", t("createPlan.friendsOnly", "Only friends")],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAudience(value)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium border transition-all",
                      audience === value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/60 text-foreground border-border hover:border-primary/50"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={!isValid || isLoading || mediaUploading}
              className="w-full py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))" }}
            >
              {isLoading || mediaUploading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                  {mediaUploading ? t("editPlan.uploadingMedia", "Uploading…") : t("editPlan.saving", "Saving…")}
                </span>
              ) : (
                t("editPlan.saveBtn", "Save changes")
              )}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
