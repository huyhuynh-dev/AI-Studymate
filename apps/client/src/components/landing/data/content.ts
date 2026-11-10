/**
 * Toàn bộ nội dung của Landing Page nằm ở đây — sửa chữ không cần đụng vào component.
 * ⚠️ Các mục đánh dấu TODO là nội dung mẫu, cần thay bằng dữ liệu thật trước khi public.
 */

export const ROUTES = {
  login: "/auth/login",
  register: "/auth/register",
} as const;

export const NAV_LINKS = [
  { label: "Tính năng", href: "#features" },
  { label: "Cách hoạt động", href: "#how-it-works" },
  { label: "Bảng giá", href: "#pricing" },
  { label: "Hỏi đáp", href: "#faq" },
] as const;

export const HERO = {
  title: "Học thông minh hơn.",
  titleMuted: "Không phải học nhiều hơn.",
  description:
    "AI StudyMate đọc bài giảng của bạn, rồi tạo flashcard, bản tóm tắt và đề ôn tập. Bạn chỉ cần dành thời gian để hiểu bài.",
  primaryCta: "Bắt đầu miễn phí",
  secondaryCta: "Xem cách hoạt động",
  note: "Miễn phí · Đăng ký trong vài giây",
} as const;

export const STORY = {
  eyebrow: "Câu chuyện của AI StudyMate",
  text: "Mỗi kỳ thi đều bắt đầu bằng một chồng tài liệu. Hàng giờ chép, gạch chân, tóm tắt. Thời gian đáng lẽ dành để hiểu bài lại bị tiêu tốn cho việc chuẩn bị. Chúng tôi tin AI nên gánh phần việc lặp lại ấy, để bạn chỉ cần làm điều quan trọng nhất: học.",
  closing: "Đó là lý do AI StudyMate ra đời.",
} as const;

export const STEPS = [
  {
    title: "Tạo tài khoản",
    description:
      "Đăng nhập bằng Google hoặc email. Chỉ mất vài giây, hoàn toàn miễn phí.",
  },
  {
    title: "Tải tài liệu lên",
    description:
      "Thả bài giảng, slide, sách hoặc ghi chú vào. AI đọc và sắp xếp nội dung cho bạn.",
  },
  {
    title: "AI chuẩn bị mọi thứ",
    description:
      "Flashcard, bản tóm tắt, câu hỏi ôn tập và lộ trình học được tạo tự động từ chính tài liệu của bạn.",
  },
  {
    title: "Học và theo dõi tiến độ",
    description:
      "Ôn tập đúng lúc, xem mình tiến bộ qua từng ngày bằng bảng theo dõi trực quan.",
  },
] as const;

export const FEATURES_HEADING = {
  title: "Mọi thứ để học hiệu quả, trong một nơi.",
  description:
    "Từ tài liệu thô đến kiến thức nhớ lâu. AI StudyMate lo toàn bộ phần chuẩn bị.",
} as const;

// TODO: thay bằng đánh giá thật của người dùng (có sự đồng ý của họ).
export const TESTIMONIALS = [
  {
    name: "Nguyễn Minh Anh",
    role: "Sinh viên Đại học Bách Khoa",
    content:
      "AI StudyMate thay đổi hoàn toàn cách mình ôn thi. Điểm số cải thiện rõ rệt và mình tiết kiệm được rất nhiều thời gian.",
  },
  {
    name: "Trần Đức Hùng",
    role: "Giảng viên Đại học Quốc gia",
    content:
      "Tôi dùng để tạo đề thi và bài tập cho sinh viên. Thời gian soạn bài giảm đi đáng kể.",
  },
  {
    name: "Lê Thị Hương",
    role: "Học sinh THPT chuyên",
    content:
      "Chỉ cần tải bài giảng lên là có ngay bộ flashcard hoàn chỉnh. Ôn thi hiệu quả hơn hẳn.",
  },
] as const;

