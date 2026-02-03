import { useState } from "react";
import { Heart, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KindHumanDonationProps {
  onClose?: () => void;
  showHeader?: boolean;
}

export function KindHumanDonation({ onClose, showHeader = false }: KindHumanDonationProps) {
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const quickAmounts = [5, 10, 25, 50];

  const handleDonate = async () => {
    const numAmount = parseFloat(amount);
    
    if (!numAmount || numAmount < 1) {
      toast.error("Please enter an amount of at least $1");
      return;
    }

    if (numAmount > 999) {
      toast.error("Maximum donation is $999");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-donation", {
        body: { amount: numAmount },
      });

      if (error) throw error;
      
      // Check for error in response data
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Failed to create donation session");
      }
    } catch (error: any) {
      console.error("Error creating donation:", error);
      toast.error(error?.message || "Failed to start donation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`space-y-4 ${showHeader ? '' : 'pt-4 border-t border-border'}`}>
      {showHeader && (
        <div className="flex flex-col items-center gap-2 pb-2">
          <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center">
            <Heart className="w-6 h-6 text-pink-500" />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground">Kind Human</h2>
          <p className="text-sm text-muted-foreground text-center">Support SHAKE</p>
        </div>
      )}
      
      {!showHeader && (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center">
            <Heart className="w-4 h-4 text-pink-500" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Kind Human</h3>
            <p className="text-xs text-muted-foreground">Support SHAKE</p>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground text-center">
        Love what we're building? Help us grow the SHAKE community with any amount you'd like to give. 💚
      </p>

      <div className="flex flex-wrap gap-2">
        {quickAmounts.map((quickAmount) => (
          <button
            key={quickAmount}
            onClick={() => setAmount(quickAmount.toString())}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              amount === quickAmount.toString()
                ? "bg-pink-500 text-white"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            ${quickAmount}
          </button>
        ))}
      </div>

      <div className="relative">
        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="number"
          placeholder="Enter custom amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="pl-8 bg-background"
          min={1}
          max={999}
        />
      </div>

      <Button
        onClick={handleDonate}
        disabled={isLoading || !amount || parseFloat(amount) < 1}
        className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-90 text-white"
      >
        {isLoading ? (
          "Processing..."
        ) : (
          <>
            <Heart className="w-4 h-4 mr-2" />
            Support {amount ? `$${amount}` : ""}
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        One-time support • Secure payment via Stripe
      </p>
    </div>
  );
}
