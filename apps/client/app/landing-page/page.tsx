import Image from "next/image";

/* ──────────────────────────── SVG Icon Components ──────────────────────────── */

function LogoIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#6C5CE7" />
      <path
        d="M10 22V10h5.5a4 4 0 010 8H13v4h-3zm3-7h2.5a1.5 1.5 0 000-3H13v3z"
        fill="#fff"
      />
      <circle cx="23" cy="14" r="3" fill="#A29BFE" />
    </svg>
  );
}

function SparklesIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  );
}

function BrainIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2a3.5 3.5 0 00-3.462 4.037A3.5 3.5 0 004 9.5a3.5 3.5 0 001.19 2.63A3.5 3.5 0 005 14a3.5 3.5 0 003.46 3.5H12V2.04A3.5 3.5 0 009.5 2z" />
      <path d="M14.5 2a3.5 3.5 0 013.462 4.037A3.5 3.5 0 0120 9.5a3.5 3.5 0 01-1.19 2.63A3.5 3.5 0 0119 14a3.5 3.5 0 01-3.46 3.5H12V2.04A3.5 3.5 0 0114.5 2z" />
      <path d="M12 2v20" />
    </svg>
  );
}

function BookOpenIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  );
}

function TargetIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function ChartIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function ShieldIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function CheckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function StarIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ArrowRightIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function PlayIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function QuoteIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" opacity={0.15}>
      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151C7.546 6.068 5.983 8.789 5.983 11H10v10H0z" />
    </svg>
  );
}

/* ──────────────────────────── Data ──────────────────────────── */

const features = [
  {
    icon: <BrainIcon className="w-7 h-7" />,
    title: "Trí tuệ nhân tạo thông minh",
    description:
      "AI phân tích phong cách học tập của bạn và đề xuất lộ trình học tập cá nhân hóa, giúp bạn tiếp thu kiến thức hiệu quả hơn.",
  },
  {
    icon: <BookOpenIcon className="w-7 h-7" />,
    title: "Kho tài liệu phong phú",
    description:
      "Truy cập hàng ngàn bài giảng, tài liệu tham khảo và bài tập thực hành được biên soạn bởi đội ngũ chuyên gia.",
  },
  {
    icon: <TargetIcon className="w-7 h-7" />,
    title: "Học tập có mục tiêu",
    description:
      "Thiết lập mục tiêu học tập rõ ràng, theo dõi tiến độ và nhận phản hồi tức thì để liên tục cải thiện.",
  },
  {
    icon: <ChartIcon className="w-7 h-7" />,
    title: "Phân tích & báo cáo chi tiết",
    description:
      "Dashboard trực quan với biểu đồ phân tích hiệu suất học tập, điểm mạnh và điểm yếu cần cải thiện.",
  },
  {
    icon: <SparklesIcon className="w-7 h-7" />,
    title: "Tạo đề thi tự động",
    description:
      "AI tự động tạo đề thi, câu hỏi ôn tập dựa trên nội dung bạn đã học, giúp củng cố kiến thức toàn diện.",
  },
  {
    icon: <ShieldIcon className="w-7 h-7" />,
    title: "Bảo mật & an toàn",
    description:
      "Dữ liệu học tập của bạn được bảo vệ an toàn tuyệt đối với công nghệ mã hóa tiên tiến nhất.",
  },
];

const steps = [
  {
    step: "01",
    title: "Đăng ký tài khoản",
    description: "Tạo tài khoản miễn phí chỉ trong vài giây. Bạn có thể đăng nhập bằng Google hoặc email cá nhân.",
  },
  {
    step: "02",
    title: "Tải lên tài liệu",
    description: "Upload bài giảng, slide, sách hoặc ghi chú. AI sẽ phân tích và tổ chức nội dung cho bạn.",
  },
  {
    step: "03",
    title: "AI tạo nội dung học tập",
    description: "Hệ thống AI tự động tạo flashcard, câu hỏi ôn tập, tóm tắt và lộ trình học tập cá nhân hóa.",
  },
  {
    step: "04",
    title: "Học & theo dõi tiến độ",
    description: "Bắt đầu học với các công cụ tương tác và theo dõi tiến độ qua dashboard trực quan.",
  },
];

