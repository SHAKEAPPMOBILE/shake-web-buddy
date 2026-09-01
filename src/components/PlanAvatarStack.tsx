import { cn } from "@/lib/utils";
import { getDisplayAvatarUrl } from "@/lib/avatar";

export interface CohostAvatar {
  user_id: string;
  name?: string | null;
  avatar_url?: string | null;
}

// Creator avatar + up to 5 co-host avatars, overlapping left-to-right —
// used everywhere a plan currently shows just its creator's avatar.
export function PlanAvatarStack({
  creatorAvatarUrl,
  creatorName,
  cohosts = [],
  size = 40,
  ringClassName = "ring-2 ring-white",
  className,
}: {
  creatorAvatarUrl?: string | null;
  creatorName?: string | null;
  cohosts?: CohostAvatar[];
  size?: number;
  ringClassName?: string;
  className?: string;
}) {
  const shown = cohosts.slice(0, 5);
  return (
    <div className={cn("flex items-center", className)} style={{ marginLeft: shown.length > 0 ? size * 0.3 : 0 }}>
      <div
        className={cn("rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0", ringClassName)}
        style={{ width: size, height: size }}
      >
        {creatorAvatarUrl ? (
          <img src={getDisplayAvatarUrl(creatorAvatarUrl)} alt={creatorName || "Host"} className="w-full h-full object-cover" />
        ) : (
          <span className="font-semibold text-muted-foreground" style={{ fontSize: size * 0.4 }}>
            {(creatorName || "?").charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {shown.map((cohost) => (
        <div
          key={cohost.user_id}
          className={cn("rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0", ringClassName)}
          style={{ width: size, height: size, marginLeft: -size * 0.3 }}
        >
          {cohost.avatar_url ? (
            <img
              src={getDisplayAvatarUrl(cohost.avatar_url)}
              alt={cohost.name || "Co-host"}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-semibold text-muted-foreground" style={{ fontSize: size * 0.4 }}>
              {(cohost.name || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
