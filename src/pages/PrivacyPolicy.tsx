import { Footer } from "@/components/Footer";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-16 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="font-display text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: September 2025</p>
          
          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Introduction</h2>
              <p className="text-muted-foreground">
                Welcome to SHAKE ("we", "us", "our"). We are committed to protecting and respecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal data when you use our app or otherwise interact with our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">1. Data We Collect</h2>
              <p className="text-muted-foreground mb-2">We may collect and process the following data about you:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Identity information: name, profile details</li>
                <li>Contact information: email address, phone number</li>
                <li>Usage data: activities joined, messages sent</li>
                <li>Optional information you choose to provide</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">2. How We Use Your Data</h2>
              <p className="text-muted-foreground mb-2">We use your personal data for purposes including:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Processing your registration and managing your account</li>
                <li>Communicating with you for account setup, updates, support</li>
                <li>Matching you with activities and other users</li>
                <li>Improving our services and offerings</li>
                <li>Maintaining security and compliance with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">3. Legal Bases for Processing</h2>
              <p className="text-muted-foreground mb-2">Where applicable, we rely on one or more of these legal bases:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Your consent</li>
                <li>Performance of a contract</li>
                <li>Our legitimate interests, provided they do not override your rights</li>
                <li>Compliance with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">4. Disclosure of Your Data</h2>
              <p className="text-muted-foreground mb-2">We may share your personal data with:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Other users when you join activities (limited information)</li>
                <li>Legal authorities if required by law</li>
                <li>Successors in the event of a merger or acquisition</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">5. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your personal data only for as long as needed for the purposes set out in this policy, and/or to comply with legal/regulatory obligations. When no longer needed, data will be securely deleted or anonymized.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">6. Security</h2>
              <p className="text-muted-foreground">
                We implement appropriate technical and organizational measures to safeguard your personal data against unauthorized or unlawful processing, accidental loss, destruction, or damage.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">7. Your Rights</h2>
              <p className="text-muted-foreground mb-2">Depending on your jurisdiction, you may have rights such as:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Accessing the personal data we hold about you</li>
                <li>Rectifying incorrect or incomplete data</li>
                <li>Requesting deletion of your data</li>
                <li>Restricting or objecting to processing</li>
                <li>Data portability</li>
                <li>Withdrawing consent</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                To exercise these rights, contact us at: <a href="mailto:contact@shakeapp.today" className="text-shake-yellow hover:underline">contact@shakeapp.today</a>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">8. Children's Privacy</h2>
              <p className="text-muted-foreground">
                Our service is not intended for children under 18 and we do not knowingly collect personal data from children under that age.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">9. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this policy from time to time. When we do, we will post the new version with an updated "Last updated" date.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
