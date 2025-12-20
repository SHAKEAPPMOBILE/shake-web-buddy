import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function CommunityGuidelines() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="font-display text-4xl font-bold text-foreground mb-8">Community Guidelines</h1>
          
          <div className="prose prose-invert max-w-none space-y-8">
            <p className="text-muted-foreground">
              SHAKE-SOCIAL is built on trust, respect, and real human connection. By using SHAKE, you agree to follow these guidelines.
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">1. Be Respectful</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Treat everyone with kindness and respect</li>
                <li>No harassment, hate speech, discrimination, or bullying</li>
                <li>Respect personal boundaries and consent</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">2. Be Authentic</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Use real photos of yourself</li>
                <li>Do not impersonate others</li>
                <li>Do not misrepresent your identity or intentions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">3. Show Up</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>If you join an event, commit to attending</li>
                <li>Avoid last-minute cancellations</li>
                <li>Repeated no-shows harm the community</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">4. Zero Tolerance for Abuse</h2>
              <p className="text-muted-foreground mb-2">The following behaviors may result in immediate suspension or permanent ban:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Harassment or intimidation</li>
                <li>Sexual misconduct or unwanted advances</li>
                <li>Violence or threats</li>
                <li>Illegal activities</li>
                <li>Sharing private information without consent</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">5. Safety First</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Meet in public places</li>
                <li>Follow local laws and venue rules</li>
                <li>Report unsafe behavior immediately</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">6. Alcohol & Substances</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Consume responsibly</li>
                <li>Do not pressure others to drink or use substances</li>
                <li>Illegal drug use is strictly prohibited</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">7. Reporting & Enforcement</h2>
              <p className="text-muted-foreground mb-2">SHAKE may take the following actions:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Warnings</li>
                <li>Temporary suspensions</li>
                <li>Permanent bans</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Decisions are made to protect the community and may be final.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact & Support</h2>
              <p className="text-muted-foreground">
                If you need help or want to report an issue:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Use the in-app support feature</li>
                <li>Email: <a href="mailto:contact@shakeapp.today" className="text-shake-yellow hover:underline">contact@shakeapp.today</a></li>
              </ul>
              <p className="text-muted-foreground mt-4">
                We're building SHAKE together — thank you for being part of a respectful, open-minded, real-life community 💛
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
