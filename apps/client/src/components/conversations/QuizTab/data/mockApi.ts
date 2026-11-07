import type {
  AttemptAnswer, Quiz, QuizAttempt, QuizDraft, QuizOption, QuizQuestion, QuestionDraft, QuestionType,
} from "../types";
import type { QuizApi } from "./quizApi";
import { emptyAnswer, evaluateObjective, stripHtml, uid } from "../utils";

/* Triển khai GIẢ LẬP in-memory để chạy thử giao diện. Thay bằng API thật khi tích hợp. */

const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const opt = (text: string, isCorrect = false): QuizOption => ({ id: uid(), text, isCorrect });
const tfOptions = (correct: boolean): QuizOption[] => [
  { id: "true", text: "Đúng", isCorrect: correct },
  { id: "false", text: "Sai", isCorrect: !correct },
];

type Bank = Omit<QuestionDraft, "id">;
const bank = (): Bank[] => [
  { type: "single_choice", points: 1, gradingCriteria: [], text: "<p>Nguyên lý cốt lõi của <strong>Spaced Repetition</strong> là gì?</p>",
    options: [opt("Ôn lại vào những khoảng thời gian tăng dần", true), opt("Học dồn một lần thật nhiều"), opt("Chỉ đọc lại ghi chú"), opt("Ôn đều mỗi ngày với cùng một lượng")],
    explanation: "<p>Spaced Repetition giãn dần khoảng cách giữa các lần ôn, đúng lúc bạn sắp quên.</p>" },
  { type: "single_choice", points: 1, gradingCriteria: [], text: "<p>Đường cong nào mô tả tốc độ quên theo thời gian?</p>",
    options: [opt("Đường cong Ebbinghaus", true), opt("Đường cong Gauss"), opt("Đường cong Lorenz"), opt("Đường cong Phillips")],
    explanation: "<p>Hermann Ebbinghaus mô tả việc trí nhớ suy giảm theo hàm mũ nếu không được ôn lại.</p>" },
  { type: "multiple_choice", points: 2, gradingCriteria: [], text: "<p>Những phương pháp nào thuộc nhóm <strong>học chủ động</strong>?</p>",
    options: [opt("Active Recall", true), opt("Tự giải thích lại bằng lời của mình", true), opt("Tô màu thật nhiều đoạn văn"), opt("Đọc đi đọc lại một lượt")],
    explanation: "<p>Hai cách đầu buộc não truy xuất thông tin, nên ghi nhớ bền hơn.</p>" },
  { type: "true_false", points: 1, gradingCriteria: [], text: "<p>Ôn tập dồn vào đêm trước kỳ thi giúp ghi nhớ dài hạn tốt hơn ôn rải đều.</p>",
    options: tfOptions(false), explanation: "<p>Ôn rải đều (spacing effect) cho trí nhớ dài hạn tốt hơn.</p>" },
  { type: "short_answer", points: 1, gradingCriteria: [], text: "<p>Thuật toán lập lịch ôn tập nổi tiếng của Anki, ra đời từ năm 1987, có tên viết tắt là gì?</p>",
    sampleAnswer: "SM-2|SM2", explanation: "<p>SM-2 do Piotr Woźniak phát triển.</p>" },
  { type: "essay", points: 2, text: "<p>Giải thích ngắn gọn cách <strong>Active Recall</strong> kết hợp với Spaced Repetition giúp ghi nhớ lâu hơn.</p>",
    sampleAnswer: "<p>Active Recall buộc người học tự truy xuất thông tin thay vì đọc lại thụ động. Khi kết hợp với Spaced Repetition, việc truy xuất được lặp lại theo khoảng cách tăng dần, đúng vào lúc sắp quên theo đường cong Ebbinghaus.</p>",
    gradingCriteria: ["Nêu đúng khái niệm Active Recall (tự truy xuất)", "Nêu khoảng cách ôn tập tăng dần", "Liên hệ với đường cong quên Ebbinghaus"],
    explanation: "<p>Ý chính: truy xuất chủ động + giãn cách thời gian + đường cong quên.</p>" },
  { type: "essay", points: 3, text: "<p>So sánh học dồn (cramming) và học giãn cách. Bạn sẽ khuyên một sinh viên chọn cách nào và vì sao?</p>",
    sampleAnswer: "<p>Học dồn cho kết quả nhanh nhưng dễ quên. Học giãn cách tốn thời gian hơn lúc đầu nhưng giữ kiến thức bền, nên phù hợp khi cần nhớ lâu dài.</p>",
    gradingCriteria: ["Nêu ưu và nhược điểm của học dồn", "Nêu lợi ích của học giãn cách", "Đưa ra khuyến nghị có lý do"] },
];

function toQuestions(quizId: string, drafts: QuestionDraft[]): QuizQuestion[] {
  return drafts.map((d, i) => ({ ...d, id: d.id || uid(), quizId, orderIndex: i }));
}

