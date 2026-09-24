import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { ShakeGlassDialog } from "@/components/ShakeGlassDialog";
import { useFriends } from "@/hooks/useFriends";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface Person { user_id: string; name: string | null; avatar_url: string | null }

/** Pick someone to add to a chat: your friends up front, name search below. */
export function AddPersonDialog({ excludeIds, onPick, onClose }: {
  excludeIds: string[];
  onPick: (person: Person) => void;
  onClose: () => void;
}) {
  const { friends, isLoadingFriends, searchUsersByName } = useFriends();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[] | null>(null);
  const [searching, setSearching] = useState(false);
  const excluded = new Set(excludeIds);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults(null); return; }
    setSearching(true);
    const id = window.setTimeout(async () => {
      const found = await searchUsersByName(q);
      setResults(found.map((f) => ({ user_id: f.user_id, name: f.name, avatar_url: f.avatar_url })));
      setSearching(false);
    }, 250);
    return () => window.clearTimeout(id);
  }, [query, searchUsersByName]);

  const list = (results ?? friends.map((f) => ({ user_id: f.user_id, name: f.name, avatar_url: f.avatar_url })))
    .filter((p) => !excluded.has(p.user_id));

  return (
    <ShakeGlassDialog onClose={onClose} zIndex={20001}>
      <h2 className="text-lg font-bold text-gray-900">Add someone</h2>
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
          className="w-full h-10 rounded-full pl-9 pr-3 text-sm bg-white/80 border border-black/10 outline-none focus:border-blue-400"
          autoFocus
        />
      </div>
      <div className="max-h-64 overflow-y-auto text-left -mx-1">
        {(isLoadingFriends && !results) || searching ? (
          <div className="flex justify-center py-6"><LoadingSpinner size="md" /></div>
        ) : list.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">{results ? "No one found." : "No friends to add yet — search by name."}</p>
        ) : (
          list.map((p) => (
            <button
              key={p.user_id}
              type="button"
              onClick={() => onPick(p)}
              className="flex items-center gap-3 w-full px-2 py-2 rounded-xl hover:bg-black/5 text-left"
            >
              <span className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center shrink-0 text-sm font-semibold text-gray-600">
                {p.avatar_url ? <img src={getDisplayAvatarUrl(p.avatar_url) ?? p.avatar_url} alt="" className="w-full h-full object-cover" /> : (p.name || "S").charAt(0).toUpperCase()}
              </span>
              <span className="text-sm font-medium text-gray-900 truncate">{p.name || "Shaker"}</span>
            </button>
          ))
        )}
      </div>
      <button type="button" onClick={onClose} className="w-full text-sm text-muted-foreground hover:text-foreground py-1">Cancel</button>
    </ShakeGlassDialog>
  );
}
