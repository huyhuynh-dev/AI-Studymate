"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { FAQS } from "../data/content";
import { cn } from "../ui/cn";
import { Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
        <SectionHeading title="Giải đáp nhanh." />

        <Reveal className="mt-12 divide-y divide-hairline border-y border-hairline">
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div key={faq.question}>
                <h3>
                  <button
                    type="button"
                    id={`faq-trigger-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex min-h-16 w-full items-center justify-between gap-6 py-5 text-left text-lg font-semibold tracking-tight transition-colors duration-350 ease-apple hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span>{faq.question}</span>
                    <Plus
                      aria-hidden="true"
                      className={cn(
                        "h-5 w-5 shrink-0 text-muted transition-transform duration-350 ease-apple",
                        isOpen && "rotate-45",
                      )}
                    />
                  </button>
                </h3>
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${i}`}
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-500 ease-apple",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="pb-6 pr-10 text-[17px] leading-relaxed text-muted">{faq.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