function gradeEssay(q: QuizQuestion, html: string) {
  const plain = stripHtml(html).toLowerCase();
  const crit = q.gradingCriteria.length ? q.gradingCriteria : [stripHtml(q.sampleAnswer ?? "")];
  if (!plain) return { status: "incorrect" as const, earned: 0, matched: [], missing: crit, feedback: "Bạn chưa viết câu trả lời cho câu này." };
  const matched: string[] = [];
  const missing: string[] = [];
  for (const c of crit) {
    const words = c.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter((w) => w.length > 3);
    const hit = words.filter((w) => plain.includes(w)).length;
    (words.length === 0 || hit / words.length >= 0.5 ? matched : missing).push(c);
  }
  const ratio = matched.length / crit.length;
  const status = ratio >= 0.8 ? ("correct" as const) : ratio >= 0.3 ? ("partial" as const) : ("incorrect" as const);
  const earned = status === "correct" ? q.points : status === "partial" ? Math.round(q.points * Math.min(0.75, Math.max(0.25, ratio)) * 100) / 100 : 0;
  const feedback =
    status === "correct" ? "Bài viết nêu đủ các ý cốt lõi và diễn đạt rõ ràng."
    : status === "partial" ? `Bạn đã nắm được ý chính, nhưng còn thiếu: ${missing.join("; ").toLowerCase()}.`
    : "Câu trả lời chưa bám sát yêu cầu. Hãy xem lại đáp án mẫu và các ý chính bên dưới.";
  return { status, earned, matched, missing, feedback };
}

function gradeAttempt(quiz: Quiz, att: QuizAttempt): QuizAttempt {
  const ids = att.config?.questionOrder ?? quiz.questions.map((q) => q.id);
  let score = 0;
  const answers: Record<string, AttemptAnswer> = { ...att.answers };
  for (const id of ids) {
    const q = quiz.questions.find((x) => x.id === id);
    if (!q) continue;
    const a = answers[id] ?? emptyAnswer(id);
    if (q.type === "essay") {
      const g = gradeEssay(q, a.textAnswer);
      answers[id] = { ...a, evaluationStatus: g.status, pointsEarned: g.earned, matchedPoints: g.matched, missingPoints: g.missing, aiFeedback: g.feedback };
    } else {
      const r = evaluateObjective(q, a)!;
      answers[id] = { ...a, evaluationStatus: r.status, pointsEarned: r.earned };
    }
    score += answers[id].pointsEarned;
  }
  return { ...att, answers, score: Math.round(score * 100) / 100, status: "submitted", completedAt: att.completedAt ?? new Date().toISOString() };
}

function seedAttempt(quiz: Quiz, answeredCount: number, minutesAgo: number, spent: number): QuizAttempt {
  const order = quiz.questions.map((q) => q.id);
  const answers: Record<string, AttemptAnswer> = {};
  quiz.questions.slice(0, answeredCount).forEach((q) => {
    const a = emptyAnswer(q.id);
    if (q.options) a.selectedOptionIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
    else a.textAnswer = q.sampleAnswer?.split("|")[0] ?? "";
    answers[q.id] = a;
  });
  const started = new Date(Date.now() - minutesAgo * 60000).toISOString();
  return gradeAttempt(quiz, {
    id: uid(), quizId: quiz.id, status: "in_progress", score: 0,
    maxScore: quiz.questions.reduce((s, q) => s + q.points, 0), timeSpentSec: spent, startedAt: started,
    answers, config: { mode: "exam", timeLimitSec: quiz.timeLimitSec, questionOrder: order, optionOrder: {} }, completedAt: started,
  });
}

