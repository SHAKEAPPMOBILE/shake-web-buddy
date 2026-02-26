import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // The session is already established by Supabase auth listener
    // Just redirect to home and let AuthContext handle navigation based on user state
    const timer = setTimeout(() => {
      navigate("/");
    }, 500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-white">
      <LoadingSpinner />
    </div>
  );
}
