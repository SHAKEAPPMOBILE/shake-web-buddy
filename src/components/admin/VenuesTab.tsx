import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Search, Utensils, Coffee, Wine, Calendar, Building2 } from "lucide-react";
import { CITY_VENUES, CITY_BARS, CITY_BRUNCH_VENUES, getWeeklyVenue, getTodaysBar, getWeeklyBrunchVenue } from "@/data/venues";

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

  // Calculate venue counts per city
  const venueSummaries = useMemo(() => {
    const allCities = new Set([
      ...Object.keys(CITY_VENUES),
      ...Object.keys(CITY_BARS),
      ...Object.keys(CITY_BRUNCH_VENUES),
    ]);

    const summaries: VenueSummary[] = [];
    
    allCities.forEach(city => {
      const lunchDinner = CITY_VENUES[city]?.length || 0;
      const brunch = CITY_BRUNCH_VENUES[city]?.length || 0;
      const drinks = CITY_BARS[city]?.length || 0;
      
      summaries.push({
        city,
        lunchDinner,
        brunch,
        drinks,
        total: lunchDinner + brunch + drinks,
      });
    });

    return summaries.sort((a, b) => b.total - a.total);
  }, []);

  // Filter summaries by search
  const filteredSummaries = useMemo(() => {
    if (!searchQuery.trim()) return venueSummaries;
    return venueSummaries.filter(s => 
      s.city.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [venueSummaries, searchQuery]);

  // Get details for selected city
  const selectedCityDetails = useMemo(() => {
    if (!selectedCity) return null;
    
    return {
      lunchDinner: CITY_VENUES[selectedCity] || [],
      brunch: CITY_BRUNCH_VENUES[selectedCity] || [],
      drinks: CITY_BARS[selectedCity] || [],
      currentLunchDinner: getWeeklyVenue(selectedCity),
      currentBrunch: getWeeklyBrunchVenue(selectedCity),
      currentDrinks: getTodaysBar(selectedCity),
    };
  }, [selectedCity]);

  // Calculate totals
  const totals = useMemo(() => {
    let lunchDinner = 0;
    let brunch = 0;
    let drinks = 0;
    
    Object.values(CITY_VENUES).forEach(venues => lunchDinner += venues.length);
    Object.values(CITY_BRUNCH_VENUES).forEach(venues => brunch += venues.length);
    Object.values(CITY_BARS).forEach(bars => drinks += bars.length);
    
    return {
      lunchDinner,
      brunch,
      drinks,
      total: lunchDinner + brunch + drinks,
      cities: venueSummaries.length,
    };
  }, [venueSummaries]);

  return (
    <div className="space-y-6">
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
            {selectedCity && selectedCityDetails && (
              <CardDescription className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                Current rotation shown with ⭐
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!selectedCity ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Click a city on the left to view its venues
              </div>
            ) : selectedCityDetails ? (
              <ScrollArea className="h-[400px]">
                <Tabs defaultValue="lunchDinner" className="w-full">
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="lunchDinner" className="text-xs">
                      <Utensils className="w-3 h-3 mr-1" />
                      Lunch/Dinner ({selectedCityDetails.lunchDinner.length})
                    </TabsTrigger>
                    <TabsTrigger value="brunch" className="text-xs">
                      <Coffee className="w-3 h-3 mr-1" />
                      Brunch ({selectedCityDetails.brunch.length})
                    </TabsTrigger>
                    <TabsTrigger value="drinks" className="text-xs">
                      <Wine className="w-3 h-3 mr-1" />
                      Drinks ({selectedCityDetails.drinks.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="lunchDinner" className="mt-4 space-y-2">
                    {selectedCityDetails.lunchDinner.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No venues - shows "TBD - Vote in chat!"</p>
                    ) : (
                      selectedCityDetails.lunchDinner.map((venue, idx) => (
                        <div 
                          key={idx}
                          className={`p-3 rounded-lg border ${
                            selectedCityDetails.currentLunchDinner?.name === venue.name 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">
                                {selectedCityDetails.currentLunchDinner?.name === venue.name && '⭐ '}
                                {venue.name}
                              </p>
                              <p className="text-xs text-muted-foreground">{venue.address}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">Week {idx + 1}</Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
                  
                  <TabsContent value="brunch" className="mt-4 space-y-2">
                    {selectedCityDetails.brunch.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No venues - shows "TBD - Vote in chat!"</p>
                    ) : (
                      selectedCityDetails.brunch.map((venue, idx) => (
                        <div 
                          key={idx}
                          className={`p-3 rounded-lg border ${
                            selectedCityDetails.currentBrunch?.name === venue.name 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">
                                {selectedCityDetails.currentBrunch?.name === venue.name && '⭐ '}
                                {venue.name}
                              </p>
                              <p className="text-xs text-muted-foreground">{venue.description}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">Week {idx + 1}</Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
                  
                  <TabsContent value="drinks" className="mt-4 space-y-2">
                    {selectedCityDetails.drinks.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No venues - shows "TBD - Vote in chat!"</p>
                    ) : (
                      selectedCityDetails.drinks.map((bar, idx) => (
                        <div 
                          key={idx}
                          className={`p-3 rounded-lg border ${
                            selectedCityDetails.currentDrinks?.name === bar.name 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">
                                {selectedCityDetails.currentDrinks?.name === bar.name && '⭐ '}
                                {bar.name}
                              </p>
                              <p className="text-xs text-muted-foreground">{bar.address}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">Day {idx + 1}</Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </ScrollArea>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
