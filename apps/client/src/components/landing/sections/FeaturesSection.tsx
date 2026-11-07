import type { ReactNode } from "react";
import { FEATURES_HEADING } from "../data/content";
import { cn } from "../ui/cn";
import { Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";
import {
  AnalyticsVisual,
  FlashcardsVisual,
  QuizVisual,
  RetentionVisual,
  SecurityVisual,
  SummaryVisual,
} from "../visuals/BentoVisuals";

interface BentoCardProps {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  delay?: number;
  large?: boolean;
}

/** Thẻ Bento: khung ngoài 32px, padding 8px → vùng minh họa bên trong bo 24px (đồng tâm). */
function BentoCard({ title, description, children, className, delay, large }: BentoCardProps) {
  return (
    <Reveal
      as="article"
      delay={delay}
      className={cn(
        "flex flex-col rounded-[32px] border border-hairline bg-card p-2",
        className,
      )}
    >
      <div className="px-4 pb-5 pt-4 sm:px-5 sm:pt-5">
        <h3
          className={cn(
            "text-balance font-bold tracking-[-0.02em]",
            large ? "text-2xl sm:text-3xl" : "text-xl",
          )}
        >
          {title}
        </h3>
        <p className="mt-2 max-w-md text-pretty leading-relaxed text-muted">{description}</p>
      </div>
      <div className="relative min-h-40 flex-1 overflow-hidden rounded-3xl bg-well">{children}</div>
    </Reveal>
  );
}

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading title={FEATURES_HEADING.title} description={FEATURES_HEADING.description} />

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:auto-rows-[minmax(280px,auto)] lg:grid-cols-4">
          {/* Thẻ tâm điểm */}
          <BentoCard
            large
            title="Flashcard tự động từ mọi tài liệu"
            description="Tải bài giảng lên, nhận ngay bộ flashcard đã chia sẵn câu hỏi và đáp án."
            className="md:col-span-2 lg:row-span-2"
          >
            <FlashcardsVisual />
          </BentoCard>

          <BentoCard
            title="Tóm tắt gọn"
            description="Bài giảng dài thành vài ý chính."
            delay={80}
          >
            <SummaryVisual />
          </BentoCard>

          <BentoCard
            title="Đề ôn tập thông minh"
            description="Trắc nghiệm và tự luận từ nội dung bạn đã học."
            delay={160}
          >
            <QuizVisual />
          </BentoCard>

          <BentoCard
            title="Ôn đúng lúc, nhớ lâu hơn"
            description="Thuật toán lặp lại ngắt quãng nhắc bạn ôn trước khi kịp quên."
            className="md:col-span-2"
            delay={80}
          >
            <RetentionVisual />
          </BentoCard>

          <BentoCard
            title="Thấy rõ mình đang tiến bộ"
            description="Biểu đồ trực quan cho thấy điểm mạnh, điểm yếu và tiến độ của bạn."
            className="md:col-span-2"
          >
            <AnalyticsVisual />
          </BentoCard>

          <BentoCard
            title="Dữ liệu của bạn, do bạn kiểm soát"
            description="Bảo mật ở mọi bước, từ lúc tải lên đến khi lưu trữ."
            className="md:col-span-2"
            delay={80}
          >
            <SecurityVisual />
          </BentoCard>
        </div>
      </div>
    </section>
  );
}
