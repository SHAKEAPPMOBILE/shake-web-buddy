import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Search, Utensils, Coffee, Wine, Building2, Plus, Pencil, Trash2, Globe, Loader2, AlertTriangle } from "lucide-react";
import { useVenues, useDeleteVenue, getWeeklyVenueFromList, getDailyVenueFromList, DbVenue } from "@/hooks/useVenues";
import { VenueForm } from "./VenueForm";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface VenueSummary {
  city: string;
  lunchDinner: number;
  brunch: number;
  drinks: number;
  total: number;
}

export function VenuesTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState<DbVenue | null>(null);
  const [defaultType, setDefaultType] = useState<'lunch_dinner' | 'brunch' | 'drinks'>('lunch_dinner');
  const [isGeocoding, setIsGeocoding] = useState(false);

  const { data: dbVenues = [], isLoading } = useVenues();
  const deleteVenue = useDeleteVenue();
  const queryClient = useQueryClient();

  // Count venues missing coordinates
  const venuesMissingCoords = useMemo(() => {
    return dbVenues.filter(v => v.latitude === null || v.longitude === null).length;
  }, [dbVenues]);

  const handleBulkGeocode = async () => {
    if (venuesMissingCoords === 0) {
      toast({ title: "All venues already have coordinates!" });
      return;
    }

    setIsGeocoding(true);
    toast({ title: "Starting bulk geocoding...", description: `Processing ${venuesMissingCoords} venues` });

    try {
      const { data, error } = await supabase.functions.invoke('bulk-geocode-venues');

      if (error) throw error;

      toast({
        title: "Bulk geocoding complete!",
        description: `${data.success} succeeded, ${data.failed} failed`,
      });

      // Refresh venues
      queryClient.invalidateQueries({ queryKey: ['venues'] });
    } catch (error: any) {
      console.error('Bulk geocode error:', error);
      toast({
        title: "Bulk geocoding failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  // Calculate venue counts per city from database
  const venueSummaries = useMemo(() => {
    const cityMap = new Map<string, VenueSummary>();
    
    dbVenues.forEach(venue => {
      if (!cityMap.has(venue.city)) {
        cityMap.set(venue.city, {
          city: venue.city,
          lunchDinner: 0,
          brunch: 0,
          drinks: 0,
          total: 0,
        });
      }
      const summary = cityMap.get(venue.city)!;
      if (venue.venue_type === 'lunch_dinner') summary.lunchDinner++;
      else if (venue.venue_type === 'brunch') summary.brunch++;
      else if (venue.venue_type === 'drinks') summary.drinks++;
      summary.total++;
    });

    return Array.from(cityMap.values()).sort((a, b) => b.total - a.total);
  }, [dbVenues]);

  // Filter summaries by search
  const filteredSummaries = useMemo(() => {
    if (!searchQuery.trim()) return venueSummaries;
    return venueSummaries.filter(s => 
      s.city.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [venueSummaries, searchQuery]);

  // Get venues for selected city
  const selectedCityVenues = useMemo(() => {
    if (!selectedCity) return { lunchDinner: [], brunch: [], drinks: [] };
    
    const cityVenues = dbVenues.filter(v => v.city === selectedCity);
    return {
      lunchDinner: cityVenues.filter(v => v.venue_type === 'lunch_dinner'),
      brunch: cityVenues.filter(v => v.venue_type === 'brunch'),
      drinks: cityVenues.filter(v => v.venue_type === 'drinks'),
    };
  }, [selectedCity, dbVenues]);

  // Current rotation
  const currentVenues = useMemo(() => {
    return {
      lunchDinner: getWeeklyVenueFromList(selectedCityVenues.lunchDinner),
      brunch: getWeeklyVenueFromList(selectedCityVenues.brunch),
      drinks: getDailyVenueFromList(selectedCityVenues.drinks),
    };
  }, [selectedCityVenues]);

  // Calculate totals
  const totals = useMemo(() => {
    const lunchDinner = dbVenues.filter(v => v.venue_type === 'lunch_dinner').length;
    const brunch = dbVenues.filter(v => v.venue_type === 'brunch').length;
    const drinks = dbVenues.filter(v => v.venue_type === 'drinks').length;
    
    return {
      lunchDinner,
      brunch,
      drinks,
      total: dbVenues.length,
      cities: venueSummaries.length,
    };
  }, [dbVenues, venueSummaries]);

  const handleDelete = async (venue: DbVenue) => {
    if (!confirm(`Delete "${venue.name}" from ${venue.city}?`)) return;
    
    try {
      await deleteVenue.mutateAsync(venue.id);
      toast({ title: "Venue deleted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleAddVenue = (type: 'lunch_dinner' | 'brunch' | 'drinks') => {
    setDefaultType(type);
    setEditingVenue(null);
    setShowForm(true);
  };

  const handleEditVenue = (venue: DbVenue) => {
    setEditingVenue(venue);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      {showForm && (
        <VenueForm
          venue={editingVenue || undefined}
          onClose={() => {
            setShowForm(false);
            setEditingVenue(null);
          }}
          defaultCity={selectedCity || undefined}
          defaultType={defaultType}
        />
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => handleAddVenue('lunch_dinner')}>
          <Plus className="w-4 h-4 mr-2" />
          Add Venue
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleBulkGeocode}
          disabled={isGeocoding || venuesMissingCoords === 0}
        >
          {isGeocoding ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Globe className="w-4 h-4 mr-2" />
          )}
          Bulk Geocode {venuesMissingCoords > 0 && `(${venuesMissingCoords})`}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{totals.cities}</span>
            </div>
            <p className="text-xs text-muted-foreground">Cities</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-orange-500" />
              <span className="text-2xl font-bold">{totals.lunchDinner}</span>
            </div>
            <p className="text-xs text-muted-foreground">Lunch/Dinner</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Coffee className="w-4 h-4 text-amber-600" />
              <span className="text-2xl font-bold">{totals.brunch}</span>
            </div>
            <p className="text-xs text-muted-foreground">Brunch</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Wine className="w-4 h-4 text-purple-500" />
              <span className="text-2xl font-bold">{totals.drinks}</span>
            </div>
            <p className="text-xs text-muted-foreground">Bars/Drinks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500" />
              <span className="text-2xl font-bold">{totals.total}</span>
            </div>
            <p className="text-xs text-muted-foreground">Total Venues</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cities List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Cities & Venue Counts
            </CardTitle>
            <CardDescription>
              Click a city to see its venues
            </CardDescription>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search cities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Loading venues...
                </div>
              ) : filteredSummaries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <p>No venues in database yet</p>
                  <Button size="sm" onClick={() => handleAddVenue('lunch_dinner')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Venue
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>City</TableHead>
                      <TableHead className="text-center">
                        <Utensils className="w-4 h-4 inline" />
                      </TableHead>
                      <TableHead className="text-center">
                        <Coffee className="w-4 h-4 inline" />
                      </TableHead>
                      <TableHead className="text-center">
                        <Wine className="w-4 h-4 inline" />
                      </TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSummaries.map((summary) => (
                      <TableRow 
                        key={summary.city}
                        className={`cursor-pointer hover:bg-muted/50 ${selectedCity === summary.city ? 'bg-primary/10' : ''}`}
                        onClick={() => setSelectedCity(summary.city)}
                      >
                        <TableCell className="font-medium">{summary.city}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={summary.lunchDinner > 0 ? "default" : "secondary"} className="text-xs">
                            {summary.lunchDinner}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={summary.brunch > 0 ? "default" : "secondary"} className="text-xs">
                            {summary.brunch}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={summary.drinks > 0 ? "default" : "secondary"} className="text-xs">
                            {summary.drinks}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{summary.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* City Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {selectedCity ? `${selectedCity} Venues` : "Select a City"}
            </CardTitle>
            {selectedCity && (
              <CardDescription className="flex items-center gap-2">
                ⭐ = Current rotation
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!selectedCity ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Click a city on the left to view its venues
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <Tabs defaultValue="lunchDinner" className="w-full">
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="lunchDinner" className="text-xs">
                      <Utensils className="w-3 h-3 mr-1" />
                      L/D ({selectedCityVenues.lunchDinner.length})
                    </TabsTrigger>
                    <TabsTrigger value="brunch" className="text-xs">
                      <Coffee className="w-3 h-3 mr-1" />
                      Brunch ({selectedCityVenues.brunch.length})
                    </TabsTrigger>
                    <TabsTrigger value="drinks" className="text-xs">
                      <Wine className="w-3 h-3 mr-1" />
                      Drinks ({selectedCityVenues.drinks.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="lunchDinner" className="mt-4 space-y-2">
                    <Button size="sm" variant="outline" className="w-full mb-2" onClick={() => handleAddVenue('lunch_dinner')}>
                      <Plus className="w-4 h-4 mr-2" /> Add Lunch/Dinner Venue
                    </Button>
                    {selectedCityVenues.lunchDinner.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No venues - shows "TBD - Vote in chat!"</p>
                    ) : (
                      selectedCityVenues.lunchDinner.map((venue, idx) => (
                        <VenueCard
                          key={venue.id}
                          venue={venue}
                          isCurrent={currentVenues.lunchDinner?.id === venue.id}
                          index={idx}
                          rotationType="Week"
                          onEdit={() => handleEditVenue(venue)}
                          onDelete={() => handleDelete(venue)}
                        />
                      ))
                    )}
                  </TabsContent>
                  
                  <TabsContent value="brunch" className="mt-4 space-y-2">
                    <Button size="sm" variant="outline" className="w-full mb-2" onClick={() => handleAddVenue('brunch')}>
                      <Plus className="w-4 h-4 mr-2" /> Add Brunch Venue
                    </Button>
                    {selectedCityVenues.brunch.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No venues - shows "TBD - Vote in chat!"</p>
                    ) : (
                      selectedCityVenues.brunch.map((venue, idx) => (
                        <VenueCard
                          key={venue.id}
                          venue={venue}
                          isCurrent={currentVenues.brunch?.id === venue.id}
                          index={idx}
                          rotationType="Week"
                          onEdit={() => handleEditVenue(venue)}
                          onDelete={() => handleDelete(venue)}
                        />
                      ))
                    )}
                  </TabsContent>
                  
                  <TabsContent value="drinks" className="mt-4 space-y-2">
                    <Button size="sm" variant="outline" className="w-full mb-2" onClick={() => handleAddVenue('drinks')}>
                      <Plus className="w-4 h-4 mr-2" /> Add Drinks Venue
                    </Button>
                    {selectedCityVenues.drinks.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No venues - shows "TBD - Vote in chat!"</p>
                    ) : (
                      selectedCityVenues.drinks.map((venue, idx) => (
                        <VenueCard
                          key={venue.id}
                          venue={venue}
                          isCurrent={currentVenues.drinks?.id === venue.id}
                          index={idx}
                          rotationType="Day"
                          onEdit={() => handleEditVenue(venue)}
                          onDelete={() => handleDelete(venue)}
                        />
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Venue Card Component
interface VenueCardProps {
  venue: DbVenue;
  isCurrent: boolean;
  index: number;
  rotationType: "Week" | "Day";
  onEdit: () => void;
  onDelete: () => void;
}

function VenueCard({ venue, isCurrent, index, rotationType, onEdit, onDelete }: VenueCardProps) {
  const hasMissingCoords = venue.latitude === null || venue.longitude === null;
  
  return (
    <div className={`p-3 rounded-lg border ${isCurrent ? 'bg-primary/10 border-primary' : hasMissingCoords ? 'bg-amber-500/10 border-amber-500/50' : 'bg-muted/50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isCurrent && <span className="text-sm">⭐</span>}
            <span className="font-medium text-sm truncate">{venue.name}</span>
            <Badge variant="outline" className="text-xs shrink-0">
              #{index + 1}
            </Badge>
            {hasMissingCoords && (
              <Badge variant="outline" className="text-xs shrink-0 border-amber-500 text-amber-600">
                <AlertTriangle className="w-3 h-3 mr-1" />
                No GPS
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-1">{venue.address}</p>
          {venue.latitude && venue.longitude && (
            <p className="text-xs text-green-600 mt-0.5">
              📍 {venue.latitude.toFixed(4)}, {venue.longitude.toFixed(4)}
            </p>
          )}
          {isCurrent && (
            <p className="text-xs text-primary mt-1">Currently active this {rotationType.toLowerCase()}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
