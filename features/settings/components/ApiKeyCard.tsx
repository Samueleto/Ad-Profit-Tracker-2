'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';

interface ApiKeyCardProps {
  networkId: string;
  networkName: string;
  status: 'connected' | 'not_connected';
  updatedAt: string | null;
  isSubmitting?: boolean;
  saveError?: string | null;
  onSave: (networkId: string, key: string) => Promise<void>;
  onDisconnect: (networkId: string) => Promise<void>;
}

interface KeyFormValues {
  apiKey: string;
}

export default function ApiKeyCard({
  networkId,
  networkName,
  status,
  updatedAt,
  isSubmitting = false,
  saveError,
  onSave,
  onDisconnect,
}: ApiKeyCardProps) {
  const [showInput, setShowInput] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<KeyFormValues>();

  const handleSave = async (values: KeyFormValues) => {
    await onSave(networkId, values.apiKey);
    reset();
    setShowInput(false);
  };

  const handleConfirmDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnect(networkId);
    } finally {
      setDisconnecting(false);
      setConfirmDisconnect(false);
    }
  };

  const inputForm = (
    <form onSubmit={handleSubmit(handleSave)} className="space-y-3 mt-3">
      <div>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            disabled={isSubmitting}
            placeholder={`Enter your ${networkName} API key`}
            {...register('apiKey', { required: 'API key is required' })}
            className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50 ${
              errors.apiKey ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
            aria-label={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {(errors.apiKey || saveError) && (
          <p className="mt-1 text-xs text-red-500">{errors.apiKey?.message ?? saveError}</p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save
        </button>
        {status === 'connected' && (
          <button
            type="button"
            onClick={() => { setShowInput(false); reset(); }}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{networkName}</h3>
          {status === 'connected' && updatedAt && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Updated {new Date(updatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {status === 'connected' ? (
            <>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3" />
                Connected
              </span>
              {!showInput && (
                <button
                  onClick={() => setShowInput(true)}
                  className="text-xs px-2 py-1 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Update Key
                </button>
              )}
              {!confirmDisconnect && !showInput && (
                <button
                  onClick={() => setConfirmDisconnect(true)}
                  className="text-xs px-2 py-1 text-red-600 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Disconnect
                </button>
              )}
            </>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">Not connected</span>
          )}
        </div>
      </div>

      {/* Inline disconnect confirmation */}
      {confirmDisconnect && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400 mb-2">Remove this API key?</p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 transition-colors"
            >
              {disconnecting && <Loader2 className="w-3 h-3 animate-spin" />}
              Confirm
            </button>
            <button
              onClick={() => setConfirmDisconnect(false)}
              className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Show form: always for not_connected, or when Update Key clicked */}
      {(status === 'not_connected' || showInput) && !confirmDisconnect && inputForm}
    </div>
  );
}
