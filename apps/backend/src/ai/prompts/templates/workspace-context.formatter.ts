import type { ResolvedWorkspaceContext } from '../workspace-context.types.js';

export const MAX_UI_CONTEXT_CHARS = 1400;

const CONTEXT_OPEN_TAG = '<current_ui_context trust="application_verified" scope="turn_only">';
const CONTEXT_CLOSE_TAG = '</current_ui_context>';

/**
 * Làm sạch chuỗi từ người dùng/UI để chống XML tag break-out và prompt injection.
 */
export function sanitizeContextText(value: string, maxLen: number): string {
  if (!value) return '';
  let stripped = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    stripped += code < 32 || code === 127 ? ' ' : value[i];
  }
  const cleaned = stripped
    .replace(/</g, '[')
    .replace(/>/g, ']')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= maxLen) {
    return cleaned;
  }
  if (maxLen <= 3) {
    return cleaned.slice(0, maxLen);
  }
  return `${cleaned.slice(0, maxLen - 3)}...`;
}

function formatTabLabel(tab?: string): string {
  switch (tab) {
    case 'documents':
      return 'documents (Documents Tab)';
    case 'summary':
      return 'summary (Notes & Summaries Tab)';
    case 'flashcard':
      return 'flashcard (Flashcards Tab)';
    case 'quiz':
      return 'quiz (Quiz Tab)';
    case 'analytics':
      return 'analytics (Learning Analytics Tab)';
    default:
      return 'unknown';
  }
}

/**
 * Render block ngữ cảnh UI L1 siêu gọn, có ngân sách ký tự cứng (<= 1400 chars)
 * để tiêm tạm thời vào lượt hội thoại hiện tại mà không làm vỡ Prompt Cache.
 */
