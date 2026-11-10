import React from 'react';
import Link from 'next/link';

export interface AuthSwitchLinkProps {
  text: string;
  linkText: string;
  href: string;
  className?: string;
}

export function AuthSwitchLink({
  text,
  linkText,
  href,
  className = '',
}: AuthSwitchLinkProps) {
  return (
    <p
      className={`text-center mt-6 text-[13px] text-gray-500 dark:text-gray-400 select-none ${className}`.trim()}
    >
      {text}
      <Link
        href={href}
        className="text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-700 dark:hover:text-indigo-300 ml-1.5 transition-colors hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-xs"
      >
        {linkText}
      </Link>
    </p>
  );
}

export default AuthSwitchLink;
