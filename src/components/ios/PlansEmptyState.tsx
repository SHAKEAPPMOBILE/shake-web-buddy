interface PlansEmptyStateProps {
  onJoinActivity: () => void;
}

export function PlansEmptyState({ onJoinActivity }: PlansEmptyStateProps) {
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
      <button
        type="button"
        onClick={onJoinActivity}
        className="px-6 py-2.5 rounded-full font-semibold text-sm text-white animate-gradient-shift active:scale-95 transition-transform"
      >
        Join an activity
      </button>
    </div>
  );
}
