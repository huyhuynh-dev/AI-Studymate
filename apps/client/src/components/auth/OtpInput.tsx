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
}

export default function OtpInput({
  length = 6,
  value,
  onChange,
  disabled = false,
}: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus the first empty input on mount
  useEffect(() => {
    const firstEmpty = value.findIndex((v) => !v);
    const idx = firstEmpty === -1 ? 0 : firstEmpty;
    inputsRef.current[idx]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusInput = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, length - 1));
    inputsRef.current[clamped]?.focus();
    inputsRef.current[clamped]?.select();
  }, [length]);

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
          // Clear current and stay
          next[index] = '';
          onChange(next);
        } else if (index > 0) {
          // Move back and clear
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
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
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
    <div className="flex items-center justify-center gap-2.5">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
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
            w-12 h-14 text-center text-2xl font-bold rounded-xl border-2
            bg-gray-50 text-gray-900
            focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100
            transition-all
            disabled:opacity-50 disabled:cursor-not-allowed
            ${value[i] ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200'}
          `}
        />
      ))}
    </div>
  );
}
