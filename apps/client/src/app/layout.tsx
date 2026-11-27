import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { fontSans, fontHeading, fontMono } from "./font";
import "./globals.css";
import OAuthCallbackHandler from "@/components/auth/OAuthCallbackHandler";
import { ThemePreferenceProvider } from "@/contexts/ThemePreferenceProvider";

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
      className={`${fontSans.variable} ${fontHeading.variable} ${fontMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('studymate:theme')||'system';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;r.classList.remove('light','dark');if(t==='dark'){r.classList.add('dark');r.style.colorScheme='dark';}else if(t==='light'){r.classList.add('light');r.style.colorScheme='light';}else if(d){r.classList.add('dark');r.style.colorScheme='dark';}}catch(e){}})();`,
          }}
        />
        <ThemePreferenceProvider>
          <Suspense fallback={null}>
            <OAuthCallbackHandler />
          </Suspense>
          {children}
        </ThemePreferenceProvider>
      </body>
    </html>
  );
}
