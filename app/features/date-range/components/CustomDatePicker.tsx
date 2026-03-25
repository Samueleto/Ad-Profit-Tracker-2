'use client';

import { useState } from 'react';
import { differenceInDays } from 'date-fns';
import { useDateRangeStore } from '@/store/dateRangeStore';

export default function CustomDatePicker() {
  const { pendingFromDate, pendingToDate, setCustomRange, applyCustomRange } = useDateRangeStore();

  const [localFrom, setLocalFrom] = useState(pendingFromDate ?? '');
  const [localTo, setLocalTo] = useState(pendingToDate ?? '');

  const daysDiff = localFrom && localTo
    ? differenceInDays(new Date(localTo), new Date(localFrom))
    : 0;

  const isInvalid = daysDiff > 90 || daysDiff < 0;
  const canApply = localFrom !== '' && localTo !== '' && !isInvalid;

  const handleFromChange = (val: string) => {
    setLocalFrom(val);
    setCustomRange(val, localTo);
  };

  const handleToChange = (val: string) => {
    setLocalTo(val);
    setCustomRange(localFrom, val);
  };

  const handleApply = () => {
    if (canApply) applyCustomRange();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 dark:text-gray-400">From</label>
          <input
            type="date"
            value={localFrom}
            onChange={e => handleFromChange(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 dark:text-gray-400">To</label>
          <input
            type="date"
            value={localTo}
            onChange={e => handleToChange(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleApply}
          disabled={!canApply}
          className="px-3 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Apply
        </button>
      </div>
      {daysDiff > 90 && (
        <p className="text-xs text-red-500">Maximum range is 90 days</p>
      )}
      {daysDiff < 0 && localFrom && localTo && (
        <p className="text-xs text-red-500">End date must be after start date</p>
      )}
    </div>
  );
}
