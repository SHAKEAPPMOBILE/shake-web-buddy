import { MapPin, Calendar, Users, Clock, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActivityCardProps {
  id: string;
  title: string;
  category: string;
  location: string;
  date: string;
  time: string;
  spotsLeft: number;
  totalSpots: number;
  image: string;
  price?: number;
}

export function ActivityCard({
  title,
  category,
  location,
  date,
  time,
  spotsLeft,
  totalSpots,
  image,
  price,
}: ActivityCardProps) {
  const categoryColors: Record<string, string> = {
    hike: "bg-shake-green",
    drinks: "bg-shake-purple",
    coffee: "bg-shake-yellow",
    lunch: "bg-primary",
    dinner: "bg-shake-coral",
    social: "bg-shake-teal",
  };

  return (
    <Card variant="activity" className="overflow-hidden">
      <div className="relative h-40 overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        <span className={cn(
          "absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold text-primary-foreground",
          categoryColors[category.toLowerCase()] || "bg-primary"
        )}>
          {category}
        </span>
        {price !== undefined && (
          <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold bg-card/80 backdrop-blur-sm text-foreground">
            ${price}
          </span>
        )}
      </div>
      
      <div className="p-5 space-y-4">
        <h3 className="font-display font-bold text-lg text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {title}
        </h3>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="line-clamp-1">{location}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-secondary" />
              <span>{date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              <span>{time}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              <span className="font-semibold text-primary">{spotsLeft}</span>
              <span className="text-muted-foreground">/{totalSpots} spots</span>
            </span>
          </div>
          <Button size="sm" variant="ghost" className="group-hover:text-primary">
            Join <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ActivityGrid() {
  const activities = [
    {
      id: "1",
      title: "Sunset Hike at Runyon Canyon",
      category: "Hike",
      location: "Runyon Canyon Park, LA",
      date: "Sat, Dec 21",
      time: "4:00 PM",
      spotsLeft: 3,
      totalSpots: 8,
      image: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=600",
      price: 15,
    },
    {
      id: "2",
      title: "Rooftop Drinks Downtown",
      category: "Drinks",
      location: "The Standard Hotel, LA",
      date: "Fri, Dec 20",
      time: "7:00 PM",
      spotsLeft: 5,
      totalSpots: 10,
      image: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600",
      price: 25,
    },
    {
      id: "3",
      title: "Weekend Brunch Club",
      category: "Lunch",
      location: "Sqirl, Silver Lake",
      date: "Sun, Dec 22",
      time: "11:00 AM",
      spotsLeft: 2,
      totalSpots: 6,
      image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600",
      price: 35,
    },
    {
      id: "4",
      title: "Coffee & Networking",
      category: "Coffee",
      location: "Blue Bottle Coffee",
      date: "Mon, Dec 23",
      time: "9:00 AM",
      spotsLeft: 6,
      totalSpots: 8,
      image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600",
      price: 10,
    },
    {
      id: "5",
      title: "Italian Dinner Night",
      category: "Dinner",
      location: "Bestia, Arts District",
      date: "Thu, Dec 19",
      time: "7:30 PM",
      spotsLeft: 4,
      totalSpots: 8,
      image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600",
      price: 55,
    },
    {
      id: "6",
      title: "Beach Volleyball & BBQ",
      category: "Social",
      location: "Santa Monica Beach",
      date: "Sat, Dec 21",
      time: "2:00 PM",
      spotsLeft: 8,
      totalSpots: 16,
      image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600",
      price: 20,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {activities.map((activity, index) => (
        <div 
          key={activity.id}
          className="animate-fade-up"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <ActivityCard {...activity} />
        </div>
      ))}
    </div>
  );
}
