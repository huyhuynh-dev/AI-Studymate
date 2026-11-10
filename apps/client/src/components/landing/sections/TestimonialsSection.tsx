import { TESTIMONIALS } from "../data/content";
import { Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading title="Người học nói gì." />

        <ul className="mt-16 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal as="li" key={t.name} delay={i * 100} className="flex">
              <figure className="flex w-full flex-col justify-between rounded-[32px] border border-hairline bg-card p-8">
                <blockquote className="text-pretty text-lg font-medium leading-relaxed tracking-tight">
                  “{t.content}”
                </blockquote>
                <figcaption className="mt-8 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
                  >
                    {t.name.split(" ").pop()?.charAt(0)}
                  </span>
                  <span>
                    <span className="font-heading block text-sm font-semibold">{t.name}</span>
                    <span className="block text-sm text-muted">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
