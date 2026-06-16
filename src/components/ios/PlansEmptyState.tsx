interface PlansEmptyStateProps {
  onInvite: () => void;
  invitePoints?: number;
}

export function PlansEmptyState({ onInvite, invitePoints = 5 }: PlansEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 gap-4 py-6">
      <img
        src="/assets/confused-john-travolta.gif"
        alt="No plans yet"
        className="w-full max-w-md mx-auto h-auto rounded-xl"
      />
      <p className="text-base font-medium text-gray-700">
        No plans yet
      </p>
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onInvite}
          className="px-6 py-2.5 rounded-full font-semibold text-sm text-white animate-gradient-shift active:scale-95 transition-transform"
        >
          Invite a Friend
        </button>
        {invitePoints > 0 && (
          <p className="text-xs text-gray-500">
            & earn <span className="font-semibold text-amber-500">{invitePoints} pts</span>
          </p>
        )}
      </div>
    </div>
  );
}
