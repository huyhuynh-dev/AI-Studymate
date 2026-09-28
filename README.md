# AI StudyMate — Monorepo Workspace

**AI StudyMate** là ứng dụng web hỗ trợ học tập thông minh, cho phép người dùng tải lên tài liệu học tập và sử dụng AI để tóm tắt, tạo flashcard, sinh câu hỏi kiểm tra, và trò chuyện trực tiếp với nội dung tài liệu (RAG)[cite: 1].

Dự án này được quản lý theo kiến trúc **Monorepo** sử dụng **pnpm** và **Turborepo**[cite: 1], giúp chia sẻ mã nguồn và quản lý các ứng dụng con một cách hiệu quả.

---

## 🏗 Cấu trúc Workspace

Dự án bao gồm 3 ứng dụng chính (apps) và các gói dùng chung (packages):

- `apps/client`: Giao diện người dùng chính (Next.js 16, cổng 3000)[cite: 1].
- `apps/backend`: API server xử lý logic và database (NestJS, cổng 3001)[cite: 1].
- `apps/admin`: Bảng điều khiển quản trị hệ thống (Next.js 16, cổng 3002)[cite: 1].
- `packages/ui` (Dự kiến): Thư viện React component dùng chung (shadcn/ui + Tailwind CSS)[cite: 1].

## 🛠 Công nghệ cốt lõi

- **Quản lý gói & Build:** Node.js v24 LTS, pnpm, Turborepo.
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS[cite: 1].
- **Backend:** NestJS, Prisma ORM v7[cite: 1].
- **Database & Services:** PostgreSQL 16 (với extension `pgvector`)[cite: 1], Redis (chạy qua Docker Compose).
- **Storage:** Cloudflare R2 (kết nối trực tiếp qua S3 SDK)[cite: 1].

---

## 🚀 Hướng dẫn khởi chạy (Getting Started)

### 1. Yêu cầu hệ thống

- Cài đặt Node.js v24.x và pnpm.
- Cài đặt và khởi chạy Docker Desktop (dành cho Database và Redis).

### 2. Khởi chạy Services nền (Docker)

Tại thư mục gốc, khởi động PostgreSQL và Redis:

```bash
docker compose up -d
```
