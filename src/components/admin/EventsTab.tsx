import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  CalendarDays,
  Image as ImageIcon,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AdminPublicEvent {
  id: string;
  name: string | null;
  image_url: string | null;
  venue: string | null;
  city: string | null;
  event_starts_at: string | null;
  ticket_url: string | null;
  price_min: number | null;
  price_max: number | null;
  source: string | null;
  created_at: string | null;
}

interface EventFormState {
  id: string;
  name: string;
  image_url: string;
  venue: string;
  city: string;
  event_starts_at: string;
  ticket_url: string;
  price_min: string;
  price_max: string;
  source: string;
}

function toLocalDateTimeInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

function fromLocalDateTimeInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const emptyForm: EventFormState = {
  id: "",
  name: "",
  image_url: "",
  venue: "",
  city: "",
  event_starts_at: "",
  ticket_url: "",
  price_min: "",
  price_max: "",
  source: "",
};

export function EventsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [pasteUrl, setPasteUrl] = useState("");

  const { data: events = [], isLoading } = useQuery<AdminPublicEvent[]>({
    queryKey: ["admin-public-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_events")
        .select("*")
        .order("event_starts_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as AdminPublicEvent[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: AdminPublicEvent) => {
      const { error } = await supabase.from("public_events").upsert(payload, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-public-events"] });
      toast({ title: "Event saved" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save event",
        description: error?.message ?? String(error),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("public_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-public-events"] });
      toast({ title: "Event deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete event",
        description: error?.message ?? String(error),
        variant: "destructive",
      });
    },
  });

  const handleEdit = (ev: AdminPublicEvent) => {
    setForm({
      id: ev.id,
      name: ev.name ?? "",
      image_url: ev.image_url ?? "",
      venue: ev.venue ?? "",
      city: ev.city ?? "",
      event_starts_at: toLocalDateTimeInputValue(ev.event_starts_at),
      ticket_url: ev.ticket_url ?? "",
      price_min: ev.price_min != null ? String(ev.price_min) : "",
      price_max: ev.price_max != null ? String(ev.price_max) : "",
      source: ev.source ?? "",
    });
  };

  const handleNew = () => {
    setForm({
      ...emptyForm,
      id: crypto.randomUUID ? crypto.randomUUID() : `event_${Date.now()}`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = form.id || (crypto.randomUUID ? crypto.randomUUID() : `event_${Date.now()}`);
    const eventStartsAtIso = fromLocalDateTimeInputValue(form.event_starts_at);

    const payload: AdminPublicEvent = {
      id,
      name: form.name || null,
      image_url: form.image_url || null,
      venue: form.venue || null,
      city: form.city.trim() ? form.city.trim() : null,
      event_starts_at: eventStartsAtIso,
      ticket_url: form.ticket_url || null,
      price_min: form.price_min ? Number(form.price_min) : null,
      price_max: form.price_max ? Number(form.price_max) : null,
      source: form.source || null,
      created_at: null,
    };

    await upsertMutation.mutateAsync(payload);
    // Keep the form populated so admin can tweak; do not clear automatically
  };

  const handlePasteUrl = () => {
    if (!pasteUrl.trim()) return;
    const url = pasteUrl.trim();
    const lower = url.toLowerCase();
    let source = form.source;
    if (lower.includes("tuboleta.com")) {
      source = source || "tuboleta";
    } else if (lower.includes("ticketlive.co")) {
      source = source || "ticketlive";
    }
    setForm((prev) => ({
      ...prev,
      ticket_url: url,
      source,
    }));
    setPasteUrl("");
  };

  const isSaving = upsertMutation.isLoading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>Public Events</span>
            <Button size="sm" variant="outline" onClick={handleNew}>
              <Plus className="w-4 h-4 mr-1" />
              New Event
            </Button>
          </CardTitle>
          <CardDescription>
            Manage rows in <code className="font-mono text-xs">public.public_events</code> used for the Events page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
            <div className="flex-1">
              <Label htmlFor="paste-url" className="flex items-center gap-1 text-xs font-medium mb-1">
                <Link2 className="w-3 h-3" />
                Paste ticketing URL (tuboleta.com / ticketlive.co)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="paste-url"
                  placeholder="https://www.tuboleta.com/..."
                  value={pasteUrl}
                  onChange={(e) => setPasteUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePasteUrl()}
                />
                <Button type="button" variant="outline" onClick={handlePasteUrl}>
                  Apply
                </Button>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="event-name">Name</Label>
                <Input
                  id="event-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Artist · Tour"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-venue">Venue</Label>
                <Input
                  id="event-venue"
                  value={form.venue}
                  onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                  placeholder="Movistar Arena"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-city">City</Label>
                <Input
                  id="event-city"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="e.g. Bogotá"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-datetime" className="flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  Event starts at
                </Label>
                <Input
                  id="event-datetime"
                  type="datetime-local"
                  value={form.event_starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, event_starts_at: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="price-min">Price min</Label>
                  <Input
                    id="price-min"
                    type="number"
                    min={0}
                    value={form.price_min}
                    onChange={(e) => setForm((f) => ({ ...f, price_min: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="price-max">Price max</Label>
                  <Input
                    id="price-max"
                    type="number"
                    min={0}
                    value={form.price_max}
                    onChange={(e) => setForm((f) => ({ ...f, price_max: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="image-url" className="flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  Image URL
                </Label>
                <Input
                  id="image-url"
                  value={form.image_url}
                  onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://..."
                />
                {form.image_url && (
                  <div className="mt-2">
                    <div className="text-xs text-muted-foreground mb-1">Preview</div>
                    <div className="w-full max-w-xs aspect-[4/3] rounded-2xl overflow-hidden border border-border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.image_url}
                        alt="Event"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ticket-url">Ticket URL</Label>
                <Input
                  id="ticket-url"
                  value={form.ticket_url}
                  onChange={(e) => setForm((f) => ({ ...f, ticket_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                  placeholder="tuboleta / ticketlive / manual"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save event
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setForm(emptyForm)}
                >
                  Clear
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All public_events rows</CardTitle>
          <CardDescription>Click a row to edit its details above.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[360px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading events...
              </div>
            ) : events.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                No events in public_events yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Starts</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev) => (
                    <TableRow
                      key={ev.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleEdit(ev)}
                    >
                      <TableCell className="font-medium">{ev.name}</TableCell>
                      <TableCell>{ev.city}</TableCell>
                      <TableCell>{ev.venue}</TableCell>
                      <TableCell>
                        {ev.event_starts_at
                          ? new Date(ev.event_starts_at).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {ev.price_min != null && ev.price_max != null
                          ? `$${ev.price_min}–${ev.price_max}`
                          : "—"}
                      </TableCell>
                      <TableCell>{ev.source}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(ev);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete event "${ev.name}"?`)) {
                                deleteMutation.mutate(ev.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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

export default EventsTab;


