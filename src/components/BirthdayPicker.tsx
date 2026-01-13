import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface BirthdayPickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  maxDate?: string;
}

const months = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export function BirthdayPicker({ value, onChange, maxDate }: BirthdayPickerProps) {
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 100;
  const maxYear = maxDate ? new Date(maxDate).getFullYear() : currentYear - 18;

  // Generate years from maxYear down to minYear (most recent first)
  const years = React.useMemo(() => {
    const arr = [];
    for (let y = maxYear; y >= minYear; y--) {
      arr.push(y.toString());
    }
    return arr;
  }, [maxYear, minYear]);

  // Parse current value
  const [selectedYear, selectedMonth, selectedDay] = React.useMemo(() => {
    if (!value) return ["", "", ""];
    const parts = value.split("-");
    return [parts[0] || "", parts[1] || "", parts[2] || ""];
  }, [value]);

  // Generate days based on selected month and year
  const days = React.useMemo(() => {
    if (!selectedMonth || !selectedYear) {
      // Default to 31 days
      return Array.from({ length: 31 }, (_, i) => 
        (i + 1).toString().padStart(2, "0")
      );
    }
    
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    return Array.from({ length: daysInMonth }, (_, i) => 
      (i + 1).toString().padStart(2, "0")
    );
  }, [selectedMonth, selectedYear]);

  const handleChange = (type: "year" | "month" | "day", val: string) => {
    let newYear = selectedYear;
    let newMonth = selectedMonth;
    let newDay = selectedDay;

    if (type === "year") newYear = val;
    if (type === "month") newMonth = val;
    if (type === "day") newDay = val;

    // Only emit a value if all parts are selected
    if (newYear && newMonth && newDay) {
      // Validate day for the month
      const daysInMonth = new Date(parseInt(newYear), parseInt(newMonth), 0).getDate();
      if (parseInt(newDay) > daysInMonth) {
        newDay = daysInMonth.toString().padStart(2, "0");
      }
      onChange(`${newYear}-${newMonth}-${newDay}`);
    } else if (newYear || newMonth || newDay) {
      // Partial update - store intermediate state
      const partialValue = `${newYear || "0000"}-${newMonth || "00"}-${newDay || "00"}`;
      onChange(partialValue);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Month */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Month</Label>
        <Select
          value={selectedMonth}
          onValueChange={(val) => handleChange("month", val)}
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50 max-h-[200px]">
            {months.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Day */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Day</Label>
        <Select
          value={selectedDay}
          onValueChange={(val) => handleChange("day", val)}
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Day" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50 max-h-[200px]">
            {days.map((day) => (
              <SelectItem key={day} value={day}>
                {parseInt(day)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Year */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Year</Label>
        <Select
          value={selectedYear}
          onValueChange={(val) => handleChange("year", val)}
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50 max-h-[200px]">
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
