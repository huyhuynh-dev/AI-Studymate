import type { DocumentOption } from "../types";

/** Dữ liệu giả để test bộ chọn tài liệu. Xóa file này khi truyền `documents` thật vào <QuizTab />. */
export const MOCK_DOCUMENTS: DocumentOption[] = [
  { id: "doc-1", name: "Chương 1 - Tổng quan cấu trúc dữ liệu.pdf", meta: "PDF · 24 trang" },
  { id: "doc-2", name: "Chương 2 - Mảng và danh sách liên kết.pdf", meta: "PDF · 38 trang" },
  { id: "doc-3", name: "Chương 3 - Ngăn xếp và hàng đợi.pdf", meta: "PDF · 21 trang" },
  { id: "doc-4", name: "Chương 4 - Cây nhị phân tìm kiếm.pdf", meta: "PDF · 46 trang" },
  { id: "doc-5", name: "Chương 5 - Đồ thị và duyệt đồ thị.pdf", meta: "PDF · 52 trang" },
  { id: "doc-6", name: "Bài tập thực hành tuần 3.png", meta: "Hình ảnh · 1,2 MB" },
  { id: "doc-7", name: "Đề cương ôn tập giữa kỳ.pdf", meta: "PDF · 8 trang" },
  { id: "doc-8", name: "Slide bài giảng - Sắp xếp và tìm kiếm.pdf", meta: "PDF · 60 trang" },
];
