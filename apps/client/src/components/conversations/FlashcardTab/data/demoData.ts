import type { AiConfig, CardDraft, CardStatus, CardType, Deck, Flashcard } from "../types";

const card = (
  id: string,
  deckId: string,
  type: CardType,
  front: string,
  back: string,
  status: CardStatus,
  dueInDays: number,
  intervalDays = 0
): Flashcard => ({ id, deckId, type, front, back, status, dueInDays, intervalDays, ease: 2.5 });

// Đã loại bỏ Mock Data DEMO_DECKS để sử dụng dữ liệu thực từ Backend Database
export const DEMO_DECKS: Deck[] = [];

export const DEMO_CARDS: Flashcard[] = [
  card("c1", "d1", "basic", "Stack hoạt động theo nguyên tắc nào?", "LIFO – Last In, First Out", "new", 0),
  card("c2", "d1", "basic", "Queue hoạt động theo nguyên tắc nào?", "FIFO – First In, First Out", "learning", 0, 1),
  card("c3", "d1", "cloze", "Thêm phần tử vào stack gọi là {{push}}, lấy phần tử ra gọi là {{pop}}.", "Cả hai thao tác đều có độ phức tạp O(1).", "review", 3, 3),
  card("c4", "d1", "typein", "Thuật toán BFS dùng cấu trúc dữ liệu nào để lưu các đỉnh chờ duyệt?", "queue", "new", 0),
  card("c5", "d1", "basic", "Linked list khác array ở điểm nào?", "Linked list chèn/xóa nhanh hơn nhưng truy cập ngẫu nhiên chậm hơn.", "review", 6, 6),
  card("c6", "d2", "basic", "Độ phức tạp của tìm kiếm nhị phân?", "O(log n)", "review", 4, 4),
  card("c7", "d2", "cloze", "Quick Sort có độ phức tạp trung bình là {{O(n log n)}}.", "Trường hợp xấu nhất là O(n²).", "learning", 0, 1),
  card("c8", "d2", "typein", "Độ phức tạp của Bubble Sort trong trường hợp xấu nhất (Big-O)?", "O(n^2)", "new", 0),
];

/** Mock: sinh thẻ AI — thay bằng lời gọi API thực tế */
export function buildAiCards({ count, types }: AiConfig): CardDraft[] {
  const pool: CardType[] = types.length ? types : ["basic"];
  return Array.from({ length: count }, (_, i) => {
    const type = pool[i % pool.length];
    const n = i + 1;
    if (type === "cloze")
      return { type, front: `Tài liệu đề cập đến {{khái niệm ${n}}} như một ý chính.`, back: "" };
    if (type === "typein")
      return { type, front: `Thuật ngữ nào mô tả ý chính số ${n} của tài liệu?`, back: `thuật ngữ ${n}` };
    return { type, front: `Ý chính số ${n} trong tài liệu là gì?`, back: "Nội dung được AI trích xuất từ tài liệu của bạn." };
  });
}
