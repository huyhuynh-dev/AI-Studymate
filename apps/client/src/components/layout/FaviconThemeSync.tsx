"use client";

import { useEffect } from "react";

const faviconPath = "/icon.svg";

export default function FaviconThemeSync() {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const favicon = document.querySelector<HTMLLinkElement>(
      'link[rel~="icon"]',
    );

    if (!favicon) {
      return;
    }

    const updateFavicon = (isDark: boolean) => {
      const theme = isDark ? "dark" : "light";
      favicon.href = `${faviconPath}?theme=${theme}`;
    };

    updateFavicon(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleThemeChange);

    function handleThemeChange(event: MediaQueryListEvent) {
      updateFavicon(event.matches);
    }

    return () => {
      mediaQuery.removeEventListener("change", handleThemeChange);
    };
  }, []);

  return null;
}
