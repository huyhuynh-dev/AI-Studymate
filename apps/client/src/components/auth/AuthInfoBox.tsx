import React from 'react';

export interface AuthInfoBoxProps {
  icon: React.ReactNode;
  text: string;
  variant?: 'bordered' | 'plain'; // 'bordered' has border/bg, 'plain' is just text
}

export function AuthInfoBox({
  icon,
  text,
  variant = 'bordered',
}: AuthInfoBoxProps) {
  if (variant === 'plain') {
    return (
      <div className="mt-4 text-center text-sm text-gray-500">
        <span className="inline-flex items-center justify-center gap-1.5">
          <span className="flex-shrink-0">{icon}</span>
          <span>{text}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="mt-5 flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <p className="text-xs text-gray-500 leading-relaxed">{text}</p>
    </div>
  );
}

export default AuthInfoBox;
