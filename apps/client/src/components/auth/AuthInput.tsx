'use client';

import React, { useState, useId } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface AuthInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  type?: string;
  placeholder?: string;
  icon: React.ReactNode; // The left icon element
  rightLabel?: React.ReactNode; // e.g. 'Quên mật khẩu?' link on the right of the label
  showPasswordToggle?: boolean; // If true, show an eye icon to toggle password visibility
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
  ...props
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const generatedId = useId();
  const inputId = id || generatedId;

  // Determine current input type based on showPasswordToggle state
  const inputType = showPasswordToggle
    ? showPassword
      ? 'text'
      : 'password'
    : type;

  // Render left icon with consistent sizing
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement<{ size?: number; className?: string }>(icon)) {
      return React.cloneElement(icon, {
        size: icon.props.size ?? 18,
        className: icon.props.className
          ? `${icon.props.className} shrink-0`
          : 'w-[18px] h-[18px] shrink-0',
      });
    }
    return icon;
  };

  return (
    <div className={`w-full ${containerClassName}`.trim()}>
      {/* Label Area */}
      <div className="flex justify-between items-center mb-2">
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-gray-700 select-none"
        >
          {label}
        </label>
        {rightLabel && (
          <div className="text-xs text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer">
            {rightLabel}
          </div>
        )}
      </div>

      {/* Input Container */}
      <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
        {/* Left Icon */}
        <span className="text-gray-400 mr-3 shrink-0 flex items-center justify-center [&>svg]:w-[18px] [&>svg]:h-[18px]">
          {renderIcon()}
        </span>

        {/* Input */}
        <input
          id={inputId}
          type={inputType}
          placeholder={placeholder}
          className={`flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400 ${className}`.trim()}
          {...props}
        />

        {/* Password Toggle Button */}
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="ml-2 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}

export default AuthInput;
