'use client';

import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import type { OnboardingFormValues } from '../types';

const TIMEZONES = [
  // North America
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  // Europe
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Warsaw',
  'Europe/Kiev',
  'Europe/Moscow',
  // Asia / Pacific
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
];

interface ProfileSetupStepProps {
  defaultValues: OnboardingFormValues;
  onSubmit: (values: OnboardingFormValues) => void;
  isSubmitting?: boolean;
}

export default function ProfileSetupStep({ defaultValues, onSubmit, isSubmitting = false }: ProfileSetupStepProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<OnboardingFormValues>({
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Set up your profile</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Personalize your experience.</p>
      </div>

      {/* Display Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Display Name
        </label>
        <input
          type="text"
          {...register('displayName', { required: 'Display name is required' })}
          disabled={isSubmitting}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50 ${
            errors.displayName ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {errors.displayName && (
          <p className="mt-1 text-xs text-red-500">{errors.displayName.message}</p>
        )}
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Timezone
        </label>
        <select
          {...register('timezone')}
          disabled={isSubmitting}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
        >
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Default Date Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Default Date Range
        </label>
        <select
          {...register('defaultDateRange')}
          disabled={isSubmitting}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
        >
          <option value="last7days">Last 7 Days</option>
          <option value="last30days">Last 30 Days</option>
          <option value="thisMonth">This Month</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Save & Continue
      </button>
    </form>
  );
}
