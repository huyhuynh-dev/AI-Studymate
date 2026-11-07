# Hướng dẫn ghép nối & triển khai giao diện QuizTab

> Thư mục `QuizTab/` là giao diện hoàn chỉnh cho tab **Bài kiểm tra** (8 màn hình A1–A4, B1–B4 theo đặc tả), thiết kế theo Apple HIG, hỗ trợ Light/Dark và mọi kích thước màn hình.
> Mặc định component chạy bằng **dữ liệu giả lập** để bạn xem ngay giao diện. Khi nối Backend, chỉ cần viết một object `QuizApi` (mục 3), không phải sửa giao diện.

> ⚠️ **Trạng thái kiểm tra:** môi trường tạo code không có mạng nên **chưa chạy thử `next dev`**; mình chỉ rà soát kiểu/cú pháp bằng `tsc` (các lỗi còn lại đều do thiếu `@types/react` trong môi trường đó). Hãy chạy `pnpm lint` và `pnpm exec tsc --noEmit` ngay sau khi chép vào dự án; nếu có lỗi nhỏ, báo lại để chỉnh.

---

## 1. Cấu trúc thư mục

```
QuizTab/
├─ quiztab.tsx                 ← Component tổng (điều phối màn hình, modal, toast)
├─ quiztab.css                 ← Token màu ngữ nghĩa + animation (tự import trong quiztab.tsx)
├─ index.ts                    ← Barrel export
├─ types.ts                    ← Kiểu dữ liệu (ánh xạ Quiz_DatabaseSchema.md)
├─ utils.ts · constants.ts     ← Hàm chấm khách quan, định dạng, nhãn, tone màu
├─ data/
│  ├─ quizApi.ts               ← ★ Interface QuizApi — hợp đồng với Backend
│  └─ mockApi.ts               ← API giả lập in-memory (xóa khi có API thật)
├─ hooks/
│  ├─ useQuizStore.ts          ← State đề + lượt làm bài, lưu nháp debounce 600ms
│  └─ useQuizTimer.ts          ← Đồng hồ đếm lên / đếm ngược, tự nộp khi hết giờ
├─ ui/                         ← Primitives (Button, Modal, Menu, Switch, ScoreRing…),
│                                RichTextInput (TipTap), RichTextView, ChoiceList, badges
├─ list/                       ← A1 Empty · A2 Danh sách · QuizCard
├─ create/                     ← A3 Dialog chọn nguồn · Builder soạn đề · QuestionEditor
├─ detail/                     ← A4 Chi tiết đề + biểu đồ tiến bộ + lịch sử
├─ take/                       ← B1 Setup · B2 Làm bài · Palette · B3 Chấm AI
└─ result/                     ← B4 Kết quả · ReviewCard · Dialog chuyển Flashcard
```

## 2. Cài đặt (3 bước, không cần cài thêm package)

1. Chép nguyên thư mục `QuizTab` vào `src/components/` → `src/components/QuizTab/`.
2. **Không cần sửa `globals.css` / `package.json`.** Giao diện chỉ dùng thứ có sẵn:
   - Token: `--background`, `--surface-card`, `--brand-primary`, `--border-subtle`, `--on-surface-variant`… và các class `apple-liquid-glass`, `apple-spring`, `no-scrollbar` trong `globals.css`.
   - Package: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extensions`, `@tiptap/core`, `lucide-react`, `dompurify` (đều đã có).
   - Căn lề TipTap được viết sẵn trong `ui/RichTextInput.tsx` nên **không cần** cài `@tiptap/extension-text-align`.
   - Các màu phụ (thành công, cảnh báo, AI…) nằm trong `quiztab.css` dưới tên `--qz-*`, có sẵn bản Dark Mode.
3. Gắn vào tab (ví dụ trang `home/[subjectId]/[conversationId]`):

```tsx
import QuizTab from "@/components/QuizTab/quiztab";

// bên trong nội dung tab "Quiz" (cùng cấp FlashcardTab / SummaryTab)
<QuizTab
  conversationId={conversationId}
  decks={decks}                               // [{ id, name, cardCount }] lấy từ dữ liệu Flashcard
  api={quizApi}                               // bỏ trống = dữ liệu giả lập
  onFlashcardsCreated={() => mutateDecks()}   // (tuỳ chọn) làm mới tab Flashcard
