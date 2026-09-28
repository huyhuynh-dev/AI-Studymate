import Link from "next/link";
import { ArrowLeft, BookOpenCheck, CircleHelp, Languages } from "lucide-react";

interface AuthHeaderProps {
  className?: string;
}

export default function AuthHeader({ className = "" }: AuthHeaderProps) {
  return (
    <header
      className={`flex w-full items-center justify-between bg-white/80 backdrop-blur-sm py-3 px-6 ${className}`.trim()}
    >
      {/* Left side: Back to Home + Logo */}
      <div className="flex items-center gap-4 sm:gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </Link>

        <Link href="/" className="flex items-center gap-2.5">
          <div className="rounded-xl bg-indigo-600 p-2 text-white shadow-xs">
            <BookOpenCheck className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-gray-900">AI StudyMate</span>
        </Link>
      </div>

      {/* Right side: Language switcher + Support link */}
      <div className="flex items-center gap-4 sm:gap-6">
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900 cursor-pointer"
        >
          <Languages size={16} />
          <span>EN</span>
        </button>

        <Link
          href="/support"
          className="flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900"
        >
          <CircleHelp size={16} />
          <span>Support</span>
        </Link>
      </div>
    </header>
  );
}

export { AuthHeader };
