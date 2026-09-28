# AI StudyMate — Client Web

Dự án này là giao diện người dùng chính (Frontend) của hệ thống AI StudyMate, dành cho sinh viên và người học. Ứng dụng được xây dựng bằng **Next.js 14+ (App Router)**, **TypeScript** và **Tailwind CSS**.

## 🚀 Các thiết lập đã hoàn thành (Giai đoạn khởi tạo)

Tính đến thời điểm hiện tại, ứng dụng Client Web đã hoàn tất các thiết lập nền tảng:

1. **Khởi tạo Framework:**
   - Cài đặt Next.js thành công với kiến trúc `src/app` (App Router).
   - Tích hợp Tailwind CSS để sẵn sàng xây dựng giao diện tùy chỉnh.
   - Ứng dụng được cấu hình chạy mặc định trên cổng `3000`.

2. **Tích hợp Monorepo & Khắc phục lỗi:**
   - Liên kết hoạt động trơn tru với trình quản lý Turborepo từ thư mục gốc.
   - Giải quyết triệt để lỗi không nhận diện đúng root workspace của Next.js (Turbopack) bằng cách thêm cấu hình `turbopack: { root: path.join(__dirname, "../..") }` vào file `next.config.ts`.
   - Xóa file `pnpm-lock.yaml` cục bộ, đảm bảo tính nhất quán của các dependency trong toàn bộ Monorepo.

## 🛠 Yêu cầu môi trường

- Node.js v24 LTS
- pnpm (Package Manager)

## 💻 Các lệnh thao tác (Scripts)

Nên chạy các lệnh này từ thư mục gốc của Monorepo (qua lệnh `pnpm dev`), hoặc chạy trực tiếp tại `apps/client`:

- `pnpm dev`: Khởi động ứng dụng trong môi trường phát triển (tại `http://localhost:3000`).
- `pnpm build`: Biên dịch ứng dụng sang các file tĩnh và server-rendered tối ưu cho production.
- `pnpm lint`: Chạy công cụ kiểm tra chất lượng code (ESLint).

## 🏗 Kiến trúc dự kiến tiếp theo

Theo tài liệu phân tích hệ thống, Client Web sẽ được phát triển với giao diện 3 cột linh hoạt và bao gồm các tính năng:
- **Left Sidebar:** Quản lý danh sách môn học và các cuộc trò chuyện.
- **Center Content:** Vùng nội dung chính chứa các tab: Tài liệu (PDF/Ảnh), Tóm tắt (BlockNote editor), Flashcard (Spaced Repetition FSRS-5), và Quiz (Trắc nghiệm/Tự luận).
- **Right Chat Panel:** Giao diện trò chuyện trực tiếp với AI (hỗ trợ Streaming RAG) để hỏi đáp về tài liệu.
