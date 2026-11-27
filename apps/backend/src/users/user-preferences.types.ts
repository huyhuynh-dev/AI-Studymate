export type UserThemePreference = 'system' | 'light' | 'dark';
export type AiResponseLanguagePreference = 'auto' | 'vi' | 'en';

export interface UserPreferences {
  theme: UserThemePreference;
  aiResponseLanguage: AiResponseLanguagePreference;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'system',
  aiResponseLanguage: 'auto',
};

export function normalizeUserPreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_USER_PREFERENCES };
  }

  const record = raw as Record<string, unknown>;
  const theme: UserThemePreference =
    record.theme === 'light' ||
    record.theme === 'dark' ||
    record.theme === 'system'
      ? record.theme
      : DEFAULT_USER_PREFERENCES.theme;

  const aiResponseLanguage: AiResponseLanguagePreference =
    record.aiResponseLanguage === 'vi' ||
    record.aiResponseLanguage === 'en' ||
    record.aiResponseLanguage === 'auto'
      ? record.aiResponseLanguage
      : DEFAULT_USER_PREFERENCES.aiResponseLanguage;

  return {
    theme,
    aiResponseLanguage,
  };
}
