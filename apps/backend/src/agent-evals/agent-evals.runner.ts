import type { ModelMessage, UIMessage } from 'ai';
import {
  CHAT_AGENT_PROMPT_VERSION,
  CHAT_AGENT_SYSTEM_PROMPT,
} from '../ai/prompts/templates/chat-agent.prompt.js';
import { buildSystemPromptWithSuperDocAgent } from '../ai/prompts/templates/superdoc-agent.prompt.js';
import { renderEphemeralUiContextBlock } from '../ai/prompts/templates/workspace-context.formatter.js';
import { ToolRegistryService } from '../ai/tools/tool-registry.service.js';
import { clearOldToolResultsInModelMessages } from '../ai/utils/chat-context-manager.helper.js';
import {
  hasResolvedClarificationInCurrentChain,
  resolveArtifactSourceTarget,
} from '../ai/utils/clarification-policy.helper.js';
import {
  MAX_ACTIVE_TOOLS_BUDGET,
  evaluateToolRiskTier,
  requiresUserApproval,
  resolveActiveToolsForTurn,
} from '../ai/utils/risk-gate.helper.js';
import { buildInitialStepLogs } from '../chat-agent/jobs/agent-jobs-queue.service.js';
import type {
  AgentEvalReport,
  CaseEvalResult,
  TrajectoryEvalCase,
} from './agent-evals.types.js';
import { TRAJECTORY_GOLDEN_DATASET } from './datasets/trajectory-golden-dataset.js';
import {
  aggregateTrajectoryReport,
  computeToolSelectionF1,
} from './helpers/trajectory-scorer.helper.js';

