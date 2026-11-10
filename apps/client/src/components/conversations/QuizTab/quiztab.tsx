"use client";

/**
 * QuizTab — Component tổng của tab "Bài kiểm tra".
 * Điều phối các màn hình: Danh sách (A1/A2) → Chi tiết (A4) → Soạn đề (A3) → Làm bài (B1/B2) → Chấm AI (B3) → Kết quả (B4).
 *
 * Cách dùng: <QuizTab conversationId={id} decks={decks} api={quizApi} />
 * Không truyền `api` → chạy bằng dữ liệu giả lập để xem giao diện.
 */

import "./quiztab.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useFocusMode } from "@/components/layout";
import type { DeckOption, DocumentOption, FlashcardTarget, Quiz, QuizAttempt, QuizDraft, QuizSource, TestSetup, EvaluationStatus } from "./types";
import type { QuizApi } from "./data/quizApi";
import { createMockQuizApi } from "./data/mockApi";
import { MOCK_DOCUMENTS } from "./data/mockDocuments";
import { useQuizStore } from "./hooks/useQuizStore";
import { Button, Modal } from "./ui/primitives";
import { cx } from "./utils";
import { QuizListView } from "./list/QuizListView";
import { QuizOverviewView } from "./detail/QuizOverviewView";
import { QuizBuilderView } from "./create/QuizBuilderView";
import { CreateQuizDialog } from "./create/CreateQuizDialog";
import { TestSetupModal } from "./take/TestSetupModal";
import { TestTakingView } from "./take/TestTakingView";
import { GradingState } from "./take/GradingState";
import { ResultView } from "./result/ResultView";

export interface QuizTabProps {
  conversationId: string;
  /** Các bộ Flashcard của không gian học tập (dùng cho "Tạo từ Flashcard" và "Chuyển câu sai thành Flashcard") */
  decks?: DeckOption[];
  /** Tài liệu của không gian học tập, dùng cho bộ chọn nguồn khi tạo đề bằng AI. Bỏ trống = dữ liệu giả để test. */
  documents?: DocumentOption[];
  /** Lớp API thật. Bỏ trống để dùng dữ liệu giả lập. */
  api?: QuizApi;
  className?: string;
  /** Không gian học tập đã có tài liệu chưa (đồng bộ với FlashcardTab). Mặc định: true */
  hasDocuments?: boolean;
  /** Chuyển sang tab Tài liệu (dùng ở Empty State khi chưa có tài liệu) */
  onUploadDocument?: () => void;
  /** Gọi sau khi tạo Flashcard từ câu sai — để tab Flashcard tải lại dữ liệu */
  onFlashcardsCreated?: (info: { deckId: string; created: number }) => void;
}

type View =
  | { name: "list" }
  | { name: "detail"; quizId: string }
  | { name: "builder"; quizId: string | null }
  | { name: "taking"; quizId: string; attemptId: string }
  | { name: "grading"; quizId: string; attemptId: string }
  | { name: "result"; quizId: string; attemptId: string };

