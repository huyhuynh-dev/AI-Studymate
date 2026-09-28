# AI StudyMate — Admin Web

Dự án này là trang Quản trị (Admin Panel) cho hệ thống AI StudyMate, được xây dựng bằng **Next.js 14+ (App Router)** kết hợp với **TypeScript** và **Tailwind CSS**.

## 🚀 Các thiết lập đã hoàn thành (Giai đoạn khởi tạo)

Tính đến thời điểm hiện tại, ứng dụng Admin Web đã được cấu hình với các thành phần cốt lõi sau:

1. **Khởi tạo Framework:**
   - Khởi tạo Next.js với cấu trúc thư mục `src/app`.
   - Tích hợp sẵn Tailwind CSS để xây dựng giao diện nhanh chóng.
   - Cấu hình chạy trên cổng `3002` để hoạt động song song không xung đột với Client Web (3000) và Backend (3001).

2. **Tích hợp Monorepo & Khắc phục lỗi:**
   - Liên kết thành công với Turborepo (cấu hình lệnh `"dev": "next dev -p 3002"`).
   - Xử lý triệt để lỗi xung đột định tuyến root workspace của Turbopack bằng cách thiết lập `turbopack: { root: path.join(__dirname, "../..") }` trong `next.config.ts`.
   - Loại bỏ file `pnpm-lock.yaml` cục bộ để đảm bảo quản lý dependency tập trung hoàn toàn từ thư mục gốc của Monorepo.

## 🛠 Yêu cầu môi trường

- Node.js v24 LTS
- pnpm (Package Manager)

## 💻 Các lệnh thao tác (Scripts)

Nên chạy các lệnh này từ thư mục gốc của Monorepo thông qua Turborepo, hoặc chạy trực tiếp tại `apps/admin`:

- `pnpm dev`: Khởi động ứng dụng trong môi trường phát triển (tại `http://localhost:3002`).
- `pnpm build`: Build ứng dụng, tối ưu hóa các trang thành file tĩnh hoặc server-rendered (chuẩn bị cho production).
- `pnpm lint`: Chạy trình kiểm tra lỗi cú pháp (ESLint).

## 🏗 Kiến trúc dự kiến tiếp theo

Theo tài liệu phân tích thiết kế, trang Admin Web sẽ đảm nhận các tính năng:
- Bảng điều khiển (Dashboard) thống kê dữ liệu hệ thống tổng quan.
- Bảng quản lý người dùng (xem danh sách, khóa/mở tài khoản).
- Giám sát trạng thái hàng đợi nền (BullMQ Queue) cho các tác vụ xử lý tài liệu và AI.
- Cấu hình các thông số hệ thống (giới hạn file, chọn AI Provider).
