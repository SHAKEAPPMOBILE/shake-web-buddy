import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Palette, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/app-toast";
import { PLAN_BACKGROUNDS } from "@/data/planBackgrounds";

export interface PlanOptionsMenuActivity {
  id: string;
  user_id: string;
  background_id?: string | null;
}

interface PlanOptionsMenuProps {
  activity: PlanOptionsMenuActivity;
  /** True when the viewer created this plan — shows Edit/Background/Delete. Non-creators only see Leave plan. */
  isCreator: boolean;
  /** Other joiners besides the creator — only used to word the delete-confirmation copy. */
  otherParticipantsCount?: number;
  isPaidPlan?: boolean;
  onDeleted?: () => void;
  onLeft?: () => void;
  onBackgroundChange?: (backgroundId: string | null) => void;
  triggerClassName?: string;
  iconClassName?: string;
}

/** Edit / change background / delete (creator) or leave (non-creator) — the
 *  same options menu shared by the plans list, the swipe feed, and the plan
 *  chat header, so all three stay in sync instead of drifting apart. */
export function PlanOptionsMenu({
  activity,
  isCreator,
  otherParticipantsCount = 0,
  isPaidPlan = false,
  onDeleted,
  onLeft,
  onBackgroundChange,
  triggerClassName = "p-2 rounded-full hover:bg-white/20 transition-colors",
  iconClassName = "w-5 h-5 text-white/80",
}: PlanOptionsMenuProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    navigate("/propose-plan", { state: { editActivityId: activity.id } });
  };

  const handleInitiateDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    setShowDeleteConfirm(true);
  };

  const handleDeletePlan = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
    if (!user) return;
    const { error } = await supabase.from("user_activities").delete()
      .eq("id", activity.id).eq("user_id", user.id);
    if (error) toast.error("Failed to delete plan");
    else { toast.success("Plan deleted"); onDeleted?.(); }
  };

  const handleLeavePlan = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (!user) return;
    const { error } = await supabase.from("activity_joins").delete()
      .eq("user_id", user.id).eq("activity_id", activity.id);
    if (error) toast.error("Failed to leave plan");
    else { toast.success("Left the plan"); onLeft?.(); }
  };

  const handleOpenBackgroundPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    setShowBackgroundPicker(true);
  };

  const handleSelectBackground = async (e: React.MouseEvent, backgroundId: string | null) => {
    e.stopPropagation();
    if (!user) return;
    setShowBackgroundPicker(false);
    const { error } = await supabase.from("user_activities")
      .update({ background_id: backgroundId })
      .eq("id", activity.id).eq("user_id", user.id);
    if (error) { toast.error("Failed to update background"); return; }
    onBackgroundChange?.(backgroundId);
  };

  return (
    <>
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
          className={triggerClassName}
          aria-label="Plan options"
        >
          <MoreVertical className={iconClassName} />
        </button>
        {showMenu && (
          <>
            {createPortal(
              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />,
              document.body
            )}
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-black/10 z-50 overflow-hidden">
              {isCreator ? (
                <>
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <span className="w-4 h-4 flex items-center justify-center text-base leading-none">🛸</span> Edit plan
                  </button>
                  <button
                    onClick={handleOpenBackgroundPicker}
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <Palette className="w-4 h-4" /> {activity.background_id ? "Change background" : "Add background"}
                  </button>
                  <button onClick={handleInitiateDelete} className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <span className="w-4 h-4 flex items-center justify-center text-base leading-none">🫣</span> Delete plan
                  </button>
                </>
              ) : (
                <button onClick={handleLeavePlan} className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <LogOut className="w-4 h-4" /> Leave plan
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Delete-plan confirmation ──
          Portaled to <body>: this component can be mounted inside an
          ancestor with a CSS transform (e.g. the swipe feed's action column,
          translateY(-50%)), which would otherwise become the containing
          block for `fixed` descendants and squash this into that ancestor's
          box instead of covering the viewport. */}
      {showDeleteConfirm && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-6"
          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 text-base mb-2">Delete plan?</h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              {otherParticipantsCount === 0
                ? "Delete this plan? This can't be undone."
                : isPaidPlan
                ? `${otherParticipantsCount} ${otherParticipantsCount === 1 ? "person has" : "people have"} paid to join. Deleting removes the plan for everyone — you'll need to refund them. Continue?`
                : `This will delete the plan and remove it for ${otherParticipantsCount} ${otherParticipantsCount === 1 ? "person" : "people"} who joined. This can't be undone.`}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
                className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePlan}
                className="flex-1 py-2.5 rounded-full bg-red-500 text-sm font-medium text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Background picker — portaled to <body>, same reason as above ── */}
      {showBackgroundPicker && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 px-4"
          onClick={(e) => { e.stopPropagation(); setShowBackgroundPicker(false); }}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-sm max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-gray-900 text-base mb-4">Plan background</h3>
            <div className="grid grid-cols-3 gap-3">
              <button type="button" onClick={(e) => handleSelectBackground(e, null)} className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-full aspect-square rounded-xl border-2 flex items-center justify-center bg-gray-100 ${
                    !activity.background_id ? "border-blue-500" : "border-gray-200"
                  }`}
                >
                  <span className="text-[10px] text-gray-400">None</span>
                </div>
              </button>
              {PLAN_BACKGROUNDS.map((bg) => (
                <button key={bg.id} type="button" onClick={(e) => handleSelectBackground(e, bg.id)} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-full aspect-square rounded-xl border-2 ${
                      activity.background_id === bg.id ? "border-blue-500" : "border-transparent"
                    }`}
                    style={{ background: bg.css }}
                  />
                  <span className="text-[10px] text-gray-500 leading-tight text-center">{bg.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
