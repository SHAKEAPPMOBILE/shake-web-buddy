export function FlagsCarousel() {
  // List of country flag emojis
  const flags = [
    "🇺🇸", "🇬🇧", "🇫🇷", "🇩🇪", "🇪🇸", "🇮🇹", "🇵🇹", "🇳🇱", "🇧🇪", "🇨🇭",
    "🇦🇹", "🇸🇪", "🇳🇴", "🇩🇰", "🇫🇮", "🇵🇱", "🇨🇿", "🇭🇺", "🇬🇷", "🇹🇷",
    "🇧🇷", "🇦🇷", "🇲🇽", "🇨🇴", "🇨🇱", "🇵🇪", "🇨🇦", "🇦🇺", "🇳🇿", "🇯🇵",
    "🇰🇷", "🇨🇳", "🇮🇳", "🇹🇭", "🇻🇳", "🇸🇬", "🇲🇾", "🇮🇩", "🇵🇭", "🇦🇪",
    "🇸🇦", "🇮🇱", "🇪🇬", "🇿🇦", "🇳🇬", "🇰🇪", "🇲🇦", "🇮🇪", "🇷🇺", "🇺🇦"
  ];

  // Duplicate the flags array for seamless loop
  const duplicatedFlags = [...flags, ...flags];

  return (
    <section className="pt-16 md:pt-24 pb-8 md:pb-12 bg-background overflow-hidden">
      <div className="relative">
        {/* Gradient fade on edges */}
        <div className="absolute left-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        
        {/* Scrolling container */}
        <div className="flex animate-scroll-flags">
          {duplicatedFlags.map((flag, index) => (
            <div
              key={index}
              className="flex-shrink-0 mx-3 md:mx-4 text-3xl md:text-4xl transition-transform hover:scale-125"
            >
              {flag}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
