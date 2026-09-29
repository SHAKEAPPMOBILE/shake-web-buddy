import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ContactSupport = () => (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => window.open("mailto:contact@shakeapp.today", "_blank")}
  >
    <Mail className="h-4 w-4 mr-1" />
    Contact Support
  </Button>
);

