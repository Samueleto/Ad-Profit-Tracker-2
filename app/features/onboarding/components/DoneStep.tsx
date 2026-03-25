'use client';

interface DoneStepProps {
  onGoToDashboard: () => void;
}

export default function DoneStep({ onGoToDashboard }: DoneStepProps) {
  return (
    <div className="text-center space-y-6">
      {/* Animated checkmark */}
      <div className="flex items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-bounce-once">
          <svg
            className="w-10 h-10 text-green-600 dark:text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
              className="stroke-dasharray-[50] stroke-dashoffset-[50] animate-check-draw"
              style={{
                strokeDasharray: 50,
                strokeDashoffset: 0,
                animation: 'checkDraw 0.6s ease forwards',
              }}
            />
          </svg>
        </div>
      </div>

      <style>{`
        @keyframes checkDraw {
          from { stroke-dashoffset: 50; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Your dashboard is ready!
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Everything is set up. Start tracking your ad profit today.
        </p>
      </div>

      <button
        onClick={onGoToDashboard}
        className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
