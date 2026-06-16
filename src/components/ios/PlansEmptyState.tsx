interface PlansEmptyStateProps {
  onInvite: () => void;
  invitePoints?: number;
}

export function PlansEmptyState({ onInvite, invitePoints = 5 }: PlansEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-6 gap-4">
      <img
        src="/assets/confused-john-travolta.gif"
        alt="No plans yet"
        className="w-32 h-auto rounded-xl opacity-80"
      />
      <p className="text-base font-medium text-gray-700">
        No plans yet — be the first to shake in your city!
      </p>
      {invitePoints > 0 && (
        <p className="text-xs text-gray-500">
          Invite a friend and earn{" "}
          <span className="font-semibold text-yellow-500">{invitePoints} pts</span>
        </p>
      )}
      <button
        type="button"
        onClick={onInvite}
        className="px-6 py-2.5 rounded-full font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all"
      >
        Invite a Friend
      </button>
    </div>
  );
}