// TODO: cập nhật href cho gói Doanh nghiệp (mailto: hoặc trang liên hệ).
export const PRICING_PLANS = [
  {
    name: "Miễn phí",
    price: "0",
    period: "mãi mãi",
    description: "Cho người mới bắt đầu",
    features: [
      "Tải lên tối đa 5 tài liệu",
      "20 flashcard mỗi tháng",
      "Tóm tắt tài liệu cơ bản",
      "1 bài quiz mỗi ngày",
      "Hỗ trợ qua email",
    ],
    cta: "Bắt đầu miễn phí",
    href: ROUTES.register,
    highlighted: false,
  },
  {
    name: "Pro",
    price: "99.000",
    period: "tháng",
    description: "Cho học sinh, sinh viên",
    features: [
      "Tải lên không giới hạn",
      "Flashcard và quiz không giới hạn",
      "Tóm tắt tài liệu nâng cao",
      "Trợ lý học tập AI 24/7",
      "Phân tích hiệu suất chi tiết",
      "Xuất PDF và chia sẻ",
    ],
    cta: "Nâng cấp Pro",
    href: ROUTES.register,
    highlighted: true,
  },
  {
    name: "Doanh nghiệp",
    price: "Liên hệ",
    period: "",
    description: "Cho trường học và tổ chức",
    features: [
      "Tất cả tính năng Pro",
      "Quản lý nhóm và lớp học",
      "Báo cáo và phân tích nâng cao",
      "Tích hợp qua API",
      "Hỗ trợ ưu tiên 24/7",
      "Tùy chỉnh thương hiệu",
    ],
    cta: "Liên hệ tư vấn",
    href: "#",
    highlighted: false,
  },
] as const;

export const FAQS = [
  {
    question: "AI StudyMate là gì và hoạt động thế nào?",
    answer:
      "AI StudyMate là nền tảng học tập dùng trí tuệ nhân tạo. Bạn tải tài liệu lên, AI sẽ phân tích rồi tự tạo flashcard, câu hỏi ôn tập, bản tóm tắt và lộ trình học cá nhân hóa.",
  },
  {
    question: "Tôi có thể dùng miễn phí không?",
    answer:
      "Có. Gói miễn phí gồm các tính năng cơ bản như tải tài liệu, tạo flashcard và làm quiz. Bạn có thể nâng cấp lên Pro bất cứ lúc nào để dùng đầy đủ.",
  },
  {
    question: "AI StudyMate hỗ trợ những loại tài liệu nào?",
    answer:
      "PDF, Word (.doc, .docx), PowerPoint (.pptx), hình ảnh (JPG, PNG) và văn bản thuần (.txt). Danh sách định dạng sẽ tiếp tục được mở rộng.",
  },
  {
    question: "Dữ liệu của tôi có được bảo mật không?",
    answer:
      "Dữ liệu được mã hóa AES-256 khi lưu trữ và TLS 1.3 khi truyền tải. Chúng tôi không chia sẻ dữ liệu cho bên thứ ba, và bạn luôn toàn quyền kiểm soát dữ liệu của mình.",
  },
  {
    question: "Tôi có thể hủy đăng ký bất cứ lúc nào không?",
    answer:
      "Có, không mất thêm phí. Sau khi hủy, bạn vẫn dùng được dịch vụ đến hết chu kỳ thanh toán hiện tại.",
  },
] as const;

export const FINAL_CTA = {
  title: "Bắt đầu hành trình học tập thông minh.",
  description: "Tạo tài khoản miễn phí và để AI lo phần chuẩn bị.",
  cta: "Đăng ký miễn phí",
} as const;

// TODO: thay "#" bằng đường dẫn thật khi các trang này sẵn sàng.
export const FOOTER_GROUPS = [
  {
    title: "Sản phẩm",
    links: [
      { label: "Tính năng", href: "#features" },
      { label: "Cách hoạt động", href: "#how-it-works" },
      { label: "Bảng giá", href: "#pricing" },
      { label: "Hỏi đáp", href: "#faq" },
    ],
  },
  {
    title: "Công ty",
    links: [
      { label: "Về chúng tôi", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Liên hệ", href: "#" },
    ],
  },
  {
    title: "Hỗ trợ",
    links: [
      { label: "Trung tâm trợ giúp", href: "#" },
      { label: "Điều khoản sử dụng", href: "#" },
      { label: "Chính sách bảo mật", href: "#" },
    ],
  },
] as const;
