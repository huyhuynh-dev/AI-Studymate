"use client";

import Image from "next/image";
import { BookCheck, Sparkles } from "lucide-react";
import { useScrollProgress } from "../hooks/useScrollProgress";

/**
 * Khung ảnh ứng dụng: nghiêng nhẹ khi mới xuất hiện và "đứng thẳng" dần theo cuộn.
 * Bán kính lồng nhau: khung ngoài 32px − padding 8px = ảnh bên trong 24px.
 */
export function HeroShowcase() {
  const ref = useScrollProgress<HTMLDivElement>({ start: 1, end: 0.35 });

  return (
    <div ref={ref} className="hero-frame relative mx-auto mt-16 max-w-5xl sm:mt-20">
      <div className="rounded-[32px] border border-hairline bg-card p-2 shadow-[0_24px_64px_-24px_rgba(11,28,48,0.25)] dark:shadow-none">
        <Image
          src="/review_app_img.jpg"
          alt="Giao diện AI StudyMate với flashcard, tóm tắt và tiến độ học tập"
          width={1200}
          height={675}
          priority
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="aspect-video w-full rounded-3xl object-cover object-top"
        />
      </div>

      <div
        className="apple-liquid-glass landing-float absolute -bottom-6 left-4 hidden items-center gap-3 rounded-2xl p-3 pr-5 sm:flex lg:-left-8"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/15 text-secondary">
          <BookCheck className="h-5 w-5" />
        </span>
        <span className="text-sm font-semibold">Flashcard đã sẵn sàng</span>
      </div>
      <div
        className="apple-liquid-glass landing-float absolute -bottom-6 right-4 hidden items-center gap-3 rounded-2xl p-3 pr-5 [animation-delay:-3s] sm:flex lg:-right-8"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <span className="text-sm font-semibold">Tóm tắt hoàn tất</span>
      </div>
    </div>
  );
}
