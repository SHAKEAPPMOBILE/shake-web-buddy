import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { countryCodes, CountryCode } from "@/data/countryCodes";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NationalitySelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onOpenChange?: (open: boolean) => void;
  onSearchChange?: (search: string) => void;
}

export function NationalitySelector({
  value,
  onChange,
  placeholder = "Select your nationality",
  onOpenChange,
  onSearchChange,
}: NationalitySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Find the selected country by name
  const selectedCountry = countryCodes.find(c => c.name === value);

  // Filter countries based on search
  const filteredCountries = countryCodes.filter(country =>
    country.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (country: CountryCode) => {
    onChange(country.name);
    setOpen(false);
    setSearch("");
    onSearchChange?.("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            {selectedCountry ? (
              <>
                <span className="text-lg">{selectedCountry.flag}</span>
                <span className="text-foreground">{selectedCountry.name}</span>
              </>
            ) : (
              <>
                <span className="text-lg">🌍</span>
                <span>{placeholder}</span>
              </>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          // Match trigger width, but never overflow the viewport.
          "w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0 bg-popover border border-border",
          "z-[100]"
        )}
      >
        <div className="p-2 border-b border-border">
          <Input
            placeholder="Search countries..."
            value={search}
            onChange={(e) => {
              const next = e.target.value;
              setSearch(next);
              onSearchChange?.(next);
            }}
            className="h-9"
          />
        </div>
        <ScrollArea className="h-[min(250px,50vh)]">
          <div className="p-1">
            {filteredCountries.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No countries found
              </div>
            ) : (
              filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleSelect(country)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                    value === country.name && "bg-accent"
                  )}
                >
                  <span className="text-lg">{country.flag}</span>
                  <span className="flex-1 text-left">{country.name}</span>
                  {value === country.name && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
