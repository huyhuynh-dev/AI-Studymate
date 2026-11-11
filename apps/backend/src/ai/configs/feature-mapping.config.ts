import type { ModelProfile } from '../ai-model.factory.js';
import type { FeatureKey } from '../prompts/types.js';

export interface FeatureRuntimeConfig {
  profile: ModelProfile;
  temperature?: number;
  maxRetries?: number;
  providerOptions?: Record<string, Record<string, unknown>>;
}

export const FEATURE_MAP: Record<FeatureKey, FeatureRuntimeConfig> = {
  SUMMARIZE_GENERATE: {
    profile: 'STANDARD',
    temperature: 0.2,
    providerOptions: {
      google: { responseMimeType: 'application/json' },
    },
  },
  SUMMARIZE_REFINE: {
    profile: 'STANDARD',
    temperature: 0.2,
  },
  QUIZ_GENERATE: {
    profile: 'STANDARD',
    temperature: 0.4,
    maxRetries: 2,
  },
  ESSAY_GRADE: {
    profile: 'STANDARD',
    temperature: 0.2,
  },
  FLASHCARD_GENERATE: {
    profile: 'STANDARD',
    maxRetries: 2,
  },
  BLOCKNOTE_EDIT: {
    profile: 'STANDARD',
  },
  CHAT_AGENT: {
    profile: 'REASONING',
    temperature: 0.5,
  },
  AUTO_HEADER: {
    profile: 'FAST',
    temperature: 0.1,
    providerOptions: {
      ollama: { think: false },
    },
  },
  FOLLOW_UP_SUGGESTIONS: {
    profile: 'REASONING',
  },
  VISION_OCR: {
    profile: 'VISION',
    temperature: 0.1,
    maxRetries: 2,
  },
};
