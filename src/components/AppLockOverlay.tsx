import React, { useEffect, useState } from 'react';
import { Lock, Fingerprint, AlertCircle, ShieldAlert } from 'lucide-react';
import { db } from '../database/db';
import { secureStorageAdapter } from '../platform/adapters';

interface AppLockOverlayProps {
  onUnlocked: () => void;
}

export const AppLockOverlay: React.FC<AppLockOverlayProps> = ({ onUnlocked }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lockoutSec, setLockoutSec] = useState(0);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const settings = db.getSettings();

  useEffect(() => {
    secureStorageAdapter.checkBiometricsAvailable().then(setHasBiometrics);

    const timer = setInterval(() => {
      const remaining = secureStorageAdapter.getLockoutSecondsRemaining();
      setLockoutSec(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleDigit = (digit: string) => {
    if (lockoutSec > 0) return;
    if (pin.length < 6) {
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) {
        verify(next);
      }
    }
  };

  const handleBackspace = () => {
    if (lockoutSec > 0) return;
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const verify = async (inputPin: string) => {
    if (!settings.appLockPinHash || !settings.appLockSalt) {
      // No pin set, auto unlock
      onUnlocked();
      return;
    }

    const isValid = await secureStorageAdapter.verifyPin(inputPin, settings.appLockSalt, settings.appLockPinHash);
    if (isValid) {
      secureStorageAdapter.resetFailedAttempts();
      onUnlocked();
    } else {
      const attempts = secureStorageAdapter.recordFailedAttempt();
      setPin('');
      if (attempts >= 5) {
        setError('Too many failed attempts. Locked for 30 seconds.');
      } else {
        setError(`Incorrect PIN. ${5 - attempts} attempts remaining.`);
      }
    }
  };

  const handleBiometricAuth = async () => {
    if (lockoutSec > 0) return;
    const success = await secureStorageAdapter.authenticateBiometrics('Unlock Daycraft');
    if (success) {
      secureStorageAdapter.resetFailedAttempts();
      onUnlocked();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Daycraft App Lock"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
      style={{ backgroundColor: 'rgba(15, 14, 13, 0.88)' }}
    >
      <div
        className="w-full max-w-sm p-8 rounded-2xl border shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
          style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
        >
          <Lock className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold tracking-tight">Daycraft Locked</h2>
        <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--text-secondary)' }}>
          Enter your 4-digit security PIN to access your private offline records.
        </p>

        {lockoutSec > 0 ? (
          <div className="my-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Rate-limited. Wait {lockoutSec}s before retrying.</span>
          </div>
        ) : (
          <div className="flex gap-3 my-6 justify-center" aria-label="PIN digits entered">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="w-4 h-4 rounded-full border-2 transition-all duration-150"
                style={{
                  backgroundColor: pin.length > idx ? 'var(--accent)' : 'transparent',
                  borderColor: pin.length > idx ? 'var(--accent)' : 'var(--border)',
                }}
              />
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1 mb-4" role="alert">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </p>
        )}

        {/* Numeric keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleDigit(String(num))}
              disabled={lockoutSec > 0}
              aria-label={`Digit ${num}`}
              className="h-12 rounded-xl text-lg font-semibold transition-colors disabled:opacity-40"
              style={{
                backgroundColor: 'var(--bg-surface-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              {num}
            </button>
          ))}
          {hasBiometrics ? (
            <button
              onClick={handleBiometricAuth}
              disabled={lockoutSec > 0}
              aria-label="Unlock with biometrics"
              className="h-12 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent)',
              }}
            >
              <Fingerprint className="w-6 h-6" />
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={() => handleDigit('0')}
            disabled={lockoutSec > 0}
            aria-label="Digit 0"
            className="h-12 rounded-xl text-lg font-semibold transition-colors disabled:opacity-40"
            style={{
              backgroundColor: 'var(--bg-surface-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={lockoutSec > 0}
            aria-label="Backspace"
            className="h-12 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 flex items-center justify-center"
            style={{
              backgroundColor: 'var(--bg-surface-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            Del
          </button>
        </div>

        <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
          PINs are salted and hashed on-device. No accounts or remote cloud recovery exist.
        </p>
      </div>
    </div>
  );
};
