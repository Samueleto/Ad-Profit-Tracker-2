'use client';

interface WelcomeStepProps {
  displayName: string;
  onNext: () => void;
}

export default function WelcomeStep({ displayName, onNext }: WelcomeStepProps) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <span className="text-white text-2xl font-bold">AP</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Welcome{displayName ? `, ${displayName}` : ''}!
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
        Ad Profit Tracker helps you track revenue, costs, and profitability across all your ad networks in one place. Connect ExoClick, RollerAds, Zeydoo, and Propush — and see your true profit in real time.
      </p>
      <button
        onClick={onNext}
        className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
      >
        Get Started
      </button>
    </div>
  );
}
