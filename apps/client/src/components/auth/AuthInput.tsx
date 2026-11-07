'use client';

import React, { useState, useId } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface AuthInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  type?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  rightLabel?: React.ReactNode;
  showPasswordToggle?: boolean;
  containerClassName?: string;
}

export function AuthInput({
  label,
  type = 'text',
  placeholder,
  icon,
  rightLabel,
  showPasswordToggle = false,
  id,
  className = '',
  containerClassName = '',
  disabled,
  ...props
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const generatedId = useId();
  const inputId = id || generatedId;

  const actualType = showPasswordToggle
    ? showPassword
      ? 'text'
      : 'password'
    : type;

  // Render left icon with consistent optical sizing & stroke weight
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement<{ size?: number; className?: string; strokeWidth?: number }>(icon)) {
      return React.cloneElement(icon, {
        size: icon.props.size ?? 16,
        strokeWidth: icon.props.strokeWidth ?? 1.8,
        className: icon.props.className
          ? `${icon.props.className} shrink-0`
          : 'w-4 h-4 shrink-0',
      });
    }
    return icon;
  };

  return (
    <div className={`w-full space-y-1.5 ${containerClassName}`.trim()}>
      {/* Label Row */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={inputId}
          className="text-[13px] font-medium text-gray-700 dark:text-gray-300 select-none cursor-pointer"
        >
          {label}
        </label>
        {rightLabel}
      </div>

      {/* Input Vessel with Specular Hairline */}
      <div className="group relative flex items-center h-11 px-3.5 rounded-xl bg-gray-50/70 dark:bg-white/[0.04] border border-gray-200/90 dark:border-white/10 focus-within:border-indigo-500 dark:focus-within:border-indigo-400 focus-within:bg-white dark:focus-within:bg-[#12151c] focus-within:ring-3 focus-within:ring-indigo-500/15 apple-spring">
        {/* Left Icon with Optical Stroke Weight */}
        {icon && (
          <span className="text-gray-400 dark:text-gray-500 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors mr-2.5 shrink-0 flex items-center justify-center">
            {renderIcon()}
          </span>
        )}

        {/* Input Control */}
        <input
          id={inputId}
          type={actualType}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full bg-transparent outline-none text-[14px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 font-normal disabled:opacity-50 disabled:cursor-not-allowed ${className}`.trim()}
          {...props}
        />

        {/* Password Eye Toggle */}
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={disabled}
            className="ml-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md transition-colors focus-visible:outline-none active:scale-90 cursor-pointer"
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" strokeWidth={1.75} />
            ) : (
              <Eye className="w-4 h-4" strokeWidth={1.75} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default AuthInput;
