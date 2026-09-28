'use client';

interface PasswordStrengthProps {
  label?: string;
  value?: string;
}

export default function PasswordStrength({ label = 'Độ an toàn:', value = 'Chưa nhập' }: PasswordStrengthProps) {
  return (
    <div className="flex items-center justify-between mt-1.5">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <span className="text-xs text-gray-400">{value}</span>
    </div>
  );
}
