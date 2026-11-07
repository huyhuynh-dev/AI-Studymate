import { STORY } from "../data/content";
import { Reveal } from "../ui/Reveal";
import { ScrollWords } from "../ui/ScrollWords";

/** Chương mở đầu của câu chuyện: vấn đề người học gặp phải. Từng từ sáng dần khi cuộn. */
export function StorySection() {
  return (
    <section id="story" className="scroll-mt-24 py-24 md:py-40">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        <Reveal variant="fade">
          <p className="mb-8 text-base font-semibold text-primary">{STORY.eyebrow}</p>
        </Reveal>
        <ScrollWords
          text={STORY.text}
          className="text-pretty text-[clamp(1.75rem,4.2vw,3.5rem)] font-semibold leading-[1.18] tracking-[-0.025em]"
        />
        <Reveal className="mt-10">
          <p className="text-xl font-semibold tracking-tight text-muted sm:text-2xl">{STORY.closing}</p>
        </Reveal>
      </div>
    </section>
  );
}
