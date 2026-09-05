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
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Sun className="w-4 h-4 text-gray-400" />
      <Switch
        checked={isDark}
        onCheckedChange={toggleTheme}
        aria-label="Toggle theme"
        className="data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-200"
        thumbClassName="bg-white"
      />
      <Moon className="w-4 h-4 text-gray-400" />
    </div>
  );
}
