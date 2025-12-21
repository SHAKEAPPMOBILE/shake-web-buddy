import polaroidFriends from "@/assets/polaroid-friends.png";
import polaroidActivities from "@/assets/polaroid-activities.png";
import polaroidDrinks from "@/assets/polaroid-drinks.jpg";

export function PolaroidGallery() {
  return (
    <section className="pt-12 md:pt-16 pb-16 md:pb-24 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
          {/* First Polaroid - Activities - far left (smaller) */}
          <div 
            className="relative transform -rotate-6 hover:-rotate-3 transition-transform duration-300 animate-fade-up"
            style={{ animationDelay: "50ms" }}
          >
            <div className="bg-white p-3 pb-12 shadow-2xl rounded-sm">
              <div className="w-56 h-72 md:w-64 md:h-80 overflow-hidden">
                <img 
                  src={polaroidActivities} 
                  alt="People enjoying activities together" 
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>
            {/* Tape effect */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-yellow-100/80 rotate-3 shadow-sm" />
          </div>

          {/* Second Polaroid - Let's Shake (polaroidFriends) */}
          <div 
            className="relative transform rotate-3 hover:rotate-1 transition-transform duration-300 animate-fade-up"
            style={{ animationDelay: "150ms" }}
          >
            <div className="bg-white p-3 pb-12 shadow-2xl rounded-sm">
              <div className="w-64 h-80 md:w-72 md:h-96 overflow-hidden">
                <img 
                  src={polaroidFriends} 
                  alt="Friends having fun together" 
                  className="w-full h-full object-cover object-bottom"
                />
              </div>
            </div>
            {/* Tape effect */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-yellow-100/80 -rotate-2 shadow-sm" />
          </div>

          {/* Third Polaroid - Drinks - far right (smaller) */}
          <div 
            className="relative transform rotate-6 hover:rotate-3 transition-transform duration-300 animate-fade-up"
            style={{ animationDelay: "250ms" }}
          >
            <div className="bg-white p-3 pb-12 shadow-2xl rounded-sm">
              <div className="w-56 h-72 md:w-64 md:h-80 overflow-hidden">
                <img 
                  src={polaroidDrinks} 
                  alt="Friends enjoying drinks together" 
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>
            {/* Tape effect */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-yellow-100/80 -rotate-2 shadow-sm" />
          </div>
        </div>
      </div>
    </section>
  );
}
