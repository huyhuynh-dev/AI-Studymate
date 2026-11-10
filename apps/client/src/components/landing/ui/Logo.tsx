import Image from "next/image";

export function LogoMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/logo.svg"
      alt="AI StudyMate Logo"
      width={size}
      height={size}
      priority
      className={`shrink-0 ${className}`.trim()}
    />
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`.trim()}>
      <LogoMark />
      <span className="font-heading text-[17px] font-semibold tracking-tight">
        AI <span className="text-primary">StudyMate</span>
      </span>
    </span>
  );
}