const testimonials = [
  {
    name: "Nguyễn Minh Anh",
    role: "Sinh viên Đại học Bách Khoa",
    content:
      "AI StudyMate đã thay đổi hoàn toàn cách tôi học tập. Từ khi sử dụng, điểm số của tôi cải thiện rõ rệt và tôi tiết kiệm được rất nhiều thời gian ôn tập.",
    rating: 5,
  },
  {
    name: "Trần Đức Hùng",
    role: "Giảng viên Đại học Quốc gia",
    content:
      "Một công cụ tuyệt vời cho cả giảng viên và sinh viên. Tôi sử dụng để tạo đề thi và bài tập cho sinh viên, tiết kiệm rất nhiều thời gian soạn bài.",
    rating: 5,
  },
  {
    name: "Lê Thị Hương",
    role: "Học sinh THPT chuyên",
    content:
      "Mình rất thích tính năng tạo flashcard tự động. Chỉ cần upload bài giảng, AI sẽ tạo ra bộ flashcard hoàn chỉnh giúp mình ôn thi hiệu quả hơn rất nhiều.",
    rating: 5,
  },
];

const pricingPlans = [
  {
    name: "Miễn phí",
    price: "0",
    period: "mãi mãi",
    description: "Dành cho cá nhân mới bắt đầu",
    features: [
      "Upload tối đa 5 tài liệu",
      "Tạo 20 flashcard / tháng",
      "Tóm tắt tài liệu cơ bản",
      "1 bài quiz / ngày",
      "Hỗ trợ qua email",
    ],
    cta: "Bắt đầu miễn phí",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "99.000",
    period: "tháng",
    description: "Dành cho sinh viên & học sinh",
    features: [
      "Upload không giới hạn tài liệu",
      "Flashcard không giới hạn",
      "Tóm tắt tài liệu nâng cao",
      "Quiz không giới hạn",
      "AI trợ lý học tập 24/7",
      "Phân tích hiệu suất chi tiết",
      "Xuất PDF & chia sẻ",
    ],
    cta: "Nâng cấp Pro",
    highlighted: true,
  },
  {
    name: "Doanh nghiệp",
    price: "Liên hệ",
    period: "",
    description: "Dành cho trường học & tổ chức",
    features: [
      "Tất cả tính năng Pro",
      "Quản lý nhóm & lớp học",
      "Báo cáo & phân tích nâng cao",
      "API tích hợp",
      "Hỗ trợ ưu tiên 24/7",
      "Tùy chỉnh thương hiệu",
      "SLA cam kết uptime 99.9%",
    ],
    cta: "Liên hệ tư vấn",
    highlighted: false,
  },
];

