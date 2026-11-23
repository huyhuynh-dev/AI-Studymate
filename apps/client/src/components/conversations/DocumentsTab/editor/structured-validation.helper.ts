import type { DocumentEditorLanguage } from './document-format-profiles';

export function validateStructuredContent(
  language: DocumentEditorLanguage,
  value: string,
): string | null {
  if (language !== 'json') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Tệp JSON đang rỗng.';
  }
  try {
    JSON.parse(trimmed);
    return null;
  } catch (err: unknown) {
    return err instanceof Error ? err.message : 'Cú pháp JSON không hợp lệ.';
  }
}
