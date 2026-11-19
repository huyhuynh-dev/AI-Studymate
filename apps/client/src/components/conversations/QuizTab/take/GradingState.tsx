import { StudyMateAiIcon } from "@/components/ui/StudyMateAiIcon";

export function GradingState() {
  return (
    <div role="status" aria-live="polite" className="qz-anim-pop mx-auto flex min-h-[60dvh] max-w-[460px] flex-col items-center justify-center px-4 text-center">
      <div className="relative">
        <span className="qz-shimmer absolute -inset-5 rounded-full" aria-hidden />
        <StudyMateAiIcon
          variant="full"
          className="qz-anim-breathe relative h-16 w-16"
        />
      </div>
      <h2 className="mt-8 text-[22px] font-semibold leading-8 tracking-[-0.02em]">AI đang chấm phần tự luận của bạn</h2>
      <p className="mt-2 text-[15px] leading-6 text-[var(--on-surface-variant)]">
        Các câu trắc nghiệm đã được chấm xong. Hệ thống đang đối chiếu bài viết với các ý chính của đáp án mẫu.
      </p>
    </div>
  );
}