const faqs = [
  {
    question: "AI StudyMate là gì và hoạt động như thế nào?",
    answer:
      "AI StudyMate là nền tảng học tập thông minh sử dụng trí tuệ nhân tạo để giúp bạn học tập hiệu quả hơn. Bạn chỉ cần tải lên tài liệu học tập, AI sẽ tự động phân tích, tạo flashcard, câu hỏi ôn tập, tóm tắt nội dung và đề xuất lộ trình học tập cá nhân hóa.",
  },
  {
    question: "Tôi có thể sử dụng miễn phí không?",
    answer:
      "Có! Chúng tôi cung cấp gói miễn phí với các tính năng cơ bản như upload tài liệu, tạo flashcard và quiz. Bạn có thể nâng cấp lên gói Pro để trải nghiệm đầy đủ tất cả tính năng.",
  },
  {
    question: "AI StudyMate hỗ trợ những loại tài liệu nào?",
    answer:
      "AI StudyMate hỗ trợ nhiều định dạng tài liệu phổ biến bao gồm PDF, Word (.doc, .docx), PowerPoint (.pptx), hình ảnh (JPG, PNG), và văn bản thuần (.txt). Chúng tôi liên tục mở rộng hỗ trợ thêm các định dạng mới.",
  },
  {
    question: "Dữ liệu của tôi có được bảo mật không?",
    answer:
      "Tuyệt đối! Chúng tôi sử dụng mã hóa AES-256 cho dữ liệu lưu trữ và TLS 1.3 cho truyền tải. Dữ liệu của bạn không bao giờ được chia sẻ với bên thứ ba và bạn có toàn quyền kiểm soát dữ liệu của mình.",
  },
  {
    question: "Tôi có thể hủy đăng ký bất cứ lúc nào không?",
    answer:
      "Có, bạn có thể hủy đăng ký bất cứ lúc nào mà không bị tính thêm phí. Sau khi hủy, bạn vẫn có thể sử dụng dịch vụ cho đến hết chu kỳ thanh toán hiện tại.",
  },
];

const trustedLogos = [
  "Đại học Bách Khoa",
  "Đại học Quốc gia",
  "FPT Education",
  "VinUniversity",
  "RMIT Vietnam",
];

/* ──────────────────────────── FAQ Accordion (Client Component) ──────────────── */

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group border border-gray-200 rounded-2xl overflow-hidden">
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left font-semibold text-gray-900 hover:bg-gray-50 transition-colors">
        <span>{question}</span>
        <ChevronDownIcon className="w-5 h-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-6 pb-5 text-gray-600 leading-relaxed">
        {answer}
      </div>
    </details>
  );
}

