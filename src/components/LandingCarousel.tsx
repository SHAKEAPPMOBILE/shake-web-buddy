import { useEffect, useState } from "react";

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

const items = [
  { type: "avatar", src: avatar1 },
  { type: "icon", src: iconLunch },
  { type: "avatar", src: avatar2 },
  { type: "icon", src: iconDrinks },
  { type: "avatar", src: avatar3 },
  { type: "icon", src: iconDinner },
  { type: "avatar", src: avatar4 },
  { type: "icon", src: iconHike },
  { type: "avatar", src: avatar5 },
  { type: "icon", src: iconLunch },
  { type: "avatar", src: avatar6 },
  { type: "icon", src: iconDrinks },
  { type: "avatar", src: avatar7 },
  { type: "icon", src: iconDinner },
  { type: "avatar", src: avatar8 },
  { type: "icon", src: iconHike },
  { type: "avatar", src: avatar9 },
];

// Duplicate for seamless loop
const allItems = [...items, ...items];

export function LandingCarousel() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Top row - moving left */}
      <div className="absolute top-[15%] left-0 w-full">
        <div className="flex gap-6 animate-scroll-left">
          {allItems.map((item, index) => (
            <div
              key={`top-${index}`}
              className="flex-shrink-0 w-14 h-14 rounded-full bg-card/50 border border-border/30 flex items-center justify-center overflow-hidden opacity-40"
            >
              <img
                src={item.src}
                alt=""
                className={item.type === "avatar" ? "w-full h-full object-cover" : "w-8 h-8 object-contain"}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom row - moving right */}
      <div className="absolute bottom-[20%] left-0 w-full">
        <div className="flex gap-6 animate-scroll-right">
          {[...allItems].reverse().map((item, index) => (
            <div
              key={`bottom-${index}`}
              className="flex-shrink-0 w-14 h-14 rounded-full bg-card/50 border border-border/30 flex items-center justify-center overflow-hidden opacity-40"
            >
              <img
                src={item.src}
                alt=""
                className={item.type === "avatar" ? "w-full h-full object-cover" : "w-8 h-8 object-contain"}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
