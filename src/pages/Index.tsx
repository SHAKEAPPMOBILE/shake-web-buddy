import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { ActivityCategoryGrid } from "@/components/ActivityCategory";
import { ActivityGrid } from "@/components/ActivityCard";
import { HowItWorks } from "@/components/HowItWorks";
import { CTASection } from "@/components/CTASection";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main>
        <HeroSection />
        
        {/* Categories Section */}
        <section className="py-16 relative">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
                Find Your People
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Choose an activity type that matches your vibe
              </p>
            </div>
            <ActivityCategoryGrid />
          </div>
        </section>

        {/* Activities Feed */}
        <section id="activities" className="py-16 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/20 to-transparent" />
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
                  Upcoming Activities
                </h2>
                <p className="text-muted-foreground">
                  Join these events happening near you
                </p>
              </div>
              <a href="#" className="text-primary hover:text-primary/80 font-medium transition-colors">
                View all events →
              </a>
            </div>
            <ActivityGrid />
          </div>
        </section>

        <HowItWorks />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
};

export default Index;
