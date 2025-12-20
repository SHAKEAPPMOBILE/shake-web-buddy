import { Button } from "@/components/ui/button";
import { Apple, Play, Smartphone } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-secondary/20 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-6xl font-display font-bold text-foreground">
            Ready to{" "}
            <span className="text-gradient">Shake</span>
            {" "}Things Up?
          </h2>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Download the app and start discovering activities in your city. 
            Your next adventure is just a shake away.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button variant="default" size="lg" className="w-full sm:w-auto gap-3">
              <Apple className="w-5 h-5" />
              App Store
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto gap-3">
              <Play className="w-5 h-5" />
              Google Play
            </Button>
          </div>

          <div className="pt-8">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="w-4 h-4" />
              <span>Free to download • No credit card required</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
