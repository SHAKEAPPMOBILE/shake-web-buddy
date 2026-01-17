import { MapPin, Mountain, Wine, Coffee, Utensils, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityCategoryProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  count?: number;
  onClick?: () => void;
}

const iconMap = {
  hike: Mountain,
  drinks: Wine,
  coffee: Coffee,
  lunch: Utensils,
  dinner: Utensils,
  social: Users,
};

const colorMap = {
  hike: "from-shake-green to-shake-teal",
  drinks: "from-shake-purple to-accent",
  coffee: "from-shake-yellow to-primary",
  lunch: "from-primary to-accent",
  dinner: "from-accent to-shake-purple",
  social: "from-shake-teal to-secondary",
};

export function ActivityCategory({ icon, label, color, count, onClick }: ActivityCategoryProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center gap-3 p-6 rounded-2xl",
        "bg-card border border-border hover:border-primary/50",
        "transition-all duration-300 hover:scale-105 hover:shadow-xl",
        "focus:outline-none focus:ring-2 focus:ring-primary"
      )}
    >
      <div className={cn(
        "w-16 h-16 rounded-xl flex items-center justify-center",
        "bg-gradient-to-br",
        color,
        "shadow-lg group-hover:shadow-xl transition-shadow"
      )}>
        {icon}
      </div>
      <span className="font-display font-semibold text-foreground">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">{count} upcoming</span>
      )}
    </button>
  );
}

export function ActivityCategoryGrid() {
  const categories = [
    { id: "hike", icon: <Mountain className="w-8 h-8 text-primary-foreground" />, label: "Hike", color: colorMap.hike, count: 5 },
    { id: "drinks", icon: <Wine className="w-8 h-8 text-primary-foreground" />, label: "Drinks", color: colorMap.drinks, count: 12 },
    { id: "coffee", icon: <Coffee className="w-8 h-8 text-primary-foreground" />, label: "Coffee", color: colorMap.coffee, count: 8 },
    { id: "lunch", icon: <Utensils className="w-8 h-8 text-primary-foreground" />, label: "Lunch", color: colorMap.lunch, count: 6 },
    { id: "dinner", icon: <Utensils className="w-8 h-8 text-primary-foreground" />, label: "Dinner", color: colorMap.dinner, count: 9 },
    { id: "social", icon: <Users className="w-8 h-8 text-primary-foreground" />, label: "Social", color: colorMap.social, count: 15 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {categories.map((cat, index) => (
        <div 
          key={cat.id} 
          className="animate-fade-up"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <ActivityCategory {...cat} />
        </div>
      ))}
    </div>
  );
}
