import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import OAuthCallbackHandler from "@/components/auth/OAuthCallbackHandler";

const beVietnamPro = Be_Vietnam_Pro({
  weight: ["300", "400", "500", "600", "700", "800"],
  subsets: ["vietnamese", "latin"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI StudyMate - Nền tảng học tập thông minh",
  description: "Tối ưu quá trình học tập với sức mạnh AI",
};

export const viewport: Viewport = {
  // Scrollbar, input và các control gốc theo đúng Light/Dark của hệ thống
  colorScheme: "light dark",
  // Cho phép env(safe-area-inset-*) có giá trị trên iPhone (tai thỏ, home indicator)
  viewportFit: "cover",
  // Màu thanh trạng thái của trình duyệt di động, khớp với --background
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9ff" },
    { media: "(prefers-color-scheme: dark)", color: "#090b10" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <Suspense fallback={null}>
          <OAuthCallbackHandler />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
