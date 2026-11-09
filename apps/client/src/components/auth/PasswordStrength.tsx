'use client';

import React from 'react';

export interface PasswordStrengthProps {
  label?: string;
  value?: string;
  level?: 'empty' | 'weak' | 'medium' | 'strong';
  className?: string;
}

export default function PasswordStrength({
  label = 'Độ an toàn:',
  value = 'Chưa nhập',
  level = 'empty',
  className = '',
}: PasswordStrengthProps) {
  // Determine segment count (0 to 3)
  const getActiveSegments = () => {
    switch (level) {
      case 'weak':
        return 1;
      case 'medium':
        return 2;
      case 'strong':
        return 3;
      default:
        return 0;
    }
  };

  const getSegmentColor = () => {
    switch (level) {
      case 'weak':
        return 'bg-red-500';
      case 'medium':
        return 'bg-amber-500';
      case 'strong':
        return 'bg-emerald-500';
      default:
        return 'bg-gray-200 dark:bg-white/10';
    }
  };

  const getTextColor = () => {
    switch (level) {
      case 'weak':
        return 'text-red-600 dark:text-red-400 font-medium';
      case 'medium':
        return 'text-amber-600 dark:text-amber-400 font-medium';
      case 'strong':
        return 'text-emerald-600 dark:text-emerald-400 font-medium';
      default:
        return 'text-gray-400 dark:text-gray-500';
    }
  };

  const activeSegments = getActiveSegments();

  return (
    <div className={`mt-2 space-y-1.5 select-none ${className}`.trim()}>
      {/* 3-segment Apple-style progress indicator */}
      <div className="flex items-center gap-1.5 h-1">
        {[0, 1, 2].map((index) => {
          const isActive = index < activeSegments;
          return (
            <div
              key={index}
              className={`h-full flex-1 rounded-full transition-all duration-300 ease-out ${
                isActive
                  ? getSegmentColor()
                  : 'bg-gray-200/80 dark:bg-white/10'
              }`}
            />
          );
        })}
      </div>

      {/* Label & Dynamic Value */}
      <div className="flex items-center justify-between text-[11px] leading-none px-0.5">
        <span className="text-gray-500 dark:text-gray-400 font-normal">
          {label}
        </span>
        <span className={`font-heading tracking-tight ${getTextColor()}`}>{value}</span>
      </div>
    </div>
  );
}
