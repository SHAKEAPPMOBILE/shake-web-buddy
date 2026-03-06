import { Link } from "react-router-dom";
import { MapPin, ArrowLeft } from "lucide-react";
import { VenuesTab } from "@/components/admin/VenuesTab";

/**
 * Public venues admin – same VenuesTab as /admin but no password.
 * Use this URL to manage venues without logging into the full admin.
 */
export default function PublicVenues() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to app
          </Link>
        </div>
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6" />
            Venues
          </h1>
          <p className="opacity-90 mt-1 text-sm">
            Add and edit venues for Lunch, Dinner, Brunch & Drinks. These show in the app when users join activities.
          </p>
        </div>
        <VenuesTab />
      </div>
    </div>
  );
}
