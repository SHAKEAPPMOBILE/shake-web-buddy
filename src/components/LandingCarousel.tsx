// Import avatars
import avatar1 from "@/assets/avatar-new-1.png";
import avatar2 from "@/assets/avatar-new-2.png";
import avatar3 from "@/assets/avatar-new-3.png";
import avatar4 from "@/assets/avatar-new-4.png";
import avatar5 from "@/assets/avatar-new-5.png";
import avatar6 from "@/assets/avatar-new-6.png";
import avatar7 from "@/assets/avatar-new-7.png";
import avatar8 from "@/assets/avatar-new-8.png";
import avatar9 from "@/assets/avatar-new-9.png";
import avatar11 from "@/assets/avatar-new-11.png";
import avatar12 from "@/assets/avatar-new-12.png";
import avatar13 from "@/assets/avatar-new-13.png";
import avatar14 from "@/assets/avatar-new-14.png";
import avatar15 from "@/assets/avatar-new-15.png";

// Import activity icons
import iconLunch from "@/assets/icon-lunch.png";
import iconDinner from "@/assets/icon-dinner.png";
import iconDrinks from "@/assets/icon-drinks.png";
import iconHike from "@/assets/icon-hike.png";

// Row 1: Mix of avatars and activity icons
const row1Continuous = [
  { type: "avatar", src: avatar1 },
  { type: "icon", src: iconLunch },
  { type: "avatar", src: avatar2 },
  { type: "avatar", src: avatar3 },
  { type: "icon", src: iconDrinks },
  { type: "avatar", src: avatar4 },
  { type: "avatar", src: avatar5 },
  { type: "icon", src: iconHike },
  { type: "avatar", src: avatar6 },
  { type: "avatar", src: avatar7 },
  { type: "icon", src: iconDinner },
  { type: "avatar", src: avatar8 },
  { type: "avatar", src: avatar9 },
  { type: "icon", src: iconLunch },
  { type: "avatar", src: avatar11 },
  { type: "avatar", src: avatar12 },
  { type: "icon", src: iconDrinks },
  { type: "avatar", src: avatar13 },
  { type: "avatar", src: avatar14 },
  { type: "icon", src: iconHike },
  { type: "avatar", src: avatar15 },
];

// Row 2: Mix of avatars and activity icons (reversed order)
const row5Continuous = [
  { type: "avatar", src: avatar15 },
  { type: "icon", src: iconDinner },
  { type: "avatar", src: avatar14 },
  { type: "avatar", src: avatar13 },
  { type: "icon", src: iconLunch },
  { type: "avatar", src: avatar12 },
  { type: "avatar", src: avatar11 },
  { type: "icon", src: iconDrinks },
  { type: "avatar", src: avatar9 },
  { type: "avatar", src: avatar8 },
  { type: "icon", src: iconHike },
  { type: "avatar", src: avatar7 },
  { type: "avatar", src: avatar6 },
  { type: "icon", src: iconDinner },
  { type: "avatar", src: avatar5 },
  { type: "avatar", src: avatar4 },
  { type: "icon", src: iconLunch },
  { type: "avatar", src: avatar3 },
  { type: "avatar", src: avatar2 },
  { type: "icon", src: iconHike },
  { type: "avatar", src: avatar1 },
];

// Duplicate for seamless loop - more duplicates for continuous rows
const allRow1 = [...row1Continuous, ...row1Continuous, ...row1Continuous, ...row1Continuous, ...row1Continuous, ...row1Continuous];
const allRow5 = [...row5Continuous, ...row5Continuous, ...row5Continuous, ...row5Continuous, ...row5Continuous, ...row5Continuous];

interface DiagonalRowProps {
  items: typeof row1Continuous;
  direction: "left" | "right";
  speed?: "slow" | "normal" | "fast";
  opacity?: number;
}

function DiagonalRow({ items, direction, speed = "normal", opacity = 0.35 }: DiagonalRowProps) {
  const animationClass = direction === "left" ? "animate-scroll-left" : "animate-scroll-right";
  const speedClass = speed === "slow" ? "duration-[50s]" : speed === "fast" ? "duration-[20s]" : "duration-[35s]";
  
  return (
    <div className="flex gap-8 whitespace-nowrap" style={{ animationDuration: speed === "slow" ? "90s" : speed === "fast" ? "40s" : "60s" }}>
      <div className={`flex gap-8 ${animationClass}`} style={{ animationDuration: speed === "slow" ? "90s" : speed === "fast" ? "40s" : "60s" }}>
        {items.map((item, index) => (
          <div
            key={index}
            className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-card/50 border border-border/30 flex items-center justify-center overflow-hidden"
            style={{ opacity }}
          >
            <img
              src={item.src}
              alt=""
              className={item.type === "avatar" ? "w-full h-full object-cover rounded-full" : "w-7 h-7 sm:w-8 sm:h-8 object-contain"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingCarousel() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none animate-carousel-breathe">
      {/* Rotated container for diagonal effect */}
      <div 
        className="absolute inset-0 flex flex-col justify-center gap-6 sm:gap-8 pt-32"
        style={{ 
          transform: "rotate(-12deg) scale(1.3)",
          transformOrigin: "center center"
        }}
      >
        {/* Row 1 - scrolling left */}
        <div className="w-[200%] -ml-[50%]">
          <DiagonalRow items={allRow1} direction="left" speed="slow" opacity={1} />
        </div>
        
        {/* Row 2 - scrolling right (ascending) */}
        <div className="w-[200%] -ml-[50%]">
          <DiagonalRow items={allRow5} direction="right" speed="slow" opacity={1} />
        </div>
      </div>
    </div>
  );
}
