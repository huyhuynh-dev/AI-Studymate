# AI StudyMate — Backend API

Dự án này là Backend API cho hệ thống AI StudyMate, được xây dựng dựa trên framework **NestJS**, sử dụng **Prisma ORM** để tương tác với cơ sở dữ liệu **PostgreSQL**.

## 🚀 Các thiết lập đã hoàn thành (Giai đoạn khởi tạo)

Tính đến thời điểm hiện tại, ứng dụng Backend đã được cấu hình các nền tảng cốt lõi sau:

1. **Khởi tạo Framework:**
   - Cài đặt NestJS thành công trong kiến trúc Monorepo (sử dụng pnpm).
   - Chuyển đổi cổng mặc định từ `3000` sang `3001` để tránh xung đột với các ứng dụng Frontend.

2. **Cấu hình Cơ sở dữ liệu (Database & ORM):**
   - Cài đặt và tích hợp thành công **Prisma ORM (v7)**.
   - Kết nối với cơ sở dữ liệu **PostgreSQL** đang chạy trên Docker thông qua biến môi trường `DATABASE_URL`.
   - **Tích hợp AI-Ready:** Đã kích hoạt extension `pgvector` (thông qua `previewFeatures = ["postgresqlExtensions"]` trong schema) để chuẩn bị cho tính năng Semantic Search và RAG sau này.
   - Định nghĩa model `User` đầu tiên và thực thi migration thành công.
   - Cấu hình xuất Prisma Client vào thư mục nội bộ: `./src/generated/prisma`.

3. **Tích hợp Monorepo:**
   - Cấu hình lệnh `"dev": "nest start --watch"` trong `package.json` để tương thích hoàn toàn với trình quản lý tác vụ Turborepo từ thư mục gốc.

## 🛠 Yêu cầu môi trường

- Node.js v24 LTS
- pnpm (Package Manager)
- Cơ sở dữ liệu PostgreSQL (có cài sẵn extension pgvector) chạy qua Docker ở cổng `5432`.

## 📁 Biến môi trường (.env)

Tạo một file `.env` ở thư mục gốc của backend (`apps/backend/.env`) với nội dung:

```env
DATABASE_URL="postgresql://studymate:studymate_db_secret@localhost:5432/studymate?schema=public"
```

## 💻 Các lệnh thao tác (Scripts)

Nên chạy các lệnh này từ thư mục gốc của Monorepo thông qua Turborepo, hoặc chạy trực tiếp tại thư mục `apps/backend` bằng `pnpm`:

* `pnpm dev`: Khởi động server ở chế độ watch mode (tại cổng 3001).
* `pnpm build`: Biên dịch mã TypeScript sang JavaScript để chuẩn bị deploy.
* `pnpm prisma generate`: Cập nhật và tạo lại Prisma Client sau mỗi lần thay đổi file `schema.prisma`.
* `pnpm prisma migrate dev`: Áp dụng các thay đổi trong schema vào cơ sở dữ liệu và lưu lại lịch sử migration.

## 🏗 Kiến trúc dự kiến tiếp theo

Theo tài liệu phân tích hệ thống, các module tiếp theo sẽ được phát triển bao gồm:

* `AuthModule`: Xác thực JWT, đăng ký, đăng nhập.
* `DocumentModule`: Xử lý upload tài liệu.
* `ChatModule`: Luồng RAG giao tiếp với tài liệu.
