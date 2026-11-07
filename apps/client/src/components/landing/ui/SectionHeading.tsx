import { cn } from "./cn";
import { Reveal } from "./Reveal";

interface SectionHeadingProps {
  title: string;
  description?: string;
  align?: "center" | "left";
  className?: string;
}

export function SectionHeading({
  title,
  description,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <Reveal
      className={cn(
        "max-w-3xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className,
      )}
    >
      <h2 className="text-balance text-[clamp(2rem,4.6vw,3.5rem)] font-bold leading-[1.08] tracking-[-0.03em]">
        {title}
      </h2>
      {description && (
        <p className="mt-5 text-pretty text-lg leading-relaxed text-muted sm:text-xl">
          {description}
        </p>
      )}
    </Reveal>
  );
}
