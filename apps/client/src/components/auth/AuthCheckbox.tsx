'use client';

interface AuthCheckboxProps {
  label: React.ReactNode;
  defaultChecked?: boolean;
}

export default function AuthCheckbox({ label, defaultChecked = false }: AuthCheckboxProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group mt-1">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
      />
      <span className="text-sm text-gray-600 leading-relaxed select-none">
        {label}
      </span>
    </label>
  );
}
