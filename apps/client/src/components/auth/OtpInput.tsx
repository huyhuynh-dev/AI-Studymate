'use client';

import React, { useRef, useCallback, useEffect } from 'react';

export interface OtpInputProps {
  /** Number of OTP digits */
  length?: number;
  /** Current OTP value array */
  value: string[];
  /** Called when any digit changes */
  onChange: (value: string[]) => void;
  /** Disable all inputs */
  disabled?: boolean;
  className?: string;
}

export default function OtpInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  className = '',
}: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus the first empty input on mount
  useEffect(() => {
    const firstEmpty = value.findIndex((v) => !v);
    const idx = firstEmpty === -1 ? 0 : firstEmpty;
    inputsRef.current[idx]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusInput = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, length - 1));
      inputsRef.current[clamped]?.focus();
      inputsRef.current[clamped]?.select();
    },
    [length]
  );

  const handleChange = useCallback(
    (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const char = e.target.value;
      // Only accept single digit
      if (char && !/^\d$/.test(char)) return;

      const next = [...value];
      next[index] = char;
      onChange(next);

      // Auto-advance to next input
      if (char && index < length - 1) {
        focusInput(index + 1);
      }
    },
    [value, onChange, length, focusInput]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        const next = [...value];
        if (value[index]) {
          // Clear current digit
          next[index] = '';
          onChange(next);
        } else if (index > 0) {
          // Move back and clear previous
          next[index - 1] = '';
          onChange(next);
          focusInput(index - 1);
        }
      } else if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault();
        focusInput(index - 1);
      } else if (e.key === 'ArrowRight' && index < length - 1) {
        e.preventDefault();
        focusInput(index + 1);
      }
    },
    [value, onChange, length, focusInput]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData
        .getData('text')
        .replace(/\D/g, '')
        .slice(0, length);
      if (!pasted) return;

      const next = [...value];
      for (let i = 0; i < pasted.length; i++) {
        next[i] = pasted[i];
      }
      onChange(next);

      // Focus the input after last pasted digit
      const focusIdx = Math.min(pasted.length, length - 1);
      focusInput(focusIdx);
    },
    [value, onChange, length, focusInput]
  );

  return (
    <div
      className={`flex items-center justify-center gap-2 sm:gap-2.5 ${className}`.trim()}
    >
      {Array.from({ length }).map((_, i) => {
        const isFilled = Boolean(value[i]);
        return (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={value[i] || ''}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            className={`
              w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-semibold tabular-nums
              rounded-xl border outline-none apple-spring
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                isFilled
                  ? 'border-indigo-500/80 dark:border-indigo-400 bg-white dark:bg-[#12151c] text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'border-gray-200/90 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.04] text-gray-900 dark:text-white'
              }
              focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-[#12151c] focus:ring-3 focus:ring-indigo-500/15
            `}
          />
        );
      })}
    </div>
  );
}
