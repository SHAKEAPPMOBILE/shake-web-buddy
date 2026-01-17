import { UserPlus, Search, Calendar } from "lucide-react";
import avatar3 from "@/assets/avatar-3.png";
import avatar4 from "@/assets/avatar-4.png";

export function HowItWorks() {
  const steps = [
    {
      icon: <UserPlus className="w-8 h-8" />,
      title: "Sign Up",
      description: "Create your account with your phone number.",
      color: "from-primary to-accent",
      isAvatar: false,
    },
    {
      icon: <Search className="w-8 h-8" />,
      title: "Find Activities",
      description: "Explore activities happening near you based on your interests.",
      color: "from-shake-teal to-secondary",
      isAvatar: false,
    },
    {
      icon: <Calendar className="w-8 h-8" />,
      title: "Join or Create an Activity",
      description: "Join or create plans for activities with other shakers.",
      color: "from-shake-purple to-accent",
      isAvatar: false,
    },
    {
      icon: null,
      title: "Meet & Connect",
      description: "Show up, meet amazing people, and make lasting connections.",
      color: "from-shake-yellow to-shake-green",
      isAvatar: true,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 mt-16 md:mt-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/30 to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From signing up to making friends, it only takes a few simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => {
            // Vibrant card background gradients
            const cardGradients = [
              "bg-gradient-to-br from-violet-500 via-purple-500 to-blue-500",
              "bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500",
              "bg-gradient-to-br from-fuchsia-500 via-purple-400 to-violet-500",
              "bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-500",
            ];
            
            return (
              <div
                key={step.title}
                className="relative animate-fade-up"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-1/2 w-full h-px bg-gradient-to-r from-white/20 via-white/40 to-white/20" />
                )}
                
                <div className={`relative ${cardGradients[index]} rounded-2xl p-8 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] group`}>
                  {/* Step number */}
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-sm font-bold text-white group-hover:bg-white/30 transition-colors">
                    {index + 1}
                  </div>
                  
                  {/* Icon */}
                  <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-110 transition-transform">
                    {step.isAvatar ? (
                      <div className="flex -space-x-2">
                        <img src={avatar3} alt="" className="w-8 h-8 rounded-full border-2 border-white/50" />
                        <img src={avatar4} alt="" className="w-8 h-8 rounded-full border-2 border-white/50" />
                      </div>
                    ) : step.icon}
                  </div>
                  
                  <h3 className="text-xl font-display font-bold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-white/80">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
