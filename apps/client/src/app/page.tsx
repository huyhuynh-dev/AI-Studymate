import type { Metadata } from "next";
import {
  FaqSection,
  FeaturesSection,
  FinalCtaSection,
  HeroSection,
  HowItWorksSection,
  LandingFooter,
  LandingHeader,
  PricingSection,
  StorySection,
  TestimonialsSection,
} from "@/components/landing";

export const metadata: Metadata = {
  title: "AI StudyMate – Học thông minh hơn với AI",
  description:
    "Tải tài liệu lên, AI StudyMate tự tạo flashcard, bản tóm tắt và đề ôn tập. Học hiệu quả hơn, miễn phí để bắt đầu.",
};

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        Bỏ qua điều hướng
      </a>
      <LandingHeader />
      <main id="main">
        <HeroSection />
        <StorySection />
        <HowItWorksSection />
        <FeaturesSection />
        <TestimonialsSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
