import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAddVenue, useUpdateVenue, DbVenue, VenueInsert } from "@/hooks/useVenues";
import { toast } from "@/hooks/use-toast";
import { Plus, Save, X, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VenueFormProps {
  venue?: DbVenue;
  onClose: () => void;
  defaultCity?: string;
  defaultType?: 'lunch_dinner' | 'brunch' | 'drinks';
}

export function VenueForm({ venue, onClose, defaultCity, defaultType }: VenueFormProps) {
  const [city, setCity] = useState(venue?.city || defaultCity || "");
  const [name, setName] = useState(venue?.name || "");
  const [address, setAddress] = useState(venue?.address || "");
  const [venueType, setVenueType] = useState<'lunch_dinner' | 'brunch' | 'drinks'>(
    venue?.venue_type || defaultType || 'lunch_dinner'
  );
  const [latitude, setLatitude] = useState(venue?.latitude?.toString() || "");
  const [longitude, setLongitude] = useState(venue?.longitude?.toString() || "");
  const [sortOrder, setSortOrder] = useState(venue?.sort_order?.toString() || "0");
  const [isGeocoding, setIsGeocoding] = useState(false);

  const addVenue = useAddVenue();
  const updateVenue = useUpdateVenue();

  const handleGeocode = async () => {
    if (!address.trim()) {
      toast({
        title: "Error",
        description: "Please enter an address first",
        variant: "destructive",
      });
      return;
    }

    setIsGeocoding(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: { address: address.trim() }
      });

      if (error) throw error;

      if (data.latitude && data.longitude) {
        setLatitude(data.latitude.toString());
        setLongitude(data.longitude.toString());
        toast({
          title: "Coordinates found!",
          description: `Lat: ${data.latitude.toFixed(6)}, Lng: ${data.longitude.toFixed(6)}`,
        });
      } else {
        toast({
          title: "Address not found",
          description: "Could not find coordinates for this address. Try a more specific address.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Geocoding error:', error);
      toast({
        title: "Geocoding failed",
        description: error.message || "Failed to fetch coordinates",
        variant: "destructive",
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!city.trim() || !name.trim() || !address.trim()) {
      toast({
        title: "Error",
        description: "City, name, and address are required",
        variant: "destructive",
      });
      return;
    }

    const venueData: VenueInsert = {
      city: city.trim(),
      name: name.trim(),
      address: address.trim(),
      venue_type: venueType,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      sort_order: parseInt(sortOrder) || 0,
    };

    try {
      if (venue) {
        await updateVenue.mutateAsync({ id: venue.id, ...venueData });
        toast({ title: "Venue updated successfully" });
      } else {
        await addVenue.mutateAsync(venueData);
        toast({ title: "Venue added successfully" });
      }
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isLoading = addVenue.isPending || updateVenue.isPending;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          {venue ? "Edit Venue" : "Add New Venue"}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. New York City"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select value={venueType} onValueChange={(v) => setVenueType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lunch_dinner">Lunch/Dinner</SelectItem>
                  <SelectItem value="brunch">Brunch</SelectItem>
                  <SelectItem value="drinks">Drinks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Venue Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Harvest"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <div className="flex gap-2">
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Cra. 11 #93a-27, Bogotá, Colombia"
                required
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleGeocode}
                disabled={isGeocoding || !address.trim()}
                className="shrink-0"
              >
                {isGeocoding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                <span className="ml-1 hidden sm:inline">Get GPS</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. 4.6752"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. -74.0571"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Saving..." : venue ? (
                <><Save className="w-4 h-4 mr-2" /> Update Venue</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" /> Add Venue</>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
