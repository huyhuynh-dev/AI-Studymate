import { Check } from "lucide-react";
import { PRICING_PLANS } from "../data/content";
import { ButtonLink } from "../ui/ButtonLink";
import { cn } from "../ui/cn";
import { Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading
          title="Bắt đầu miễn phí. Nâng cấp khi cần."
          description="Không ràng buộc, hủy bất cứ lúc nào."
        />

        <div className="mt-16 grid gap-4 lg:grid-cols-3">
          {PRICING_PLANS.map((plan, i) => {
            const hasPrice = plan.price !== "Liên hệ";
            return (
              <Reveal
                key={plan.name}
                as="article"
                delay={i * 100}
                className={cn(
                  "relative flex flex-col rounded-[32px] border bg-card p-8",
                  plan.highlighted
                    ? "border-primary ring-1 ring-primary"
                    : "border-hairline",
                )}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3.5 left-8 rounded-full bg-primary px-3.5 py-1 text-xs font-semibold text-white">
                    Phổ biến nhất
                  </span>
                )}

                <h3 className="text-xl font-bold tracking-tight">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted">{plan.description}</p>

                <p className="mt-8 flex items-baseline gap-1">
                  <span className="font-heading text-5xl font-bold tabular-nums tracking-[-0.03em]">
                    {plan.price}
                    {hasPrice && "đ"}
                  </span>
                  {plan.period && <span className="text-muted">/{plan.period}</span>}
                </p>

                <ul className="mt-8 flex-1 space-y-3.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-[15px] leading-snug">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-secondary" strokeWidth={2.5} aria-hidden="true" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <ButtonLink
                  href={plan.href}
                  variant={plan.highlighted ? "primary" : "secondary"}
                  size="md"
                  className="mt-10 w-full"
                >
                  {plan.cta}
                </ButtonLink>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
