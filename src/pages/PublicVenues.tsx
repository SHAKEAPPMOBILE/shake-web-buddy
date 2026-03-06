import { Link } from "react-router-dom";
import { MapPin, ArrowLeft } from "lucide-react";
import { VenuesTab } from "@/components/admin/VenuesTab";

/**
 * Public venues admin – same layout and content as /admin Venues tab, no password.
 */
export default function PublicVenues() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to app
          </Link>
          <Link
            to="/admin"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Full admin →
          </Link>
        </div>
        {/* Same header as Admin.tsx */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
          <h1 className="text-3xl font-bold">🎯 SHAKE Admin</h1>
          <p className="opacity-90 mt-1">Manage users, venues, and payouts</p>
          <p className="opacity-75 mt-2 text-sm">Venues (public – no login)</p>
        </div>
        <VenuesTab />
      </div>
    </div>
  );
}
