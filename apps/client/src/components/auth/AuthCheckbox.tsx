'use client';

import React, { useId } from 'react';
import { Check } from 'lucide-react';

export interface AuthCheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
}

export function AuthCheckbox({
  label,
  id,
  className = '',
  checked,
  disabled,
  ...props
}: AuthCheckboxProps) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex items-center gap-2.5 cursor-pointer select-none group ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      } ${className}`.trim()}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className="sr-only"
        {...props}
      />
      {/* Squircle Checkbox Box */}
      <span
        aria-hidden="true"
        className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center apple-spring border shrink-0 ${
          checked
            ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs shadow-indigo-600/30'
            : 'border-gray-300 dark:border-white/20 bg-gray-50 dark:bg-white/5 group-hover:border-gray-400 dark:group-hover:border-white/35'
        } group-active:scale-90`}
      >
        {checked && <Check className="w-3 h-3 text-white" strokeWidth={2.75} />}
      </span>
      <span className="text-[13px] text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
        {label}
      </span>
    </label>
  );
}

export default AuthCheckbox;
