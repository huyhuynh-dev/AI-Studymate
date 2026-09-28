interface AuthDividerProps {
  text: string;
}

export function AuthDivider({ text }: AuthDividerProps) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400 whitespace-nowrap font-medium uppercase tracking-wide">
        {text}
      </span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

export default AuthDivider;
