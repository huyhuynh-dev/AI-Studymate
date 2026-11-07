import { FINAL_CTA, ROUTES } from "../data/content";
import { ButtonLink } from "../ui/ButtonLink";
import { Reveal } from "../ui/Reveal";

export function FinalCtaSection() {
  return (
    <section className="px-5 pb-24 sm:px-8 md:pb-32">
      <Reveal
        variant="scale"
        className="landing-glow relative mx-auto max-w-7xl overflow-hidden rounded-[40px] border border-hairline bg-card px-6 py-20 text-center sm:px-16 sm:py-28"
      >
        <h2 className="mx-auto max-w-3xl text-balance text-[clamp(2rem,5vw,4rem)] font-bold leading-[1.06] tracking-[-0.035em]">
          {FINAL_CTA.title}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted sm:text-xl">{FINAL_CTA.description}</p>
        <ButtonLink href={ROUTES.register} size="lg" className="mt-10">
          {FINAL_CTA.cta}
        </ButtonLink>
      </Reveal>
    </section>
  );
}
