export type DocumentEditorMode =
  | 'markdown_wysiwyg'
  | 'html_wysiwyg'
  | 'plain_text'
  | 'structured_source'
  | 'unsupported';

export type DocumentEditorLanguage =
  | 'markdown'
  | 'html'
  | 'text'
  | 'json'
  | 'xml'
  | 'yaml'
  | 'csv'
  | 'toml'
  | 'unknown';

export interface DocumentEditorProfile {
  mode: DocumentEditorMode;
  language: DocumentEditorLanguage;
  label: string;
  shortBadge: string;
  supportsWysiwyg: boolean;
  supportsOutline: boolean;
  supportsSourceToggle: boolean;
  badgeToneClass: string;
}

export const EDITABLE_TEXT_EXTENSIONS_ACCEPT =
  '.md,.markdown,.html,.htm,.txt,.log,.json,.xml,.yaml,.yml,.csv,.toml';

const PROFILE_BY_EXTENSION: Record<string, DocumentEditorProfile> = {
  md: {
    mode: 'markdown_wysiwyg',
    language: 'markdown',
    label: 'Markdown (WYSIWYG)',
    shortBadge: 'MD',
    supportsWysiwyg: true,
    supportsOutline: true,
    supportsSourceToggle: true,
    badgeToneClass: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
  markdown: {
    mode: 'markdown_wysiwyg',
    language: 'markdown',
    label: 'Markdown (WYSIWYG)',
    shortBadge: 'MD',
    supportsWysiwyg: true,
    supportsOutline: true,
    supportsSourceToggle: true,
    badgeToneClass: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
  html: {
    mode: 'html_wysiwyg',
    language: 'html',
    label: 'HTML (WYSIWYG)',
    shortBadge: 'HTML',
    supportsWysiwyg: true,
    supportsOutline: true,
    supportsSourceToggle: true,
    badgeToneClass: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  htm: {
    mode: 'html_wysiwyg',
    language: 'html',
    label: 'HTML (WYSIWYG)',
    shortBadge: 'HTML',
    supportsWysiwyg: true,
    supportsOutline: true,
    supportsSourceToggle: true,
    badgeToneClass: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  txt: {
    mode: 'plain_text',
    language: 'text',
    label: 'Văn bản thuần',
    shortBadge: 'TXT',
    supportsWysiwyg: false,
    supportsOutline: false,
    supportsSourceToggle: false,
    badgeToneClass: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  },
  log: {
    mode: 'plain_text',
    language: 'text',
    label: 'Tệp nhật ký (LOG)',
    shortBadge: 'LOG',
    supportsWysiwyg: false,
    supportsOutline: false,
    supportsSourceToggle: false,
    badgeToneClass: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  },
  json: {
    mode: 'structured_source',
    language: 'json',
    label: 'JSON',
    shortBadge: 'JSON',
    supportsWysiwyg: false,
    supportsOutline: false,
    supportsSourceToggle: false,
    badgeToneClass: 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400',
  },
  xml: {
    mode: 'structured_source',
    language: 'xml',
    label: 'XML',
    shortBadge: 'XML',
    supportsWysiwyg: false,
    supportsOutline: false,
    supportsSourceToggle: false,
    badgeToneClass: 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400',
  },
  yaml: {
    mode: 'structured_source',
    language: 'yaml',
    label: 'YAML',
    shortBadge: 'YAML',
    supportsWysiwyg: false,
    supportsOutline: false,
    supportsSourceToggle: false,
    badgeToneClass: 'border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-400',
  },
  yml: {
    mode: 'structured_source',
    language: 'yaml',
    label: 'YAML',
    shortBadge: 'YML',
    supportsWysiwyg: false,
    supportsOutline: false,
    supportsSourceToggle: false,
    badgeToneClass: 'border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-400',
  },
  csv: {
    mode: 'structured_source',
    language: 'csv',
    label: 'CSV',
    shortBadge: 'CSV',
    supportsWysiwyg: false,
    supportsOutline: false,
    supportsSourceToggle: false,
    badgeToneClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  toml: {
    mode: 'structured_source',
    language: 'toml',
    label: 'TOML',
    shortBadge: 'TOML',
    supportsWysiwyg: false,
    supportsOutline: false,
    supportsSourceToggle: false,
    badgeToneClass: 'border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-400',
  },
};

const PROFILE_BY_MIME: Record<string, DocumentEditorProfile> = {
  'text/markdown': PROFILE_BY_EXTENSION.md,
  'text/x-markdown': PROFILE_BY_EXTENSION.md,
  'text/html': PROFILE_BY_EXTENSION.html,
  'text/plain': PROFILE_BY_EXTENSION.txt,
  'application/json': PROFILE_BY_EXTENSION.json,
  'text/json': PROFILE_BY_EXTENSION.json,
  'application/xml': PROFILE_BY_EXTENSION.xml,
  'text/xml': PROFILE_BY_EXTENSION.xml,
  'application/yaml': PROFILE_BY_EXTENSION.yaml,
  'application/x-yaml': PROFILE_BY_EXTENSION.yaml,
  'text/yaml': PROFILE_BY_EXTENSION.yaml,
  'text/x-yaml': PROFILE_BY_EXTENSION.yaml,
  'text/csv': PROFILE_BY_EXTENSION.csv,
  'application/csv': PROFILE_BY_EXTENSION.csv,
  'application/toml': PROFILE_BY_EXTENSION.toml,
  'text/toml': PROFILE_BY_EXTENSION.toml,
  'text/x-toml': PROFILE_BY_EXTENSION.toml,
};

const UNSUPPORTED_PROFILE: DocumentEditorProfile = {
  mode: 'unsupported',
  language: 'unknown',
  label: 'Không hỗ trợ',
  shortBadge: 'DOC',
  supportsWysiwyg: false,
  supportsOutline: false,
  supportsSourceToggle: false,
  badgeToneClass: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

function extractExtension(fileName?: string | null): string {
  if (!fileName) return '';
  const trimmed = fileName.trim();
  const dotIdx = trimmed.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === trimmed.length - 1) return '';
  return trimmed.slice(dotIdx + 1).toLowerCase();
}

/**
 * Xác định chiến lược hiển thị & soạn thảo phù hợp nhất cho tài liệu dựa trên đuôi tệp và MIME type.
 */
export function resolveDocumentEditorProfile(doc?: {
  file_name?: string | null;
  mime_type?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
} | null): DocumentEditorProfile {
  if (!doc) return UNSUPPORTED_PROFILE;

  const fileName = doc.file_name ?? doc.fileName ?? '';
  const rawMime = (doc.mime_type ?? doc.mimeType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  const ext = extractExtension(fileName);

  if (ext && PROFILE_BY_EXTENSION[ext]) {
    return PROFILE_BY_EXTENSION[ext];
  }

  if (rawMime && PROFILE_BY_MIME[rawMime]) {
    return PROFILE_BY_MIME[rawMime];
  }

  return UNSUPPORTED_PROFILE;
}

export function isEditableTextDocument(doc?: {
  file_name?: string | null;
  mime_type?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
} | null): boolean {
  return resolveDocumentEditorProfile(doc).mode !== 'unsupported';
}
