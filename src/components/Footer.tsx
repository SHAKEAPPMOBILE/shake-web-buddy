import { Github, Twitter, Instagram, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-16 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShakeLogo className="w-8 h-8" />
              <span className="font-display font-bold text-lg text-foreground">
                SHAKE
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Connect with real people through real experiences. Make every moment count.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4">Product</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cities</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Safety</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4">Company</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Careers</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Press</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Blog</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4">Support</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Help Center</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact Us</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 SHAKEapp Inc. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Made with ❤️ for social butterflies
          </p>
        </div>
      </div>
    </footer>
  );
}

function ShakeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none">
      <path
        d="M20 80 Q10 50 30 30 Q50 10 70 30"
        stroke="hsl(var(--shake-coral))"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M30 70 Q20 45 40 30 Q60 15 75 40"
        stroke="hsl(var(--shake-green))"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M40 80 Q25 55 45 35 Q65 15 85 45"
        stroke="hsl(var(--shake-teal))"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M50 85 Q35 60 55 40 Q75 20 90 55"
        stroke="hsl(var(--shake-yellow))"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
