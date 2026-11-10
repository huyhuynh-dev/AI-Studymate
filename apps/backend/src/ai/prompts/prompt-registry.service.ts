import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  FeatureKey,
  PromptPayloadMap,
  PromptTemplate,
  RenderedPrompt,
} from './types.js';
import {
  summarizeGeneratePrompt,
  summarizeRefinePrompt,
} from './templates/summarize.prompt.js';
import {
  essayGradePrompt,
  quizGeneratePrompt,
} from './templates/quiz.prompt.js';
import { flashcardGeneratePrompt } from './templates/flashcard.prompt.js';
import {
  autoHeaderPrompt,
  chatAgentPrompt,
  followUpSuggestionsPrompt,
} from './templates/chat-agent.prompt.js';
import { blocknoteEditPrompt } from './templates/blocknote.prompt.js';
import { visionOcrPrompt } from './templates/vision-ocr.prompt.js';

@Injectable()
export class PromptRegistryService {
  private readonly templates: {
    [K in FeatureKey]: PromptTemplate<PromptPayloadMap[K]>;
  } = {
    SUMMARIZE_GENERATE: summarizeGeneratePrompt,
    SUMMARIZE_REFINE: summarizeRefinePrompt,
    QUIZ_GENERATE: quizGeneratePrompt,
    ESSAY_GRADE: essayGradePrompt,
    FLASHCARD_GENERATE: flashcardGeneratePrompt,
    CHAT_AGENT: chatAgentPrompt,
    AUTO_HEADER: autoHeaderPrompt,
    FOLLOW_UP_SUGGESTIONS: followUpSuggestionsPrompt,
    BLOCKNOTE_EDIT: blocknoteEditPrompt,
    VISION_OCR: visionOcrPrompt,
  };

  /**
   * Render system prompt và user prompt cho tính năng đã đăng ký
   */
  render<T extends FeatureKey>(
    feature: T,
    payload: PromptPayloadMap[T],
  ): RenderedPrompt {
    const template = this.templates[feature] as
      | PromptTemplate<PromptPayloadMap[T]>
      | undefined;

    if (!template) {
      throw new NotFoundException(
        `Chưa cấu hình prompt template cho tính năng: ${feature}`,
      );
    }

    const system =
      typeof template.system === 'function'
        ? template.system(payload)
        : (template.system ?? '');

    const prompt =
      typeof template.renderUser === 'function'
        ? template.renderUser(payload)
        : '';

    return {
      system,
      prompt,
    };
  }

  /**
   * Lấy cấu hình template gốc của tính năng
   */
  getTemplate<T extends FeatureKey>(
    feature: T,
  ): PromptTemplate<PromptPayloadMap[T]> {
    const template = this.templates[feature] as
      | PromptTemplate<PromptPayloadMap[T]>
      | undefined;

    if (!template) {
      throw new NotFoundException(
        `Chưa cấu hình prompt template cho tính năng: ${feature}`,
      );
    }

    return template;
  }
}
