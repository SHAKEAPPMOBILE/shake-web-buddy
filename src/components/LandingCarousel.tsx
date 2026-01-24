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

// Import activity icons
import iconLunch from "@/assets/icon-lunch.png";
import iconDinner from "@/assets/icon-dinner.png";
import iconDrinks from "@/assets/icon-drinks.png";
import iconHike from "@/assets/icon-hike.png";

const row1 = [
  { type: "avatar", src: avatar1 },
  { type: "icon", src: iconLunch },
  { type: "avatar", src: avatar2 },
  { type: "icon", src: iconDrinks },
  { type: "avatar", src: avatar3 },
];

const row2 = [
  { type: "icon", src: iconDinner },
  { type: "avatar", src: avatar4 },
  { type: "icon", src: iconHike },
  { type: "avatar", src: avatar5 },
  { type: "icon", src: iconLunch },
];

const row3 = [
  { type: "avatar", src: avatar6 },
  { type: "icon", src: iconDrinks },
  { type: "avatar", src: avatar7 },
  { type: "icon", src: iconDinner },
  { type: "avatar", src: avatar8 },
];

const row4 = [
  { type: "icon", src: iconHike },
  { type: "avatar", src: avatar9 },
  { type: "icon", src: iconLunch },
  { type: "avatar", src: avatar1 },
  { type: "icon", src: iconDrinks },
];

const row5 = [
  { type: "avatar", src: avatar2 },
  { type: "icon", src: iconDinner },
  { type: "avatar", src: avatar3 },
  { type: "icon", src: iconHike },
  { type: "avatar", src: avatar4 },
];

// Duplicate for seamless loop
const allRow1 = [...row1, ...row1, ...row1, ...row1];
const allRow2 = [...row2, ...row2, ...row2, ...row2];
const allRow3 = [...row3, ...row3, ...row3, ...row3];
const allRow4 = [...row4, ...row4, ...row4, ...row4];
const allRow5 = [...row5, ...row5, ...row5, ...row5];

interface DiagonalRowProps {
  items: typeof row1;
  direction: "left" | "right";
  speed?: "slow" | "normal" | "fast";
  opacity?: number;
}

function DiagonalRow({ items, direction, speed = "normal", opacity = 0.35 }: DiagonalRowProps) {
  const animationClass = direction === "left" ? "animate-scroll-left" : "animate-scroll-right";
  const speedClass = speed === "slow" ? "duration-[50s]" : speed === "fast" ? "duration-[20s]" : "duration-[35s]";
  
  return (
    <div className="flex gap-8 whitespace-nowrap" style={{ animationDuration: speed === "slow" ? "50s" : speed === "fast" ? "20s" : "35s" }}>
      <div className={`flex gap-8 ${animationClass}`} style={{ animationDuration: speed === "slow" ? "50s" : speed === "fast" ? "20s" : "35s" }}>
        {items.map((item, index) => (
          <div
            key={index}
            className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-card/50 border border-border/30 flex items-center justify-center overflow-hidden"
            style={{ opacity }}
          >
            <img
              src={item.src}
              alt=""
              className={item.type === "avatar" ? "w-full h-full object-cover" : "w-7 h-7 sm:w-8 sm:h-8 object-contain"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingCarousel() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Rotated container for diagonal effect */}
      <div 
        className="absolute inset-0 flex flex-col justify-center gap-6 sm:gap-8"
        style={{ 
          transform: "rotate(-12deg) scale(1.3)",
          transformOrigin: "center center"
        }}
      >
        {/* Row 1 */}
        <div className="w-[200%] -ml-[50%]">
          <DiagonalRow items={allRow1} direction="left" speed="slow" opacity={0.25} />
        </div>
        
        {/* Row 2 */}
        <div className="w-[200%] -ml-[50%]">
          <DiagonalRow items={allRow2} direction="right" speed="normal" opacity={0.35} />
        </div>
        
        {/* Row 3 - center, most visible */}
        <div className="w-[200%] -ml-[50%]">
          <DiagonalRow items={allRow3} direction="left" speed="fast" opacity={0.45} />
        </div>
        
        {/* Row 4 */}
        <div className="w-[200%] -ml-[50%]">
          <DiagonalRow items={allRow4} direction="right" speed="normal" opacity={0.35} />
        </div>
        
        {/* Row 5 */}
        <div className="w-[200%] -ml-[50%]">
          <DiagonalRow items={allRow5} direction="left" speed="slow" opacity={0.25} />
        </div>
      </div>
    </div>
  );
}
