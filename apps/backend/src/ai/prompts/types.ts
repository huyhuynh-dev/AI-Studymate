import type { AvailableDocumentItem } from '../../documents/services/retrieval.service.js';
import type {
  BudgetDoc,
  GenerateFlashcardsRequest,
} from '../schemas/flashcard-ai.schema.js';
import type { AIQuestionType } from '../schemas/quiz-ai.schema.js';

export type QuizDifficulty = 'basic' | 'applied' | 'advanced';

export interface PromptPayloadMap {
  SUMMARIZE_GENERATE: {
    contextText: string;
    mode: 'key_takeaways' | 'study_guide' | 'qa_style';
    length: 'short' | 'standard' | 'detailed';
    scope: 'conversation' | 'document' | 'section';
    sectionInfo?: string;
    customInstruction?: string;
  };
  SUMMARIZE_REFINE: {
    currentBlocksJson: string;
    instruction: string;
  };
  QUIZ_GENERATE: {
    context: string;
    types: AIQuestionType[];
    count: number;
    difficulty: QuizDifficulty;
  };
  ESSAY_GRADE: {
    questionPlain: string;
    points: number;
    samplePlain?: string | null;
    criteria: string[];
    plainAnswer: string;
  };
  FLASHCARD_GENERATE: {
    req: GenerateFlashcardsRequest;
    docs: Array<BudgetDoc & { truncated: boolean }>;
    existingFronts: string[];
    deckName?: string;
  };
  CHAT_AGENT: {
    baseSystemPrompt?: string;
    availableDocuments?: AvailableDocumentItem[];
    attachedDocumentIds?: string[];
  };
  AUTO_HEADER: {
    firstMessageSnippet: string;
  };
  FOLLOW_UP_SUGGESTIONS: {
    lastAssistantResponse: string;
    lastUserQuestion?: string;
  };
  BLOCKNOTE_EDIT: {
    baseHtmlSystemPrompt: string;
  };
  VISION_OCR: {
    fileName?: string;
  };
}

export type FeatureKey = keyof PromptPayloadMap;

export interface RenderedPrompt {
  system: string;
  prompt: string;
}

export interface PromptTemplate<TVariables> {
  system?: string | ((vars: TVariables) => string);
  renderUser?: (vars: TVariables) => string;
}
