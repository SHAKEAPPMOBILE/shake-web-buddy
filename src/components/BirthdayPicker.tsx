import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface BirthdayPickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  maxDate?: string;
}

const MONTHS = [
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

type Field = "year" | "month" | "day";

// Asked in this order (year first, since it narrows the age check soonest);
// displayed afterwards in the more natural Month/Day/Year reading order.
const ASK_ORDER: Field[] = ["year", "month", "day"];
const DISPLAY_ORDER: Field[] = ["month", "day", "year"];
const FIELD_PLACEHOLDER: Record<Field, string> = { year: "Year", month: "Month", day: "Day" };

function parseValue(value: string): { year: string; month: string; day: string } {
  if (!value) return { year: "", month: "", day: "" };
  const [year, month, day] = value.split("-");
  return { year: year || "", month: month || "", day: day || "" };
}

/**
 * One field at a time (Year, then Month, then Day) instead of three
 * dropdowns squeezed side by side — the three-column grid was unusable on
 * mobile. Once all three are picked they collapse into a single readable
 * date with each part still individually tappable to jump back and edit it,
 * matching the rest of the signup wizard's "tap a past answer to edit" flow.
 */
export function BirthdayPicker({ value, onChange, maxDate }: BirthdayPickerProps) {
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 100;
  const maxYear = maxDate ? new Date(maxDate).getFullYear() : currentYear - 18;

  const years = React.useMemo(() => {
    const arr: string[] = [];
    for (let y = maxYear; y >= minYear; y--) arr.push(y.toString());
    return arr;
  }, [maxYear, minYear]);

  // Local state, seeded once from the incoming value — kept separate from
  // the (possibly partial, placeholder-padded) string pushed via onChange
  // so "is this field filled" stays unambiguous.
  const initial = React.useMemo(() => parseValue(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [year, setYear] = React.useState(initial.year);
  const [month, setMonth] = React.useState(initial.month);
  const [day, setDay] = React.useState(initial.day);

  const fieldValue: Record<Field, string> = { year, month, day };
  const isComplete = !!(year && month && day);

  const [activeField, setActiveField] = React.useState<Field | null>(() =>
    isComplete ? null : ASK_ORDER.find((f) => !fieldValue[f]) ?? "year"
  );

  const days = React.useMemo(() => {
    if (!month || !year) {
      return Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, "0"));
    }
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString().padStart(2, "0"));
  }, [month, year]);

  const emit = (next: { year: string; month: string; day: string }) => {
    if (next.year && next.month && next.day) {
      const daysInMonth = new Date(parseInt(next.year), parseInt(next.month), 0).getDate();
      const clampedDay = parseInt(next.day) > daysInMonth ? daysInMonth.toString().padStart(2, "0") : next.day;
      onChange(`${next.year}-${next.month}-${clampedDay}`);
    } else if (next.year || next.month || next.day) {
      onChange(`${next.year || "0000"}-${next.month || "00"}-${next.day || "00"}`);
    } else {
      onChange("");
    }
  };

  const handleFieldSelect = (field: Field, val: string) => {
    const next = { year, month, day, [field]: val };
    if (field === "year") setYear(val);
    if (field === "month") setMonth(val);
    if (field === "day") setDay(val);
    emit(next);

    // During initial fill-in, advance to the next empty field. If editing an
    // already-complete date, every field is already filled, so this drops
    // straight back to the summary view.
    const nextEmpty = ASK_ORDER.find((f) => f !== field && !next[f]);
    setActiveField(nextEmpty ?? null);
  };

  const options: Record<Field, { value: string; label: string }[]> = {
    year: years.map((y) => ({ value: y, label: y })),
    month: MONTHS,
    day: days.map((d) => ({ value: d, label: String(parseInt(d)) })),
  };

  if (activeField) {
    return (
      <Select
        value={fieldValue[activeField]}
        onValueChange={(val) => handleFieldSelect(activeField, val)}
      >
        <SelectTrigger className="w-full h-14 rounded-2xl border-border bg-muted/60 text-base">
          <SelectValue placeholder={FIELD_PLACEHOLDER[activeField]} />
        </SelectTrigger>
        <SelectContent className="bg-background z-50" position="popper" sideOffset={4}>
          {options[activeField].map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // All three picked — collapse into tappable pills, in natural reading order.
  return (
    <div className="flex items-center gap-2">
      {DISPLAY_ORDER.map((field) => (
        <button
          key={field}
          type="button"
          onClick={() => setActiveField(field)}
          className={cn(
            "flex-1 h-14 rounded-2xl border border-border bg-muted/60 text-base font-medium text-foreground",
            "hover:border-primary/50 transition-colors"
          )}
        >
          {field === "month"
            ? MONTHS.find((m) => m.value === month)?.label
            : field === "day"
              ? parseInt(day)
              : year}
        </button>
      ))}
    </div>
  );
}
