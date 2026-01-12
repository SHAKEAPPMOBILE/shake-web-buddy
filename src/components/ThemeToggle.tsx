import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/ThemeContext";

type ThemeToggleProps = {
  label?: string;
  className?: string;
};

export function ThemeToggle({ label = "Theme", className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={className}>
      <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-muted/60 border border-border shadow-sm">
        <Sun className={"w-5 h-5 text-muted-foreground"} />
        <Switch checked={isDark} onCheckedChange={toggleTheme} aria-label="Toggle theme" />
        <Moon className={"w-5 h-5 text-muted-foreground"} />
      </div>
    </div>
  );
}
