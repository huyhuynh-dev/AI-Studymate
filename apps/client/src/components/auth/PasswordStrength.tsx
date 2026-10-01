'use client';

import React from 'react';

export interface PasswordStrengthProps {
  label?: string;
  value?: string;
  level?: 'empty' | 'weak' | 'medium' | 'strong';
}

export default function PasswordStrength({
  label = 'Độ an toàn:',
  value = 'Chưa nhập',
  level = 'empty',
}: PasswordStrengthProps) {
  const getColorClass = () => {
    switch (level) {
      case 'weak':
        return 'text-red-500 font-medium';
      case 'medium':
        return 'text-amber-500 font-medium';
      case 'strong':
        return 'text-emerald-500 font-medium';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="flex items-center justify-between mt-1.5 px-0.5">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <span className={`text-xs ${getColorClass()}`}>{value}</span>
    </div>
  );
}