export function createMockQuizApi(conversationId = "demo"): QuizApi {
  const now = new Date().toISOString();
  const q1: Quiz = {
    id: uid(), conversationId, title: "Spaced Repetition & Active Recall", source: "ai", timeLimitSec: 900,
    description: "Ôn nhanh hai phương pháp ghi nhớ nền tảng của không gian học tập.", createdAt: now, updatedAt: now, questions: [],
  };
  q1.questions = toQuestions(q1.id, bank().map((b) => ({ ...b, id: "" })));
  const q2: Quiz = {
    id: uid(), conversationId, title: "Thuật toán tìm kiếm", source: "flashcard", sourceDeckId: "deck-demo", sourceDeckName: "Thuật toán tìm kiếm",
    timeLimitSec: null, description: "Tạo nhanh từ bộ thẻ của bạn.", createdAt: now, updatedAt: now, questions: [],
  };
  q2.questions = toQuestions(q2.id, bank().slice(0, 4).map((b) => ({ ...b, id: "" })));

  const quizzes: Quiz[] = [q1, q2];
  let attempts: QuizAttempt[] = [seedAttempt(q1, 3, 4300, 640), seedAttempt(q1, 5, 1500, 540)];

  const findAttempt = (id: string) => attempts.find((a) => a.id === id)!;
  const findQuiz = (id: string) => quizzes.find((q) => q.id === id)!;
  const put = (a: QuizAttempt) => { attempts = attempts.map((x) => (x.id === a.id ? a : x)); return clone(a); };

  const generate = (conversationId: string, title: string, count: number, types: QuestionType[], extra: Partial<Quiz>): Quiz => {
    const pool = bank().filter((b) => types.includes(b.type));
    const picked = (pool.length ? pool : bank()).slice(0, Math.max(1, Math.min(count, 7)));
    const id = uid();
    const t = new Date().toISOString();
    const quiz: Quiz = { id, conversationId, title, source: "ai", timeLimitSec: null, createdAt: t, updatedAt: t, questions: toQuestions(id, picked.map((b) => ({ ...b, id: "" }))), ...extra };
    quizzes.unshift(quiz);
    return quiz;
  };

  return {
    async listQuizzes() { await wait(350); return clone(quizzes); },
    async listAttempts(quizId) { return clone(attempts.filter((a) => a.quizId === quizId).sort((x, y) => +new Date(y.startedAt) - +new Date(x.startedAt))); },
    async createQuiz(cid, draft: QuizDraft) {
      await wait(300);
      const id = uid(); const t = new Date().toISOString();
      const quiz: Quiz = { id, conversationId: cid, title: draft.title, description: draft.description, timeLimitSec: draft.timeLimitSec, source: "manual", createdAt: t, updatedAt: t, questions: toQuestions(id, draft.questions) };
      quizzes.unshift(quiz); return clone(quiz);
    },
    async updateQuiz(quizId, draft) {
      await wait(300);
      const quiz = findQuiz(quizId);
      Object.assign(quiz, { title: draft.title, description: draft.description, timeLimitSec: draft.timeLimitSec, updatedAt: new Date().toISOString(), questions: toQuestions(quizId, draft.questions) });
      return clone(quiz);
    },
    async deleteQuiz(quizId) {
      await wait(250);
      quizzes.splice(quizzes.findIndex((q) => q.id === quizId), 1);
      attempts = attempts.filter((a) => a.quizId !== quizId);
    },
    async generateWithAI(cid, o) {
      await wait(2200);
      return clone(generate(cid, "Đề ôn tập do AI tạo", o.questionCount, o.types, { source: "ai" }));
    },
    async generateFromDeck(cid, o) {
      await wait(900);
      return clone(generate(cid, "Đề nhanh từ bộ thẻ", o.questionCount, o.types, { source: "flashcard", sourceDeckId: o.deckId, sourceDeckName: "Bộ thẻ đã chọn" }));
    },
    async startAttempt(quizId, config) {
      await wait(150);
      const quiz = findQuiz(quizId);
      const answers: Record<string, AttemptAnswer> = {};
      config.questionOrder.forEach((id) => (answers[id] = emptyAnswer(id)));
      const max = quiz.questions.filter((q) => config.questionOrder.includes(q.id)).reduce((s, q) => s + q.points, 0);
      const att: QuizAttempt = { id: uid(), quizId, status: "in_progress", score: 0, maxScore: max, timeSpentSec: 0, startedAt: new Date().toISOString(), answers, config };
      attempts.unshift(att); return clone(att);
    },
    async saveAnswer(attemptId, answer) { const a = findAttempt(attemptId); a.answers[answer.questionId] = clone(answer); },
    async saveProgress(attemptId, sec) { findAttempt(attemptId).timeSpentSec = sec; },
    async submitAttempt(attemptId, sec, answers) {
      const att = findAttempt(attemptId);
      answers.forEach((a) => (att.answers[a.questionId] = clone(a)));
      att.timeSpentSec = sec;
      const quiz = findQuiz(att.quizId);
      const hasEssay = quiz.questions.some((q) => q.type === "essay" && att.config?.questionOrder.includes(q.id));
      if (hasEssay) await wait(2600); // giả lập thời gian AI chấm
      return put(gradeAttempt(quiz, att));
    },
    async overrideEvaluation(attemptId, questionId, status) {
      await wait(150);
      const att = findAttempt(attemptId);
      const q = findQuiz(att.quizId).questions.find((x) => x.id === questionId)!;
      att.answers[questionId].evaluationStatus = status;
      att.answers[questionId].pointsEarned = status === "correct" ? q.points : status === "partial" ? q.points / 2 : 0;
      att.score = Math.round(Object.values(att.answers).reduce((s, a) => s + a.pointsEarned, 0) * 100) / 100;
      return put(att);
    },
    async convertToFlashcards(_attemptId, questionIds, target) {
      await wait(700);
      return { deckId: target.deckId ?? uid(), created: questionIds.length };
    },
  };
}
