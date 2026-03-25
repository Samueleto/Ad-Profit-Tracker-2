'use client';

interface ApiKeysTeaserStepProps {
  onGoToSettings: () => void;
  onSkip: () => void;
}

const NETWORKS = [
  { name: 'ExoClick', role: 'Traffic Source' },
  { name: 'RollerAds', role: 'Traffic Source' },
  { name: 'Zeydoo', role: 'Affiliate Network' },
  { name: 'Propush', role: 'Push Monetization' },
];

export default function ApiKeysTeaserStep({ onGoToSettings, onSkip }: ApiKeysTeaserStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Connect your networks</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          To pull live data into your dashboard, you&apos;ll need API keys for each ad network you use. We support:
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {NETWORKS.map(n => (
          <div
            key={n.name}
            className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
          >
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{n.name}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{n.role}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        You can add API keys in Settings → API Keys at any time. Your keys are encrypted at rest.
      </p>

      <div className="flex flex-col gap-2">
        <button
          onClick={onGoToSettings}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          Go to Settings
        </button>
        <button
          onClick={onSkip}
          className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