export function renderEphemeralUiContextBlock(
  ctx: ResolvedWorkspaceContext,
): string {
  const coreLines: string[] = [];
  const guardLines: string[] = [];
  const secondaryLines: string[] = [];
  let selectionLine: string | null = null;
  const listHeaderLines: string[] = [];
  const listItems: string[] = [];
  let totalListCount = 0;

  // 1. Location
  const subjectPart = ctx.location.subjectName
    ? `Subject "${sanitizeContextText(ctx.location.subjectName, 60)}"`
    : ctx.location.subjectId
      ? `Subject (${ctx.location.subjectId})`
      : '';
  const convPart = ctx.location.conversationTitle
    ? `Conversation "${sanitizeContextText(ctx.location.conversationTitle, 60)}"`
    : ctx.location.conversationId
      ? `Conversation (${ctx.location.conversationId})`
      : '';
  const locationParts = [subjectPart, convPart].filter(Boolean);
  coreLines.push(
    `Location: ${locationParts.length > 0 ? locationParts.join(' > ') : ctx.location.pageType}${ctx.location.isFocusMode ? ' [Focus Mode]' : ''}`,
  );

  // 2. Inventory
  coreLines.push(
    `Workspace Inventory: ${ctx.inventory.documentsCount} documents (${ctx.inventory.readyDocumentsCount} ready), ${ctx.inventory.notesCount} notes, ${ctx.inventory.decksCount} decks, ${ctx.inventory.quizzesCount} quizzes`,
  );

  // 3. Active Tab
  if (ctx.location.activeTab) {
    coreLines.push(`Active Tab: ${formatTabLabel(ctx.location.activeTab)}`);
  }

  // 4. Guards (ưu tiên tối cao, không bao giờ bị cắt)
  if (ctx.guards.examIntegrityGuard) {
    guardLines.push(
      '[GUARD: EXAM_INTEGRITY_MODE] Student is actively taking a graded exam. Do NOT reveal direct answers or correct choices; only explain underlying concepts or problem-solving hints.',
    );
  }
  if (ctx.guards.hideFlashcardAnswerGuard) {
    guardLines.push(
      '[GUARD: FLASHCARD_ANSWER_HIDDEN] Front of flashcard is shown and answer is not yet revealed. Give helpful hints without spoiling the exact answer unless explicitly asked to reveal.',
    );
  }

  // 5. Attached documents in current turn
  if (ctx.attachedDocuments && ctx.attachedDocuments.length > 0) {
    const attachedStr = ctx.attachedDocuments
      .slice(0, 5)
      .map(
        (d) =>
          `"${sanitizeContextText(d.fileName, 45)}" (documentId: "${d.documentId}")`,
      )
      .join(', ');
    coreLines.push(`Attached In Current Message: ${attachedStr}`);
  } else {
    coreLines.push('Attached In Current Message: none');
  }

  // 6. Tab-specific active state
  const activeTab = ctx.location.activeTab;

  if (activeTab === 'documents' && ctx.documentsView) {
    const dv = ctx.documentsView;
    if (dv.viewMode === 'viewer' && dv.viewingDocument) {
      const doc = dv.viewingDocument;
      const pageTotal = doc.totalPages ?? doc.pageCount;
      const pageInfo =
        typeof doc.currentPage === 'number'
          ? ` | Page ${doc.currentPage}${pageTotal ? ` of ${pageTotal}` : ''}`
          : pageTotal
            ? ` | ${pageTotal} pages`
            : '';
      const modeInfo =
        doc.viewerKind === 'word' && doc.wordChangeMode
          ? ` | changeMode: ${doc.wordChangeMode}`
          : '';
      const statusInfo = doc.status ? ` | status: ${doc.status}` : '';
      coreLines.push(
        `Active View: Viewing ${doc.viewerKind.toUpperCase()} "${sanitizeContextText(doc.fileName, 70)}" (documentId: "${doc.documentId}")${pageInfo}${modeInfo}${statusInfo}`,
      );
      if (doc.nearbyTocHeadings && doc.nearbyTocHeadings.length > 0) {
        secondaryLines.push(
          `Nearby Outline: ${doc.nearbyTocHeadings.slice(0, 4).map((h) => sanitizeContextText(h, 55)).join(' | ')}`,
        );
      }
      if (doc.selectedText) {
        selectionLine = doc.selectedText;
      }
    } else {
      coreLines.push(
        `Active View: Documents list (filter: ${dv.filterType ?? 'all'}, showing ${dv.visibleCount ?? ctx.inventory.documentsCount}/${ctx.inventory.documentsCount})`,
      );
    }
  } else if (activeTab === 'summary' && ctx.summaryView) {
    const sv = ctx.summaryView;
    if (sv.viewMode === 'detail' && sv.activeNote) {
      coreLines.push(
        `Active View: Viewing Note "${sanitizeContextText(sv.activeNote.title, 70)}" (summaryId: "${sv.activeNote.summaryId}")`,
      );
      if (sv.activeNote.headings.length > 0) {
        secondaryLines.push(
          `Note Outline: ${sv.activeNote.headings.slice(0, 8).map((h) => sanitizeContextText(h, 50)).join(' | ')}`,
        );
      }
      if (sv.activeNote.selectedText) {
        selectionLine = sv.activeNote.selectedText;
      }
    } else {
      coreLines.push(`Active View: Notes list (${sv.totalCount} notes)`);
    }

    if (sv.notesList && sv.notesList.length > 0) {
      totalListCount = Math.max(sv.totalCount, sv.notesList.length);
      listHeaderLines.push('Notes In Conversation:');
      for (const note of sv.notesList.slice(0, 15)) {
        listItems.push(
          `- "${sanitizeContextText(note.title, 50)}" (summaryId: "${note.id}")`,
        );
      }
    }
  } else if (activeTab === 'flashcard' && ctx.flashcardView) {
    const fv = ctx.flashcardView;
    if (fv.viewMode === 'study' && fv.activeDeck) {
      const st = fv.studyState;
      const studyMeta = st
        ? ` | mode: ${st.mode}, done: ${st.progress}, remaining: ${st.remaining}${st.currentCardId ? `, cardId: "${st.currentCardId}"` : ''}, revealed: ${st.isCardRevealed}`
        : '';
      coreLines.push(
        `Active View: Studying Flashcard Deck "${sanitizeContextText(fv.activeDeck.name, 60)}" (deckId: "${fv.activeDeck.deckId}")${studyMeta}`,
      );
    } else if (fv.viewMode === 'detail' && fv.activeDeck) {
      const d = fv.activeDeck;
      coreLines.push(
        `Active View: Viewing Deck "${sanitizeContextText(d.name, 60)}" (deckId: "${d.deckId}") | ${d.totalCards} cards (new: ${d.newCount}, learning: ${d.learningCount}, review: ${d.reviewCount}, dueToday: ${d.dueToday})`,
      );
    } else {
      coreLines.push(
        `Active View: Flashcard Decks list (${fv.totalDecksCount} decks)`,
      );
    }

    if (fv.decksList && fv.decksList.length > 0) {
      totalListCount = Math.max(fv.totalDecksCount, fv.decksList.length);
      listHeaderLines.push('Decks In Conversation:');
      for (const deck of fv.decksList.slice(0, 15)) {
        listItems.push(
          `- "${sanitizeContextText(deck.name, 45)}" (deckId: "${deck.id}", ${deck.totalCards} cards, ${deck.dueToday} due)`,
        );
      }
    }
  } else if (activeTab === 'quiz' && ctx.quizView) {
    const qv = ctx.quizView;
    if (qv.viewMode === 'taking' && qv.activeQuiz) {
      const att = qv.activeAttempt;
      const qProgress =
        att?.currentQuestionIndex && att?.totalQuestions
          ? ` | Question ${att.currentQuestionIndex}/${att.totalQuestions} (answered: ${att.answeredCount ?? 0})`
          : '';
      coreLines.push(
        `Active View: Taking Quiz "${sanitizeContextText(qv.activeQuiz.title, 60)}" (quizId: "${qv.activeQuiz.quizId}"${att?.attemptId ? `, attemptId: "${att.attemptId}"` : ''}) | mode: ${att?.mode ?? 'exam'}${qProgress}`,
      );
    } else if (qv.viewMode === 'result' && qv.activeQuiz) {
      const att = qv.activeAttempt;
      const scoreStr =
        typeof att?.score === 'number' && typeof att?.maxScore === 'number'
          ? ` | score: ${att.score}/${att.maxScore} (correct: ${att.correctCount ?? 0}, partial: ${att.partialCount ?? 0}, incorrect: ${att.incorrectCount ?? 0}, essay: ${att.essayCount ?? 0})`
          : '';
      const filterStr = att?.resultFilter ? ` | filter: ${att.resultFilter}` : '';
      coreLines.push(
        `Active View: Viewing Quiz Result "${sanitizeContextText(qv.activeQuiz.title, 60)}" (quizId: "${qv.activeQuiz.quizId}"${att?.attemptId ? `, attemptId: "${att.attemptId}"` : ''})${scoreStr}${filterStr}`,
      );
    } else if (qv.activeQuiz) {
      coreLines.push(
        `Active View: Quiz ${qv.viewMode} "${sanitizeContextText(qv.activeQuiz.title, 60)}" (quizId: "${qv.activeQuiz.quizId}", ${qv.activeQuiz.questionCount} questions, ${qv.activeQuiz.attemptsCount} attempts)`,
      );
    } else {
      coreLines.push(
        `Active View: Quizzes ${qv.viewMode} (${qv.totalQuizzesCount} quizzes)`,
      );
    }

    if (qv.quizzesList && qv.quizzesList.length > 0) {
      totalListCount = Math.max(qv.totalQuizzesCount, qv.quizzesList.length);
      listHeaderLines.push('Quizzes In Conversation:');
      for (const quiz of qv.quizzesList.slice(0, 15)) {
        listItems.push(
          `- "${sanitizeContextText(quiz.title, 45)}" (quizId: "${quiz.id}", ${quiz.questionCount} questions)`,
        );
      }
    }
  } else if (activeTab === 'analytics' && ctx.analyticsView) {
    coreLines.push(
      `Active View: Learning Analytics Dashboard (window: ${ctx.analyticsView.windowDays} days${ctx.analyticsView.advancedOpen ? ', advanced open' : ''})`,
    );
  }

  // 7. Side-panel source reader (if open)
  if (ctx.sidePanel) {
    const sp = ctx.sidePanel;
    const spName = sp.fileName
      ? `"${sanitizeContextText(sp.fileName, 55)}" `
      : '';
    const spPage = typeof sp.pageNo === 'number' ? `, page ${sp.pageNo}` : '';
    const spCit = sp.citationId ? `, citation ${sanitizeContextText(sp.citationId, 16)}` : '';
    secondaryLines.push(
      `Side-Panel Source Reader: ${spName}(documentId: "${sp.documentId}"${spPage}${spCit})`,
    );
  }

  // Assemble within hard character budget (MAX_UI_CONTEXT_CHARS)
  const wrapperOverhead = CONTEXT_OPEN_TAG.length + CONTEXT_CLOSE_TAG.length + 2; // +\n\n
  let remainingBudget = MAX_UI_CONTEXT_CHARS - wrapperOverhead;

  const acceptedLines: string[] = [];

  const tryPushLines = (lines: string[]): void => {
    for (const line of lines) {
      const cost = line.length + (acceptedLines.length > 0 ? 1 : 0);
      if (cost <= remainingBudget) {
        acceptedLines.push(line);
        remainingBudget -= cost;
      }
    }
  };

  // Priority 1: Core lines & Guards (trim individual line if extreme edge case)
  for (const line of [...coreLines, ...guardLines]) {
    const sep = acceptedLines.length > 0 ? 1 : 0;
    if (line.length + sep <= remainingBudget) {
      acceptedLines.push(line);
      remainingBudget -= line.length + sep;
    } else if (remainingBudget > sep + 24) {
      const clipped = `${line.slice(0, remainingBudget - sep - 3)}...`;
      acceptedLines.push(clipped);
      remainingBudget -= clipped.length + sep;
    }
  }

  // Priority 2: Secondary lines (side-panel, headings/TOC)
  tryPushLines(secondaryLines);

  // Priority 3: Selected text (reserve space cleanly)
  if (selectionLine) {
    const prefix = 'Selected Text (untrusted_user_selection): "';
    const suffix = '"';
    const sep = acceptedLines.length > 0 ? 1 : 0;
    const minNeeded = sep + prefix.length + suffix.length + 20;
    if (remainingBudget >= minNeeded) {
      const maxTextLen = Math.min(
        450,
        remainingBudget - sep - prefix.length - suffix.length,
      );
      const sanitizedSel = sanitizeContextText(selectionLine, maxTextLen);
      if (sanitizedSel) {
        const line = `${prefix}${sanitizedSel}${suffix}`;
        acceptedLines.push(line);
        remainingBudget -= line.length + sep;
      }
    }
  }

  // Priority 4: Compact list items
  if (listItems.length > 0 && listHeaderLines.length > 0) {
    const header = listHeaderLines[0];
    const headerSep = acceptedLines.length > 0 ? 1 : 0;
    const firstItem = listItems[0];
    if (headerSep + header.length + 1 + firstItem.length <= remainingBudget) {
      acceptedLines.push(header);
      remainingBudget -= headerSep + header.length;

      let shownCount = 0;
      const moreMarkerReserve = 24;
      for (let i = 0; i < listItems.length; i += 1) {
        const item = listItems[i];
        const hasMoreAfter = i < listItems.length - 1 || totalListCount > listItems.length;
        const reserve = hasMoreAfter ? moreMarkerReserve : 0;
        if (1 + item.length + reserve <= remainingBudget) {
          acceptedLines.push(item);
          remainingBudget -= 1 + item.length;
          shownCount += 1;
        } else {
          break;
        }
      }

      const omittedCount = totalListCount - shownCount;
      if (omittedCount > 0) {
        const moreLine = `... (+${omittedCount} more)`;
        if (1 + moreLine.length <= remainingBudget) {
          acceptedLines.push(moreLine);
        }
      }
    }
  }

  const body = acceptedLines.join('\n');
  const full = `${CONTEXT_OPEN_TAG}\n${body}\n${CONTEXT_CLOSE_TAG}`;
  if (full.length <= MAX_UI_CONTEXT_CHARS) {
    return full;
  }

  // Defensive safety clamp (guarantees closing tag intact)
  const maxBodyLen = Math.max(0, MAX_UI_CONTEXT_CHARS - wrapperOverhead);
  return `${CONTEXT_OPEN_TAG}\n${body.slice(0, maxBodyLen)}\n${CONTEXT_CLOSE_TAG}`;
}
