'use client';

import React from 'react';

export interface AuthCheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
}

export default function AuthCheckbox({
  label,
  className = '',
  ...props
}: AuthCheckboxProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group mt-1">
      <input
        type="checkbox"
        className={`mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer ${className}`.trim()}
        {...props}
      />
      <span className="text-sm text-gray-600 leading-relaxed select-none">
        {label}
      </span>
    </label>
  );
}
