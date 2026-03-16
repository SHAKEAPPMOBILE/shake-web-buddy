import { useEffect, useMemo, useState } from "react";
import { getTodaysTheme, type DailyTheme } from "@/lib/themes";

function msUntilNextEpochDay(): number {
  const now = Date.now();
  const nextDay = (Math.floor(now / 86400000) + 1) * 86400000;
  return Math.max(1000, nextDay - now);
}

export function useDailyTheme(): DailyTheme {
  const [theme, setTheme] = useState<DailyTheme>(() => getTodaysTheme());

  useEffect(() => {
    let timeout: number | undefined;

    const schedule = () => {
      timeout = window.setTimeout(() => {
        setTheme(getTodaysTheme());
        schedule();
      }, msUntilNextEpochDay());
    };

    schedule();
    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, []);

  return useMemo(() => theme, [theme]);
}