export function QuizTab({ conversationId, decks = [], documents = MOCK_DOCUMENTS, api, className, hasDocuments = true, onUploadDocument, onFlashcardsCreated }: QuizTabProps) {
  const resolvedApi = useMemo(() => api ?? createMockQuizApi(conversationId), [api, conversationId]);
  const store = useQuizStore(resolvedApi, conversationId);

  const [view, setView] = useState<View>({ name: "list" });
  const [createSource, setCreateSource] = useState<QuizSource | null>(null);
  const [setup, setSetup] = useState<{ quizId: string; retryIds?: string[] } | null>(null);
  const [deleting, setDeleting] = useState<Quiz | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const { setFocusMode } = useFocusMode();

  // Focus Mode: chỉ bật khi đang làm bài / chờ AI chấm. Layout cha tự ẩn Header, Tab, Sidebar.
  const isFocus = view.name === "taking" || view.name === "grading";
  useEffect(() => {
    setFocusMode(isFocus);
    return () => setFocusMode(false);
  }, [isFocus, setFocusMode]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  }, []);

  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [view.name]);

  const quizOf = (id: string) => store.quizzes.find((q) => q.id === id) ?? null;
  const attemptOf = (quizId: string, id: string): QuizAttempt | null => (store.attempts[quizId] ?? []).find((a) => a.id === id) ?? null;
  const go = (v: View) => setView(v);

  const openCreate = (s: QuizSource) => (s === "manual" ? go({ name: "builder", quizId: null }) : setCreateSource(s));

  const saveQuiz = async (quizId: string | null, draft: QuizDraft) => {
    const q = quizId ? await store.updateQuiz(quizId, draft) : await store.createQuiz(draft);
    notify(quizId ? "Đã lưu thay đổi" : "Đã tạo bài kiểm tra");
    go({ name: "detail", quizId: q.id });
  };

  const startAttempt = async (s: TestSetup) => {
    const quiz = quizOf(setup!.quizId)!;
    const att = await store.startAttempt(quiz, s);
    setSetup(null);
    go({ name: "taking", quizId: quiz.id, attemptId: att.id });
  };

  const submit = async (quiz: Quiz, att: QuizAttempt, timeSpentSec: number) => {
    const ids = att.config?.questionOrder ?? quiz.questions.map((q) => q.id);
    const hasEssay = quiz.questions.some((q) => q.type === "essay" && ids.includes(q.id));
    if (hasEssay) go({ name: "grading", quizId: quiz.id, attemptId: att.id });
    try {
      const res = await store.submitAttempt(att, timeSpentSec, hasEssay);
      go({ name: "result", quizId: quiz.id, attemptId: res.id });
    } catch {
      notify("Không thể nộp bài. Bài làm của bạn vẫn được giữ, hãy thử lại.");
      go({ name: "taking", quizId: quiz.id, attemptId: att.id });
    }
  };

  /* ------------------------------ Render theo view ------------------------------ */
  let content: React.ReactNode;
  const quizId = "quizId" in view ? view.quizId : null;
  const quiz = quizId ? quizOf(quizId) : null;

  if (view.name === "list") {
    content = (
      <QuizListView
        quizzes={store.quizzes} attempts={store.attempts} loading={store.loading} error={store.error} onRetry={store.reload}
        onCreate={openCreate}
        hasDocuments={hasDocuments} hasDecks={decks.length > 0} onUploadDocument={onUploadDocument}
        onOpen={(q) => go({ name: "detail", quizId: q.id })}
        onStart={(q) => {
          const running = (store.attempts[q.id] ?? []).find((a) => a.status === "in_progress");
          if (running) go({ name: "taking", quizId: q.id, attemptId: running.id });
          else setSetup({ quizId: q.id });
        }}
        onEdit={(q) => go({ name: "builder", quizId: q.id })}
        onDelete={setDeleting}
      />
    );
  } else if (view.name === "builder") {
    content = (
      <QuizBuilderView
        key={view.quizId ?? "new"} quiz={view.quizId ? quiz : null}
        onCancel={() => go(view.quizId ? { name: "detail", quizId: view.quizId } : { name: "list" })}
        onSave={(d) => saveQuiz(view.quizId, d)}
      />
    );
  } else if (!quiz) {
    content = null;
  } else if (view.name === "detail") {
    content = (
      <QuizOverviewView
        quiz={quiz} attempts={store.attempts[quiz.id] ?? []}
        onBack={() => go({ name: "list" })}
        onEdit={() => go({ name: "builder", quizId: quiz.id })}
        onDelete={() => setDeleting(quiz)}
        onStart={() => setSetup({ quizId: quiz.id })}
        onReview={(a) => go({ name: "result", quizId: quiz.id, attemptId: a.id })}
        onResume={(a) => go({ name: "taking", quizId: quiz.id, attemptId: a.id })}
      />
    );
  } else {
    const att = attemptOf(quiz.id, view.attemptId);
    if (!att) content = null;
    else if (view.name === "grading" || att.status === "grading") content = <GradingState />;
    else if (view.name === "taking" && att.status === "in_progress") {
      content = (
        <TestTakingView
          key={att.id} quiz={quiz} attempt={att}
          onAnswer={(a) => store.patchAnswer(att, a)}
          onSubmit={(t) => submit(quiz, att, t)}
          onExit={async (t) => { await store.saveProgress(att, t); go({ name: "detail", quizId: quiz.id }); }}
        />
      );
    } else {
      content = (
        <ResultView
          quiz={quiz} attempt={att} decks={decks}
          onBack={() => go({ name: "detail", quizId: quiz.id })}
          onRetryAll={() => setSetup({ quizId: quiz.id })}
          onRetryIncomplete={(ids) => setSetup({ quizId: quiz.id, retryIds: ids })}
          onOverride={(qid, s: Exclude<EvaluationStatus, "pending">) => store.overrideEvaluation(att, qid, s)}
          onConvert={async (ids, target: FlashcardTarget) => {
            const r = await store.convertToFlashcards(att.id, ids, target);
            notify(`Đã tạo ${r.created} thẻ Flashcard`);
            onFlashcardsCreated?.(r);
          }}
        />
      );
    }
  }

  const setupQuiz = setup ? quizOf(setup.quizId) : null;

  return (
    <div ref={scroller} className={cx("qz-root h-full min-h-0 overflow-y-auto text-foreground", className)}>
      <div className={cx("mx-auto w-full max-w-[1200px] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6", isFocus ? "pt-0" : "pt-6")}>{content}</div>

      {createSource && (
        <CreateQuizDialog
          open key={createSource} initialSource={createSource} decks={decks} documents={documents} onClose={() => setCreateSource(null)} onManual={() => undefined}
          onGenerateAI={async (o) => { const q = await store.generateWithAI(o); setCreateSource(null); notify("AI đã tạo xong đề kiểm tra"); go({ name: "detail", quizId: q.id }); }}
          onGenerateDeck={async (o) => { const q = await store.generateFromDeck(o); setCreateSource(null); notify("Đã tạo bài kiểm tra từ bộ thẻ"); go({ name: "detail", quizId: q.id }); }}
        />
      )}

      {setup && setupQuiz && <TestSetupModal quiz={setupQuiz} retryIds={setup.retryIds} onClose={() => setSetup(null)} onStart={startAttempt} />}

      <Modal
        open={Boolean(deleting)} onClose={() => setDeleting(null)} size="sm" title="Xóa bài kiểm tra?"
        description={deleting ? `“${deleting.title}” và toàn bộ lịch sử làm bài sẽ bị xóa vĩnh viễn.` : undefined}
        footer={
          <>
            <Button variant="tertiary" onClick={() => setDeleting(null)}>Hủy</Button>
            <Button
              variant="primary" className="!bg-[var(--qz-danger)] hover:!opacity-90"
              onClick={async () => {
                const q = deleting!;
                setDeleting(null);
                await store.deleteQuiz(q.id);
                notify("Đã xóa bài kiểm tra");
                go({ name: "list" });
              }}
            >
              Xóa đề
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-[var(--on-surface-variant)]">Hành động này không thể hoàn tác.</p>
      </Modal>

      {toast && (
        <div role="status" className="qz-anim-pop apple-liquid-glass pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[110] mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold shadow-[var(--qz-shadow-float)]">
          <Check className="h-4 w-4 shrink-0 text-[var(--qz-success)]" aria-hidden />{toast}
        </div>
      )}
    </div>
  );
}

export default QuizTab;
