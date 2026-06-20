import { format } from "date-fns";

/**
 * Safely parses a raw DB timestamp string to a Date.
 *
 * PostgreSQL serialises timestamps as "2026-06-20 04:00:00+00" — a space
 * instead of T and a bare +00 suffix. This format is rejected by
 * Safari/WebKit's Date parser, returning Invalid Date. Supabase REST
 * (PostgREST) returns this format for raw table queries; RPC results and
 * JS-generated .toISOString() values are already valid ISO 8601 and pass
 * through unchanged.
 *
 * Returns new Date(NaN) for null/undefined inputs so callers can guard
 * with isNaN(d.getTime()).
 */
export function parseDbDate(raw: string | null | undefined): Date {
  if (!raw) return new Date(NaN);
  // "2026-06-20 04:00:00+00" → "2026-06-20T04:00:00Z"
  // "2026-06-20 04:00:00+00:00" → "2026-06-20T04:00:00Z"
  // Already-valid ISO 8601 strings are unchanged.
  const normalized = raw.replace(' ', 'T').replace(/\+00(:00)?$/, 'Z');
  return new Date(normalized);
}

// Day name translations for date formatting
export const dayTranslations: Record<string, Record<string, string>> = {
  en: {
    Sun: "Sun", Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri", Sat: "Sat",
    Sunday: "Sunday", Monday: "Monday", Tuesday: "Tuesday", Wednesday: "Wednesday",
    Thursday: "Thursday", Friday: "Friday", Saturday: "Saturday"
  },
  es: {
    Sun: "Dom", Mon: "Lun", Tue: "Mar", Wed: "Mié", Thu: "Jue", Fri: "Vie", Sat: "Sáb",
    Sunday: "Domingo", Monday: "Lunes", Tuesday: "Martes", Wednesday: "Miércoles",
    Thursday: "Jueves", Friday: "Viernes", Saturday: "Sábado"
  },
  pt: {
    Sun: "Dom", Mon: "Seg", Tue: "Ter", Wed: "Qua", Thu: "Qui", Fri: "Sex", Sat: "Sáb",
    Sunday: "Domingo", Monday: "Segunda", Tuesday: "Terça", Wednesday: "Quarta",
    Thursday: "Quinta", Friday: "Sexta", Saturday: "Sábado"
  },
  fr: {
    Sun: "Dim", Mon: "Lun", Tue: "Mar", Wed: "Mer", Thu: "Jeu", Fri: "Ven", Sat: "Sam",
    Sunday: "Dimanche", Monday: "Lundi", Tuesday: "Mardi", Wednesday: "Mercredi",
    Thursday: "Jeudi", Friday: "Vendredi", Saturday: "Samedi"
  },
  de: {
    Sun: "So", Mon: "Mo", Tue: "Di", Wed: "Mi", Thu: "Do", Fri: "Fr", Sat: "Sa",
    Sunday: "Sonntag", Monday: "Montag", Tuesday: "Dienstag", Wednesday: "Mittwoch",
    Thursday: "Donnerstag", Friday: "Freitag", Saturday: "Samstag"
  }
};

// Format a date with translated day name
export function formatDateWithTranslation(
  date: Date,
  formatStr: string,
  language: string
): string {
  const formatted = format(date, formatStr);
  const translations = dayTranslations[language] || dayTranslations.en;
  
  // Replace English day names with translated ones
  let result = formatted;
  Object.entries(dayTranslations.en).forEach(([engDay, _]) => {
    const translated = translations[engDay];
    if (translated && result.includes(engDay)) {
      result = result.replace(engDay, translated);
    }
  });
  
  return result;
}

// Get translated day name from day index (0 = Sunday)
export function getTranslatedDayName(dayIndex: number, language: string, short: boolean = false): string {
  const fullDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayKey = short ? shortDays[dayIndex] : fullDays[dayIndex];
  const translations = dayTranslations[language] || dayTranslations.en;
  return translations[dayKey] || dayKey;
}