/>
```

**Yêu cầu bố cục:** thẻ cha cần có chiều cao xác định (`h-full` / `flex-1 min-h-0`). `QuizTab` tự cuộn bên trong (`overflow-y-auto`) và tự giữ thanh trạng thái làm bài dính ở đỉnh. Nếu tab của bạn cuộn ở cấp trang, đổi `h-full min-h-0 overflow-y-auto` ở thẻ gốc trong `quiztab.tsx` thành `min-h-full`.

Muốn xem thử ngay: tạo trang tạm `app/(main)/TestPage/page.tsx` với `<div className="h-dvh"><QuizTab conversationId="demo" decks={[{ id: "d1", name: "Thuật toán tìm kiếm", cardCount: 20 }]} /></div>`.

## 3. Nối Backend thật (`data/quizApi.ts`)

Viết một object thoả `QuizApi`, ví dụ dùng `axios` qua proxy sẵn có của dự án:

```ts
// src/services/quizApi.ts
import axios from "axios";
import type { QuizApi } from "@/components/QuizTab/data/quizApi";
import { mapQuiz, mapAttempt, toQuizPayload } from "./quizMappers"; // snake_case ⇄ camelCase

const http = axios.create({ baseURL: "/api/proxy" });

export const quizApi: QuizApi = {
  listQuizzes: (cid) => http.get(`/conversations/${cid}/quizzes`).then((r) => r.data.map(mapQuiz)),
  listAttempts: (qid) => http.get(`/quizzes/${qid}/attempts`).then((r) => r.data.map(mapAttempt)),
  createQuiz: (cid, d) => http.post(`/conversations/${cid}/quizzes`, toQuizPayload(d)).then((r) => mapQuiz(r.data)),
  updateQuiz: (id, d) => http.put(`/quizzes/${id}`, toQuizPayload(d)).then((r) => mapQuiz(r.data)),
  deleteQuiz: (id) => http.delete(`/quizzes/${id}`).then(() => undefined),
  generateWithAI: (cid, o) => http.post(`/conversations/${cid}/quizzes/generate`, o).then((r) => mapQuiz(r.data)),
  generateFromDeck: (cid, o) => http.post(`/conversations/${cid}/quizzes/from-deck`, o).then((r) => mapQuiz(r.data)),
  startAttempt: (qid, config) => http.post(`/quizzes/${qid}/attempts`, { config }).then((r) => mapAttempt(r.data)),
  saveAnswer: (aid, a) => http.put(`/attempts/${aid}/answers/${a.questionId}`, a).then(() => undefined),
  saveProgress: (aid, sec) => http.patch(`/attempts/${aid}`, { time_spent_sec: sec }).then(() => undefined),
  submitAttempt: (aid, sec, answers) => http.post(`/attempts/${aid}/submit`, { time_spent_sec: sec, answers }).then((r) => mapAttempt(r.data)),
  overrideEvaluation: (aid, qid, status) => http.patch(`/attempts/${aid}/answers/${qid}/evaluation`, { status }).then((r) => mapAttempt(r.data)),
  convertToFlashcards: (aid, ids, target) => http.post(`/attempts/${aid}/to-flashcards`, { question_ids: ids, ...target }).then((r) => r.data),
};
```

Các endpoint trên chỉ là gợi ý — đổi theo Backend của bạn, miễn hàm trả về đúng kiểu trong `types.ts`.

### Quy ước dữ liệu cần Backend tuân theo

| Chủ đề | Quy ước |
|---|---|
| Ánh xạ cột | `question_text`→`text`, `time_limit_sec`→`timeLimitSec`, `selected_option_ids`→`selectedOptionIds`, `is_correct`→`isCorrect`, `grading_criteria`→`gradingCriteria`… (xem `types.ts`) |
| `true_false` | `options` luôn là 2 phần tử có `id` = `"true"` và `"false"` (nhãn "Đúng"/"Sai"), một trong hai `isCorrect: true`. |
| `short_answer` | `sample_answer` chứa đáp án; nhiều cách viết đúng ngăn cách bằng `\|` (vd `SM-2\|SM2`). So khớp không phân biệt hoa thường và bỏ dấu câu. |
| `essay` | `question_text`, `sample_answer`, `explanation`, `text_answer` là **HTML từ TipTap**. Backend nên sanitize khi lưu và `strip HTML` trước khi đưa vào prompt chấm điểm. |
| Chấm điểm | Backend là nguồn sự thật: chấm khách quan + gọi AI (prompt ở Phần 6 tài liệu kỹ thuật, nên dùng `generateObject` của `ai` + `zod` với `@ai-sdk/google`) trong `submitAttempt`, trả về `QuizAttempt` đã có `answers[...]` gồm `evaluationStatus`, `pointsEarned`, `matchedPoints`, `missingPoints`, `aiFeedback`. Phần "ý đúng/ý thiếu" của B4 cần AI trả thêm 2 mảng này (schema DB đã có sẵn cột). |
| Chấm nhiều đáp án | Đúng hết = trọn điểm; đúng một phần = `điểm × (đúng − sai) / tổng đúng` (làm tròn 2 số). Logic mẫu ở `evaluateObjective` trong `utils.ts`. |
| Tự điều chỉnh điểm | Đúng = 100% điểm câu, Một phần = 50%, Sai = 0; Backend cập nhật lại `score` của lượt. |
| Lưu nháp | `saveAnswer` là UPSERT theo `(attempt_id, question_id)` (đúng `uq_attempt_question`). |

### 3 điểm lệch nhỏ giữa giao diện và schema hiện tại

1. **`Quiz.source` (`ai` / `flashcard` / `manual`)** để hiện nhãn nguồn đề — schema chưa có cột. Đề xuất thêm `quizzes.source VARCHAR(16)`; tạm thời có thể suy ra: có `source_deck_id` → `flashcard`, còn lại → `manual`/`ai` tuỳ API tạo.
2. **`QuizAttempt.config`** (chế độ Luyện tập/Thi thử, thứ tự câu & đáp án đã đảo, giới hạn giờ của lượt) — schema chưa lưu. Đề xuất `quiz_attempts.config JSONB`. Nếu không lưu, giao diện vẫn chạy (dùng thứ tự gốc, chế độ Thi thử) nhưng khi "Làm tiếp" sẽ mất thứ tự đã đảo.
3. **`sourceDeckName`** — join thêm tên bộ thẻ từ `flashcard_decks` khi trả `Quiz`.

> Lưu ý bảo mật: để chế độ **Luyện tập** báo đúng/sai tức thì, `options[].isCorrect` phải gửi xuống trình duyệt. Nếu cần chống lộ đáp án tuyệt đối cho chế độ Thi thử, hãy ẩn `isCorrect` ở API khi lượt làm là `exam` và đang `in_progress`, rồi đổi `evaluateObjective` sang gọi server cho riêng chế độ Luyện tập.

### Chuyển câu sai thành Flashcard
`convertToFlashcards(attemptId, questionIds, { deckId | newDeckName })`: Backend tạo thẻ với mặt trước = nội dung câu hỏi (text thuần), mặt sau = đáp án đúng / bài viết mẫu + giải thích, rồi trả `{ deckId, created }`. UI tự hiện thông báo và gọi `onFlashcardsCreated`.

## 4. Bản đồ màn hình ⇄ file

| Đặc tả | Màn hình | File |
|---|---|---|
| A1 | Chưa có đề (Empty State) | `list/QuizEmptyState.tsx` |
| A2 | Danh sách đề + thẻ đề | `list/QuizListView.tsx`, `list/QuizCard.tsx` |
| A3 | Chọn nguồn / sinh đề AI / từ Flashcard | `create/CreateQuizDialog.tsx` |
| A3 | Trình soạn đề thủ công & chỉnh sửa | `create/QuizBuilderView.tsx`, `create/QuestionEditor.tsx` |
| A4 | Chi tiết đề, biểu đồ tiến bộ, lịch sử, xem trước câu hỏi | `detail/QuizOverviewView.tsx`, `detail/ProgressChart.tsx` |
| B1 | Cấu hình lượt làm bài | `take/TestSetupModal.tsx` |
| B2 | Phòng làm bài (5 loại câu) + bảng điều hướng câu | `take/TestTakingView.tsx`, `take/QuestionPalette.tsx` |
| B3 | Chờ AI chấm | `take/GradingState.tsx` |
| B4 | Kết quả, cầu nối Flashcard, xem lại chi tiết | `result/ResultView.tsx`, `result/ReviewCard.tsx`, `result/FlashcardBridgeDialog.tsx` |

## 5. Các quyết định thiết kế (và vì sao khác đặc tả một chút)

Giao diện bám đúng chức năng của tài liệu kỹ thuật; vài chỗ mình đổi cách thể hiện để hợp triết lý Apple HIG:

- **Mỗi màn hình đúng 1 nút chính (filled).** Danh sách: chỉ "Tạo đề mới" là nút đặc; nút "Làm bài" trên từng thẻ dùng kiểu *tinted* (nền nhạt) để 6 thẻ không tranh nhau. Phòng làm bài: "Câu tiếp theo" là nút chính, ở câu cuối nó thành "Nộp bài"; nút "Nộp bài" trên thanh trên cùng luôn là kiểu *tinted*.
- **Không có thao tác chỉ dựa vào đoán:** nút luôn có chữ (hoặc `aria-label` + tooltip nếu chỉ có icon); trạng thái chọn có đủ 3 tín hiệu (màu + viền + dấu tích), không chỉ dựa vào màu.
- **Tiết lộ lũy tiến:** "Xem trước câu hỏi", "Giải thích đáp án", "Thêm ảnh/âm thanh", "Tự điều chỉnh điểm" đều thu gọn mặc định.
- **Phòng làm bài:** thanh trạng thái dùng vật liệu kính (`apple-liquid-glass`) dính đầu trang; trên mobile bảng câu hỏi chuyển thành dải số cuộn ngang (vùng chạm 44px) thay vì cột phụ.
- **Hình học & chữ:** góc bo đồng tâm (thẻ 24 − đệm 8 = khay 16; menu 16 − 6 = 10; segmented 12 − 4 = 8), lưới 8pt, tiêu đề siết `letter-spacing` âm, mọi con số dùng `tabular-nums` (đồng hồ, điểm, bộ đếm từ).
- **Dark Mode:** phân tầng bằng độ sáng nền + viền 1px mảnh, **không dùng bóng đổ đen** (token `--qz-shadow-*` tự về `none`); màu ngữ nghĩa có bản sáng riêng để giữ tương phản ≥ 4.5:1.
- **Chuyển động:** easing lò xo `cubic-bezier(0.22,1,0.36,1)`, phản hồi `active:scale-[0.98]` tức thì; tôn trọng `prefers-reduced-motion`.
- **Ô nhập dài dùng TipTap** (không dùng textarea): bài tự luận (thanh công cụ đầy đủ: in đậm, nghiêng, gạch chân, danh sách chấm/số, căn trái/giữa/phải, hoàn tác/làm lại, kèm đếm từ), đề bài/bài mẫu/giải thích trong trình soạn đề (thanh công cụ gọn).
- **Phím tắt khi làm bài:** `←` `→` chuyển câu, `1–8` hoặc `A–H` chọn đáp án, `F` đánh dấu xem lại (tự tắt khi đang gõ trong ô nhập).
- **Hết giờ:** đồng hồ đếm ngược chuyển đỏ + nhịp nhẹ khi còn ≤ 60 giây; hết giờ tự nộp bài.
- **Trợ năng:** focus ring rõ ở mọi control, `role`/`aria-*` cho radio/checkbox/switch/dialog/progress, biểu đồ có mô tả văn bản, Modal đóng bằng `Esc`.

## 6. Tuỳ biến nhanh

| Muốn đổi | Sửa ở |
|---|---|
| Màu thương hiệu | `globals.css` (`--brand-primary`…) — toàn bộ QuizTab tự theo |
| Màu Đúng / Một phần / Sai / AI | `quiztab.css` (`--qz-success`, `--qz-warning`, `--qz-danger`, `--qz-ai`) |
| Nhãn, tên loại câu hỏi | `constants.ts` |
| Thang điểm hiển thị (hiện là /10) | `toScale10` trong `utils.ts` |
| Ngưỡng nhận xét điểm | `scoreLabel` trong `utils.ts` |
| Ngưỡng cảnh báo hết giờ (60s) | `danger` trong `take/TestTakingView.tsx` |
| Thay TipTap dùng chung với FlashcardTab | thay thân `ui/RichTextInput.tsx` (giữ nguyên props) |

## 7. Checklist nghiệm thu sau khi ghép

- [ ] `pnpm lint` và `pnpm exec tsc --noEmit` không báo lỗi trong `src/components/QuizTab`.
- [ ] Light và Dark Mode: chuyển theme hệ điều hành, kiểm tra thẻ, modal, toast, biểu đồ.
- [ ] Mobile 375px: dải số câu cuộn ngang, modal hiện dạng bottom sheet, không tràn ngang.
- [ ] Luồng đầy đủ: tạo đề → làm bài (Luyện tập) → nộp → chờ AI → xem kết quả → "Chỉ làm lại câu chưa đúng" → chuyển câu sai thành Flashcard.
- [ ] Reload khi đang làm dở → danh sách hiện "Đang làm dở" → "Làm tiếp" khôi phục đúng câu trả lời đã lưu nháp.
- [ ] Bàn phím: Tab đi qua mọi control, `Esc` đóng modal/menu.
