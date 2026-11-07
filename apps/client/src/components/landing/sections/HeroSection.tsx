import { ChevronRight } from "lucide-react";
import { HERO, ROUTES } from "../data/content";
import { ButtonLink } from "../ui/ButtonLink";
import { Reveal } from "../ui/Reveal";
import { HeroShowcase } from "./HeroShowcase";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-24 pt-32 sm:pt-40 md:pb-32">
      <div className="landing-glow pointer-events-none absolute inset-x-0 top-0 h-[720px]" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal delay={0}>
            <h1 className="text-balance text-[clamp(2.5rem,7.5vw,5.5rem)] font-bold leading-[1.04] tracking-[-0.035em]">
              {HERO.title}
              <br />
              <span className="text-muted">{HERO.titleMuted}</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted sm:text-xl">
              {HERO.description}
            </p>
          </Reveal>

          <Reveal delay={240} className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <ButtonLink href={ROUTES.register} size="lg" className="w-full sm:w-auto">
              {HERO.primaryCta}
            </ButtonLink>
            <ButtonLink href="#how-it-works" variant="tertiary" size="lg" className="w-full text-primary hover:text-primary sm:w-auto">
              {HERO.secondaryCta}
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </ButtonLink>
          </Reveal>

          <Reveal delay={320} variant="fade">
            <p className="mt-5 text-sm text-muted">{HERO.note}</p>
          </Reveal>
        </div>

        <HeroShowcase />
      </div>
    </section>
  );
}
