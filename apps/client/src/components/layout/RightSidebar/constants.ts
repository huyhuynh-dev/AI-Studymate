import {
  CalendarDays,
  HelpCircle,
  Lightbulb,
  Network,
  type LucideIcon,
} from "lucide-react";
import type {
  AIModelItem,
  ChatMessage,
  ChatSessionItem,
  EffortLevel,
  EffortOption,
  WorkspaceDoc,
} from "./types";

export const ASSISTANT_NAME = "StudyMate AI";

export const AVAILABLE_MODELS: AIModelItem[] = [
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    desc: "Nhanh và hiệu quả cho tác vụ thường ngày",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    desc: "Mạnh mẽ nhất cho tác vụ phức tạp",
  },
  {
    id: "gpt-4-1-mini",
    name: "GPT-4.1 Mini",
    desc: "Cân bằng giữa tốc độ và khả năng",
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    desc: "Phân tích chuyên sâu & lập trình xuất sắc",
  },
];

export const DEFAULT_MODEL_ID = AVAILABLE_MODELS[0].id;
export const DEFAULT_EFFORT: EffortLevel = "medium";

export const EFFORT_LEVELS: EffortOption[] = [
  { key: "low", label: "Thấp" },
  { key: "medium", label: "Trung bình", isDefault: true },
  { key: "high", label: "Cao" },
  { key: "extra", label: "Rất cao" },
  { key: "max", label: "Tối đa" },
];

export const STARTER_PROMPTS: { icon: LucideIcon; label: string }[] = [
  { icon: Lightbulb, label: "Tóm tắt 3 ý chính của tài liệu" },
  { icon: Network, label: "Giải thích cơ chế cây BST" },
  { icon: HelpCircle, label: "Tạo 5 câu trắc nghiệm nhanh" },
  { icon: CalendarDays, label: "Lập lộ trình ôn tập tuần này" },
];

// ─────────────────────────────────────────────
// Dữ liệu mẫu (dùng khi chưa có dữ liệu thật từ server)
// ─────────────────────────────────────────────

export const DEFAULT_SAMPLE_CONVERSATIONS: ChatSessionItem[] = [
  {
    id: "sample-1",
    title: "Hỏi về Độ phức tạp cây BST cân bằng",
    lastMessage: "AI: Chiều cao tối ưu h ≈ log2(n) giúp ngăn chặn trường hợp...",
    lastMessageRole: "ai",
    timestamp: "10:42",
    contextTag: "Trang 12",
    rawDate: new Date(),
  },
  {
    id: "sample-2",
    title: "Giải thích thuật toán xoay cây AVL (Left-Right)",
    lastMessage: "Bạn: Cho mình ví dụ minh họa trực quan trường hợp mất c...",
    lastMessageRole: "user",
    timestamp: "Hôm qua",
    messageCount: 14,
    rawDate: new Date(Date.now() - 86400000),
  },
  {
    id: "sample-3",
    title: "Tạo bộ 10 câu trắc nghiệm Cây nhị phân",
    lastMessage: "AI: Đã khởi tạo 10 câu hỏi kiểm tra độ hiểu bài kèm giải thí...",
    lastMessageRole: "ai",
    timestamp: "2 ngày trước",
    messageCount: 8,
    rawDate: new Date(Date.now() - 2 * 86400000),
  },
  {
    id: "sample-4",
    title: "So sánh Red-Black Tree và AVL Tree",
    lastMessage: "Bạn: Khi nào nên ưu tiên dùng Red-Black Tree thay vì AVL...",
    lastMessageRole: "user",
    timestamp: "5 ngày trước",
    messageCount: 19,
    rawDate: new Date(Date.now() - 5 * 86400000),
  },
];

export const SAMPLE_ACTIVE_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    role: "user",
    content:
      "Giải thích cho mình vì sao cây BST cân bằng lại đảm bảo được độ phức tạp O(log n) khi tìm kiếm so với cây thông thường?",
    timestamp: "10:42",
  },
  {
    id: "msg-2",
    role: "ai",
    content:
      "Chào bạn! Dưới đây là 3 lý do cốt lõi giúp cây BST cân bằng đạt hiệu năng vượt trội:",
    timestamp: "10:42",
    hasCitation: true,
    citation: "Nguồn: Trang 12 – Mục 4.2 Cân bằng cây",
    bullets: [
      {
        title: "Chiều cao tối ưu h ≈ log₂(n):",
        desc: "Các cây tự cân bằng (AVL, Red-Black) đảm bảo chiều cao chỉ tăng theo logarit số phần tử.",
      },
      {
        title: "Triệt tiêu suy biến:",
        desc: "Ngăn chặn trường hợp xấu nhất cây biến thành danh sách liên kết dẫn tới chi phí O(n).",
      },
      {
        title: "Nguyên lý chia để trị:",
        desc: "Mỗi bước so sánh rẽ nhánh sẽ loại bỏ ngay 50% số nút còn lại trong không gian tìm kiếm.",
      },
    ],
  },
];

/** Danh sách tài liệu mẫu khi hook useDocuments chưa trả về gì */
export const SAMPLE_WORKSPACE_DOCS: WorkspaceDoc[] = [
  { id: "ws-1", file_name: "Giao_trinh_CTDL_GT.pdf" },
  { id: "ws-2", file_name: "Slide_Chuong_4_Cay_Nhi_Phan.pdf" },
  { id: "ws-3", file_name: "De_cuong_on_tap_giua_ky.docx" },
];
