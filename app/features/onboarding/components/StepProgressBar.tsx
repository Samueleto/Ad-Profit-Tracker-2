'use client';

interface StepProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export default function StepProgressBar({ currentStep, totalSteps }: StepProgressBarProps) {
  return (
    <div className="flex flex-col items-center mb-8">
      <div className="flex items-center gap-3">
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isComplete = step < currentStep;
          const isCurrent = step === currentStep;
          return (
            <div key={step} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 ${
                  isCurrent
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : isComplete
                    ? 'bg-blue-200 border-blue-200 text-blue-700 dark:bg-blue-800 dark:border-blue-800 dark:text-blue-200'
                    : 'bg-white border-gray-300 text-gray-400 dark:bg-gray-900 dark:border-gray-600'
                }`}
              >
                {step}
              </div>
              {step < totalSteps && (
                <div
                  className={`w-8 h-0.5 ${
                    step < currentStep ? 'bg-blue-300 dark:bg-blue-700' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Step {currentStep} of {totalSteps}
      </p>
    </div>
  );
}
