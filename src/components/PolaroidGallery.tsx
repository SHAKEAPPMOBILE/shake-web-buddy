import polaroidFriends from "@/assets/polaroid-friends.png";
import polaroidActivities from "@/assets/polaroid-activities.png";

export function PolaroidGallery() {
  return (
    <section className="py-16 md:py-24 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
          {/* First Polaroid - tilted left */}
          <div 
            className="relative transform -rotate-3 hover:rotate-0 transition-transform duration-300 animate-fade-up"
            style={{ animationDelay: "100ms" }}
          >
            <div className="bg-white p-3 pb-12 shadow-2xl rounded-sm overflow-visible">
              <div className="w-64 h-80 md:w-72 md:h-96 overflow-visible">
                <img 
                  src={polaroidFriends} 
                  alt="Friends having fun together" 
                  className="w-auto h-full object-cover object-top -ml-6"
                />
              </div>
            </div>
            {/* Tape effect */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-yellow-100/80 rotate-2 shadow-sm" />
          </div>

          {/* Second Polaroid - tilted right */}
          <div 
            className="relative transform rotate-3 hover:rotate-0 transition-transform duration-300 animate-fade-up"
            style={{ animationDelay: "200ms" }}
          >
            <div className="bg-white p-3 pb-12 shadow-2xl rounded-sm">
              <div className="w-64 h-80 md:w-72 md:h-96 overflow-hidden">
                <img 
                  src={polaroidActivities} 
                  alt="People enjoying activities together" 
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
