import { UserPlus, Search, Calendar, Users } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      icon: <UserPlus className="w-8 h-8" />,
      title: "Sign Up",
      description: "Create your account with email or social login in seconds.",
      color: "from-primary to-shake-coral",
    },
    {
      icon: <Search className="w-8 h-8" />,
      title: "Browse Activities",
      description: "Explore activities happening near you based on your interests.",
      color: "from-shake-teal to-secondary",
    },
    {
      icon: <Calendar className="w-8 h-8" />,
      title: "Join an Activity",
      description: "Reserve your place with a small fee. Events happen with 3+ attendees.",
      color: "from-shake-purple to-accent",
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Meet & Connect",
      description: "Show up, meet amazing people, and make lasting connections.",
      color: "from-shake-yellow to-shake-green",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden">
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
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="relative animate-fade-up"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-1/2 w-full h-px bg-gradient-to-r from-border via-primary/30 to-border" />
              )}
              
              <div className="relative bg-card rounded-2xl p-8 border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-xl group">
                {/* Step number */}
                <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-sm font-bold text-muted-foreground group-hover:border-primary group-hover:text-primary transition-colors">
                  {index + 1}
                </div>
                
                {/* Icon */}
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-primary-foreground mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                  {step.icon}
                </div>
                
                <h3 className="text-xl font-display font-bold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
