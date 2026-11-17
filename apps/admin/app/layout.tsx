import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI-StudyMate | Engineering & Operations Console",
  description:
    "Cổng Quản trị, Giám sát Hàng đợi BullMQ, Chi phí Token AI và Thực nghiệm Định lượng RAG cho AI-StudyMate.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#08080A] text-[#F5F5F7] selection:bg-[#0A84FF]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
