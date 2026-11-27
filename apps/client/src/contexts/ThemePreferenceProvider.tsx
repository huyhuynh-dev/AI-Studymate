"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { UserThemePreference } from "@/types/user";

const THEME_STORAGE_KEY = "studymate:theme";

interface ThemePreferenceContextValue {
  theme: UserThemePreference;
  resolvedTheme: "light" | "dark";
  setTheme: (
    next: UserThemePreference,
    options?: { persistLocal?: boolean }
  ) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
});

function readStoredTheme(): UserThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") {
      return raw;
    }
  } catch {
    // ignore storage errors
  }
  return "system";
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemeToDom(theme: UserThemePreference): "light" | "dark" {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.add("light");
    } else if (resolved === "dark") {
      root.classList.add("dark");
    }
    root.style.colorScheme = resolved;
  }
  return resolved;
}

export function ThemePreferenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<UserThemePreference>(() =>
    readStoredTheme()
  );
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() =>
    getSystemTheme()
  );

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme, systemTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        setThemeState(readStoredTheme());
      }
    };
    mediaQuery.addEventListener("change", onMediaChange);
    window.addEventListener("storage", onStorage);
    return () => {
      mediaQuery.removeEventListener("change", onMediaChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setTheme = useCallback(
    (
      next: UserThemePreference,
      options?: { persistLocal?: boolean }
    ) => {
      setThemeState(next);
      if (options?.persistLocal !== false && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // ignore
        }
      }
      applyThemeToDom(next);
    },
    []
  );

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? systemTheme : theme;

  const value = useMemo<ThemePreferenceContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  return useContext(ThemePreferenceContext);
}