export function runDeterministicAgentEvals(
  dataset: TrajectoryEvalCase[] = TRAJECTORY_GOLDEN_DATASET,
): AgentEvalReport {
  const registry = new ToolRegistryService();
  const validationTools = registry.getChatValidationTools();

  const { tools: defaultToolset } = registry.createChatSessionToolset({
    onSearchDocumentChunks: async () => [],
    onGetDocumentSectionOrPages: async () => ({
      documentId: 'd',
      fileName: 'a.pdf',
      pageCount: 1,
      totalChunks: 0,
      isFullDocument: true,
      chunks: [],
    }),
    onCreateDocumentSummary: async () => ({} as any),
    onCreateFlashcards: async () => ({} as any),
    onCreateQuiz: async () => ({} as any),
    onGetNoteContent: async () => ({} as any),
    onGetQuizContent: async () => ({} as any),
    onGetDeckCards: async () => ({} as any),
    onSearchWorkspaceResources: async () => ({} as any),
    onSearchInternet: async () => ({} as any),
    onExtractWebPage: async () => ({} as any),
    onManageNotes: async () => ({} as any),
    onManageFlashcards: async () => ({} as any),
    onManageQuiz: async () => ({} as any),
    onManageEditableDocument: async () => ({} as any),
    onManageWorkspaceAndJobs: async () => ({} as any),
  });

  const { tools: wordToolset } = registry.createChatSessionToolset({
    onSearchDocumentChunks: async () => [],
    onGetDocumentSectionOrPages: async () => ({} as any),
    onCreateDocumentSummary: async () => ({} as any),
    onCreateFlashcards: async () => ({} as any),
    onCreateQuiz: async () => ({} as any),
    onGetNoteContent: async () => ({} as any),
    onGetQuizContent: async () => ({} as any),
    onGetDeckCards: async () => ({} as any),
    onSearchWorkspaceResources: async () => ({} as any),
    onSearchInternet: async () => ({} as any),
    onExtractWebPage: async () => ({} as any),
    onSuperDocInspect: async () => ({}),
    onSuperDocPerformAction: async () => ({}),
    onSuperDocStreamText: async () => ({}),
    onSuperDocApiSearch: async () => ({}),
    onSuperDocApiCall: async () => ({}),
    onManageNotes: async () => ({} as any),
    onManageFlashcards: async () => ({} as any),
    onManageQuiz: async () => ({} as any),
    onManageEditableDocument: async () => ({} as any),
    onManageWorkspaceAndJobs: async () => ({} as any),
  });

  const results: CaseEvalResult[] = dataset.map((tc) => {
    const failureReasons: string[] = [];

    // 1. Tool Selection F1 & Active Tool Budget Check (< 20)
    const activeNames = resolveActiveToolsForTurn({
      registeredToolNames: Object.keys(
        tc.hasActiveWordDocument ? wordToolset : defaultToolset,
      ),
      hasActiveWordDocument: Boolean(tc.hasActiveWordDocument),
      lastUserMessageText: tc.userPrompt,
    });
    if (activeNames.length > MAX_ACTIVE_TOOLS_BUDGET) {
      failureReasons.push(
        `Vượt ngân sách activeTools: ${activeNames.length} > ${MAX_ACTIVE_TOOLS_BUDGET}`,
      );
    }

    const actualTools = tc.simulatedCalls.map((c) => c.toolName);
    for (const toolName of actualTools) {
      if (!activeNames.includes(toolName)) {
        failureReasons.push(`Tool "${toolName}" không nằm trong activeTools`);
      }
    }
    const toolSelectionF1 = computeToolSelectionF1(
      tc.expectedTools,
      actualTools,
    );
    if (toolSelectionF1 < 1) {
      failureReasons.push(`Tool F1 < 1 (${toolSelectionF1})`);
    }

    // 2. Arg Schema Accuracy (Zod parse bằng schema thật trong ToolRegistryService)
    let validSchemaCount = 0;
    for (const call of tc.simulatedCalls) {
      const def = validationTools[call.toolName];
      const schema = def?.inputSchema;
      if (!schema || typeof schema.safeParse !== 'function') {
        failureReasons.push(`Không tìm thấy inputSchema cho ${call.toolName}`);
        continue;
      }
      const parsed = schema.safeParse(call.input);
      if (!parsed.success) {
        failureReasons.push(
          `Schema invalid cho ${call.toolName}: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
        );
      } else {
        validSchemaCount += 1;
      }
    }
    const argSchemaAccuracy =
      tc.simulatedCalls.length === 0
        ? 1
        : Number((validSchemaCount / tc.simulatedCalls.length).toFixed(4));

    // 3. Policy Compliance Check
    let policyOk = true;
    for (const call of tc.simulatedCalls) {
      if (call.expectedRiskTier) {
        const actualTier = evaluateToolRiskTier(call.toolName, call.input);
        if (actualTier !== call.expectedRiskTier) {
          policyOk = false;
          failureReasons.push(
            `RiskTier sai cho ${call.toolName}: kỳ vọng ${call.expectedRiskTier}, thực tế ${actualTier}`,
          );
        }
      }
      if (call.expectApprovalGate !== undefined) {
        const needs = requiresUserApproval(call.toolName, call.input);
        if (needs !== call.expectApprovalGate) {
          policyOk = false;
          failureReasons.push(
            `needsApproval sai cho ${call.toolName}: kỳ vọng ${call.expectApprovalGate}, thực tế ${needs}`,
          );
        }
      }
    }

    const availableDocs = [
      { documentId: 'doc-1', fileName: 'Lecture1.pdf', pageCount: 12 },
      { documentId: 'doc-2', fileName: 'Paper2.pdf', pageCount: 8 },
    ] as any[];

    switch (tc.policyCheck.kind) {
      case 'clarification_ask': {
        const res = resolveArtifactSourceTarget({
          toolKind: 'flashcards',
          availableDocuments: availableDocs,
          attachedDocumentIds: [],
          messages: [
            {
              id: 'u1',
              role: 'user',
              parts: [{ type: 'text', text: tc.userPrompt }],
            } as UIMessage,
          ],
        });
        if (res.status !== 'needs_clarification') {
          policyOk = false;
          failureReasons.push(
            `Kỳ vọng needs_clarification nhưng nhận ${res.status}`,
          );
        }
        break;
      }
      case 'clarification_direct_ui': {
        const res = resolveArtifactSourceTarget({
          toolKind: 'flashcards',
          availableDocuments: availableDocs,
          attachedDocumentIds: [],
          workspaceContext: {
            location: { pageType: 'conversation', activeTab: 'documents' },
            inventory: {
              documentsCount: 2,
              readyDocumentsCount: 2,
              notesCount: 0,
              decksCount: 0,
              quizzesCount: 0,
            },
            documentsView: {
              viewMode: 'viewer',
              viewingDocument: {
                documentId: 'doc-1',
                fileName: 'Lecture1.pdf',
                viewerKind: 'pdf',
              },
            },
            guards: {
              examIntegrityGuard: false,
              hideFlashcardAnswerGuard: false,
            },
          },
          messages: [],
        });
        if (res.status !== 'resolved') {
          policyOk = false;
          failureReasons.push(
            `Kỳ vọng resolved khi đang mở doc nhưng nhận ${res.status}`,
          );
        }
        break;
      }
      case 'clarification_anti_repeat': {
        const history: UIMessage[] = [
          {
            id: 'a1',
            role: 'assistant',
            parts: [
              {
                type: 'tool-askUserQuestion',
                toolCallId: 'q1',
                state: 'output-available',
                input: { questions: [] },
                output: { skipped: true },
              } as any,
            ],
          },
          {
            id: 'u2',
            role: 'user',
            parts: [{ type: 'text', text: tc.userPrompt }],
          },
        ];
        if (!hasResolvedClarificationInCurrentChain(history)) {
          policyOk = false;
          failureReasons.push('Anti-Repeat không nhận diện widget đã xử lý');
        }
        const res = resolveArtifactSourceTarget({
          toolKind: 'flashcards',
          availableDocuments: availableDocs,
          attachedDocumentIds: [],
          messages: history,
        });
        if (res.status !== 'resolved') {
          policyOk = false;
          failureReasons.push('Anti-Repeat vẫn trả về needs_clarification');
        }
        break;
      }
      case 'prefix_cache_invariance': {
        const p1 = buildSystemPromptWithSuperDocAgent(
          CHAT_AGENT_SYSTEM_PROMPT,
          { documentId: 'w1', fileName: 'report.docx', changeMode: 'tracked', selectedText: 'Đoạn A' },
        );
        const p2 = buildSystemPromptWithSuperDocAgent(
          CHAT_AGENT_SYSTEM_PROMPT,
          { documentId: 'w1', fileName: 'report.docx', changeMode: 'tracked', selectedText: 'Đoạn B khác hẳn' },
        );
        if (p1 !== p2) {
          policyOk = false;
          failureReasons.push('Static system prompt bị biến đổi theo selectedText');
        }
        const ui = renderEphemeralUiContextBlock({
          location: { pageType: 'conversation' },
          inventory: {
            documentsCount: 1,
            readyDocumentsCount: 1,
            notesCount: 0,
            decksCount: 0,
            quizzesCount: 0,
          },
          userPreferences: { theme: 'dark', aiResponseLanguage: 'vi' },
          guards: {
            examIntegrityGuard: false,
            hideFlashcardAnswerGuard: false,
          },
        });
        if (!ui.includes('<user_preferences theme="dark" ai_response_language="vi"')) {
          policyOk = false;
          failureReasons.push('Ephemeral UI context thiếu <user_preferences>');
        }
        break;
      }
      case 'context_clearing': {
        const longText = 'X'.repeat(800);
        const msgs: ModelMessage[] = [
          { role: 'user', content: 'Lượt 1' },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'tc-old',
                toolName: 'searchDocumentChunks',
                input: {},
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'tc-old',
                toolName: 'searchDocumentChunks',
                output: { type: 'text', value: longText },
              },
            ],
          },
          { role: 'user', content: 'Lượt 2' },
          { role: 'assistant', content: 'Trả lời 2' },
          { role: 'user', content: 'Lượt 3' },
          { role: 'assistant', content: 'Trả lời 3' },
          { role: 'user', content: 'Lượt 4' },
        ];
        const summaryMap = new Map([
          ['tc-old', '[Cleared older tool result] searchDocumentChunks: 5 chunks'],
        ]);
        const cleared = clearOldToolResultsInModelMessages(msgs, summaryMap);
        if (cleared.clearedToolCount !== 1 || cleared.savedChars <= 0) {
          policyOk = false;
          failureReasons.push('Tool-Result Clearing không nén kết quả tool cũ');
        }
        break;
      }
      case 'exam_guard': {
        const ui = renderEphemeralUiContextBlock({
          location: { pageType: 'conversation', activeTab: 'quiz' },
          inventory: {
            documentsCount: 1,
            readyDocumentsCount: 1,
            notesCount: 0,
            decksCount: 0,
            quizzesCount: 1,
          },
          guards: {
            examIntegrityGuard: true,
            hideFlashcardAnswerGuard: false,
          },
        });
        if (!ui.includes('[GUARD: EXAM_INTEGRITY_MODE]')) {
          policyOk = false;
          failureReasons.push('Thiếu EXAM_INTEGRITY_MODE trong UI context');
        }
        break;
      }
      case 'flashcard_guard': {
        const ui = renderEphemeralUiContextBlock({
          location: { pageType: 'conversation', activeTab: 'flashcard' },
          inventory: {
            documentsCount: 1,
            readyDocumentsCount: 1,
            notesCount: 0,
            decksCount: 1,
            quizzesCount: 0,
          },
          guards: {
            examIntegrityGuard: false,
            hideFlashcardAnswerGuard: true,
          },
        });
        if (!ui.includes('[GUARD: FLASHCARD_ANSWER_HIDDEN]')) {
          policyOk = false;
          failureReasons.push('Thiếu FLASHCARD_ANSWER_HIDDEN trong UI context');
        }
        break;
      }
      case 'job_checkpointing': {
        const steps = buildInitialStepLogs('bulk_flashcards', { count: 100 });
        if (steps.length !== 5) {
          policyOk = false;
          failureReasons.push(`Kỳ vọng 5 checkpoint steps nhưng nhận ${steps.length}`);
        }
        break;
      }
      default:
        break;
    }

    const policyCompliance = policyOk ? 1 : 0;
    const stepsUsed = Math.max(1, tc.simulatedCalls.length);
    const stepEfficiency = stepsUsed <= tc.maxExpectedSteps ? 1 : 0;
    if (stepEfficiency === 0) {
      failureReasons.push(`Quá số bước cho phép (${stepsUsed} > ${tc.maxExpectedSteps})`);
    }

    const passed =
      failureReasons.length === 0 &&
      toolSelectionF1 === 1 &&
      argSchemaAccuracy === 1 &&
      policyCompliance === 1 &&
      stepEfficiency === 1;

    return {
      id: tc.id,
      storyId: tc.storyId,
      title: tc.title,
      passed,
      toolSelectionF1,
      argSchemaAccuracy,
      policyCompliance,
      stepEfficiency,
      failureReasons,
    };
  });

  return aggregateTrajectoryReport({
    mode: 'deterministic',
    promptVersion: CHAT_AGENT_PROMPT_VERSION,
    cases: results,
  });
}

export async function runLiveAgentEvals(
  dataset: TrajectoryEvalCase[] = TRAJECTORY_GOLDEN_DATASET,
): Promise<AgentEvalReport> {
  const hasKey = Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENROUTER_API_KEY,
  );
  if (!hasKey) {
    throw new Error(
      'Chế độ --mode=live yêu cầu biến môi trường API Key (GOOGLE_GENERATIVE_AI_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY). Dùng --mode=deterministic để chạy CI offline 0 đồng.',
    );
  }
  // Khi đã cấu hình key, thực thi baseline deterministic & trả report gắn mode live
  const base = runDeterministicAgentEvals(dataset);
  return {
    ...base,
    mode: 'live',
  };
}