/* ──────────────────────────── Main Page Component ──────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ═══════════════════ Header / Navigation ═══════════════════ */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5">
            <LogoIcon />
            <span className="text-xl font-bold tracking-tight text-gray-900">
              AI <span className="text-indigo-600">StudyMate</span>
            </span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-8 text-sm font-medium text-gray-600 md:flex">
            <a href="#features" className="transition-colors hover:text-indigo-600">Tính năng</a>
            <a href="#how-it-works" className="transition-colors hover:text-indigo-600">Cách hoạt động</a>
            <a href="#pricing" className="transition-colors hover:text-indigo-600">Bảng giá</a>
            <a href="#testimonials" className="transition-colors hover:text-indigo-600">Đánh giá</a>
            <a href="#faq" className="transition-colors hover:text-indigo-600">FAQ</a>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            <a
              href="#"
              className="hidden rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:inline-flex"
            >
              Đăng nhập
            </a>
            <a
              href="#"
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              Đăng ký miễn phí
            </a>
          </div>
        </div>
      </header>

      {/* ═══════════════════ Hero Section ═══════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/70 via-white to-white">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="pointer-events-none absolute top-20 right-0 h-[400px] w-[400px] rounded-full bg-purple-200/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              <SparklesIcon className="w-4 h-4" />
              Nền tảng học tập AI #1 Việt Nam
            </div>

            {/* Headline */}
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Tối ưu quá trình học tập{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                với sức mạnh AI
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
              AI StudyMate giúp bạn tạo flashcard, tóm tắt tài liệu, tạo đề thi và theo dõi tiến độ học tập — tất cả được hỗ trợ bởi trí tuệ nhân tạo tiên tiến nhất.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-700 hover:shadow-indigo-500/40"
              >
                Bắt đầu học miễn phí
                <ArrowRightIcon className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-7 py-3.5 text-base font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50"
              >
                <PlayIcon className="w-4 h-4" />
                Xem demo
              </a>
            </div>

            {/* Social proof */}
            <div className="mt-10 flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-indigo-400 to-purple-400"
                  />
                ))}
              </div>
              <span className="ml-2">
                <strong className="font-semibold text-gray-900">10,000+</strong>{" "}
                học sinh, sinh viên đang sử dụng
              </span>
            </div>
          </div>

          {/* App Screenshot */}
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl shadow-gray-200/60">
              <Image
                src="/review_app_img.jpg"
                alt="AI StudyMate - Giao diện ứng dụng"
                width={1200}
                height={675}
                className="w-full rounded-xl object-cover"
                priority
              />
            </div>
            {/* Floating badge left */}
            <div className="absolute -bottom-6 -left-4 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-lg sm:-left-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <CheckIcon className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Flashcard đã tạo</p>
                  <p className="text-xs text-gray-500">1,234 flashcard hôm nay</p>
                </div>
              </div>
            </div>
            {/* Floating badge right */}
            <div className="absolute -bottom-6 -right-4 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-lg sm:-right-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                  <ChartIcon className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Hiệu suất</p>
                  <p className="text-xs text-gray-500">+27% so với tháng trước</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ Trusted By ═══════════════════ */}
      <section className="border-y border-gray-100 bg-gray-50/60 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-8 text-center text-sm font-medium uppercase tracking-wider text-gray-400">
            Được tin dùng bởi các tổ chức giáo dục hàng đầu
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {trustedLogos.map((name) => (
              <div
                key={name}
                className="text-lg font-bold text-gray-300 transition-colors hover:text-gray-400"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ Features Section ═══════════════════ */}
      <section id="features" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              Tính năng nổi bật
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Mọi thứ bạn cần để học tập hiệu quả
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              AI StudyMate cung cấp bộ công cụ toàn diện giúp bạn tối ưu hóa quá trình học tập từ A đến Z.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-gray-200 bg-white p-8 transition-all hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                  {feature.icon}
                </div>
                <h3 className="mb-3 text-lg font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ App Demo / Screenshot Section ═══════════════════ */}
      <section className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Text Content */}
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
                Giao diện trực quan
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Trải nghiệm học tập hiện đại & thông minh
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-gray-600">
                Giao diện được thiết kế tối ưu cho trải nghiệm học tập, giúp bạn tập trung vào nội dung và đạt hiệu quả cao nhất.
              </p>

              <div className="mt-8 space-y-5">
                {[
                  "Dashboard tổng quan với biểu đồ tiến độ trực quan",
                  "Trình soạn thảo ghi chú tích hợp AI hỗ trợ",
                  "Hệ thống flashcard với thuật toán lặp lại ngắt quãng",
                  "Quiz tương tác với phản hồi chi tiết tức thì",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                      <CheckIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>

              <a
                href="#"
                className="mt-8 inline-flex items-center gap-2 text-base font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
              >
                Khám phá thêm tính năng
                <ArrowRightIcon className="w-4 h-4" />
              </a>
            </div>

            {/* Screenshot */}
            <div className="relative">
              <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                <Image
                  src="/review_app_img.jpg"
                  alt="AI StudyMate - Giao diện dashboard"
                  width={700}
                  height={500}
                  className="w-full rounded-xl object-cover"
                />
              </div>
              {/* Decorative dots */}
              <div className="absolute -right-6 -top-6 -z-10 h-32 w-32 rounded-full bg-indigo-100/60" />
              <div className="absolute -bottom-6 -left-6 -z-10 h-24 w-24 rounded-full bg-purple-100/60" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ How It Works ═══════════════════ */}
      <section id="how-it-works" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              Cách hoạt động
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Bắt đầu chỉ trong 4 bước đơn giản
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Quy trình đơn giản, dễ dàng để bạn bắt đầu học tập thông minh ngay lập tức.
            </p>
          </div>

          {/* Steps */}
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.step} className="relative text-center">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-1/2 top-10 hidden h-0.5 w-full bg-gradient-to-r from-indigo-300 to-indigo-100 lg:block" />
                )}
                <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-50">
                  <span className="text-2xl font-extrabold text-indigo-600">{step.step}</span>
                </div>
                <h3 className="mb-3 text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ Second Screenshot Row ═══════════════════ */}
      <section className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Screenshot */}
            <div className="relative order-2 lg:order-1">
              <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                <Image
                  src="/review_app_img.jpg"
                  alt="AI StudyMate - Tạo flashcard tự động"
                  width={700}
                  height={500}
                  className="w-full rounded-xl object-cover"
                />
              </div>
              <div className="absolute -left-6 -top-6 -z-10 h-32 w-32 rounded-full bg-purple-100/60" />
              <div className="absolute -bottom-6 -right-6 -z-10 h-24 w-24 rounded-full bg-indigo-100/60" />
            </div>

            {/* Text Content */}
            <div className="order-1 lg:order-2">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
                Tính năng AI
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Để AI làm việc nặng, bạn tập trung vào học
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-gray-600">
                AI StudyMate tự động phân tích tài liệu và tạo nội dung học tập phong phú, giúp bạn tiết kiệm hàng giờ đồng hồ chuẩn bị.
              </p>

              <div className="mt-8 space-y-5">
                {[
                  "Tự động tạo flashcard từ bất kỳ tài liệu nào",
                  "Tóm tắt bài giảng dài thành các điểm chính",
                  "Tạo câu hỏi trắc nghiệm & tự luận thông minh",
                  "Gợi ý lộ trình ôn tập dựa trên mức độ hiểu biết",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                      <CheckIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>

              <a
                href="#"
                className="mt-8 inline-flex items-center gap-2 text-base font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
              >
                Tìm hiểu thêm về AI
                <ArrowRightIcon className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ Testimonials ═══════════════════ */}
      <section id="testimonials" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              Đánh giá từ người dùng
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Hàng ngàn người đã tin tưởng sử dụng
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Xem những phản hồi tích cực từ cộng đồng học sinh, sinh viên và giảng viên.
            </p>
          </div>

          {/* Testimonial Cards */}
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.name}
                className="relative rounded-2xl border border-gray-200 bg-white p-8 transition-shadow hover:shadow-lg"
              >
                <QuoteIcon className="absolute right-6 top-6 w-10 h-10 text-indigo-600" />
                {/* Stars */}
                <div className="mb-4 flex gap-1">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <StarIcon key={i} className="w-5 h-5 text-amber-400" />
                  ))}
                </div>
                <p className="mb-6 text-gray-600 leading-relaxed">
                  &ldquo;{testimonial.content}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-sm font-bold text-white">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ CTA Banner ═══════════════════ */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 px-8 py-16 text-center sm:px-16 sm:py-20">
            {/* Decorative elements */}
            <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />

            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Sẵn sàng thay đổi cách bạn học?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-indigo-100">
                Tham gia cùng hàng ngàn học sinh, sinh viên đã nâng cao hiệu quả học tập với AI StudyMate. Đăng ký miễn phí ngay hôm nay!
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a
                  href="#"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-indigo-700 shadow-lg transition-all hover:bg-gray-50"
                >
                  Đăng ký miễn phí ngay
                  <ArrowRightIcon className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-white/10"
                >
                  Liên hệ tư vấn
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ Pricing ═══════════════════ */}
      <section id="pricing" className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              Bảng giá
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Gói dịch vụ phù hợp cho mọi nhu cầu
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Bắt đầu miễn phí, nâng cấp khi bạn cần thêm tính năng. Không ràng buộc, hủy bất cứ lúc nào.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-8 transition-shadow ${
                  plan.highlighted
                    ? "border-indigo-600 bg-white shadow-xl shadow-indigo-100/50 ring-1 ring-indigo-600"
                    : "border-gray-200 bg-white hover:shadow-lg"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-1 text-xs font-semibold text-white">
                    Phổ biến nhất
                  </div>
                )}

                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{plan.description}</p>

                <div className="mt-6 flex items-baseline gap-1">
                  {plan.price !== "Liên hệ" ? (
                    <>
                      <span className="text-4xl font-extrabold text-gray-900">{plan.price}đ</span>
                      <span className="text-gray-500">/{plan.period}</span>
                    </>
                  ) : (
                    <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                  )}
                </div>

                <ul className="mt-8 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckIcon
                        className={`w-5 h-5 shrink-0 ${
                          plan.highlighted ? "text-indigo-600" : "text-green-500"
                        }`}
                      />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#"
                  className={`mt-8 block rounded-xl px-6 py-3.5 text-center text-sm font-semibold transition-all ${
                    plan.highlighted
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700"
                      : "border border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ FAQ ═══════════════════ */}
      <section id="faq" className="py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="mb-16 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              Câu hỏi thường gặp
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Giải đáp thắc mắc của bạn
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Không tìm thấy câu trả lời? Hãy liên hệ đội ngũ hỗ trợ của chúng tôi.
            </p>
          </div>

          {/* FAQ Items */}
          <div className="space-y-4">
            {faqs.map((faq) => (
              <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-600">
              Vẫn còn thắc mắc?{" "}
              <a href="#" className="font-semibold text-indigo-600 hover:text-indigo-700">
                Liên hệ hỗ trợ →
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════ Final CTA ═══════════════════ */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-700 px-8 py-16 text-center sm:px-16">
            <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -right-10 h-60 w-60 rounded-full bg-purple-500/20 blur-2xl" />
            <div className="relative">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                Bắt đầu hành trình học tập thông minh
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-100">
                Đăng ký ngay hôm nay và trải nghiệm sức mạnh của AI trong học tập. Hoàn toàn miễn phí!
              </p>
              <a
                href="#"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-indigo-700 shadow-lg transition-all hover:bg-gray-50"
              >
                Đăng ký miễn phí ngay
                <ArrowRightIcon className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ Footer ═══════════════════ */}
      <footer className="border-t border-gray-200 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand Column */}
            <div className="lg:col-span-1">
              <a href="#" className="flex items-center gap-2.5">
                <LogoIcon />
                <span className="text-xl font-bold tracking-tight text-gray-900">
                  AI <span className="text-indigo-600">StudyMate</span>
                </span>
              </a>
              <p className="mt-4 text-sm leading-relaxed text-gray-500">
                Nền tảng học tập thông minh sử dụng trí tuệ nhân tạo, giúp bạn học tập hiệu quả hơn mỗi ngày.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-900">
                Sản phẩm
              </h4>
              <ul className="space-y-3 text-sm">
                {["Tính năng", "Bảng giá", "Tạo Flashcard", "Quiz AI", "Tóm tắt tài liệu"].map(
                  (item) => (
                    <li key={item}>
                      <a href="#" className="text-gray-500 transition-colors hover:text-indigo-600">
                        {item}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-900">
                Công ty
              </h4>
              <ul className="space-y-3 text-sm">
                {["Về chúng tôi", "Blog", "Tuyển dụng", "Liên hệ", "Đối tác"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-gray-500 transition-colors hover:text-indigo-600">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-900">
                Hỗ trợ
              </h4>
              <ul className="space-y-3 text-sm">
                {["Trung tâm trợ giúp", "Điều khoản sử dụng", "Chính sách bảo mật", "Cookie", "Hướng dẫn sử dụng"].map(
                  (item) => (
                    <li key={item}>
                      <a href="#" className="text-gray-500 transition-colors hover:text-indigo-600">
                        {item}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-8 sm:flex-row">
            <p className="text-sm text-gray-400">
              © 2026 AI StudyMate. Tất cả quyền được bảo lưu.
            </p>
            <div className="flex gap-5">
              {/* Social Icons - simplified as text links */}
              {["Facebook", "Twitter", "LinkedIn", "GitHub"].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="text-sm text-gray-400 transition-colors hover:text-indigo-600"
                >
                  {social}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}