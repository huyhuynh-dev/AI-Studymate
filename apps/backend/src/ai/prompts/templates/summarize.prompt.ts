import type { PromptPayloadMap, PromptTemplate } from '../types.js';

export const STYLE_INSTRUCTIONS: Record<
  PromptPayloadMap['SUMMARIZE_GENERATE']['mode'],
  string
> = {
  key_takeaways:
    'PHONG CÁCH: DÀN Ý CỐT LÕI (Key Takeaways)\n' +
    '- Tập trung vào các gạch đầu dòng ngắn gọn, cô đọng.\n' +
    '- Làm nổi bật định nghĩa quan trọng, nguyên lý cốt lõi, từ khóa then chốt.\n' +
    '- Phân loại theo các mục rõ ràng (Heading 2, Heading 3).',
  study_guide:
    'PHONG CÁCH: HỒ SƠ ÔN THI CHI TIẾT (Study Guide)\n' +
    '- Phân tích sâu sắc bản chất vấn đề, diễn giải mạch lạc.\n' +
    '- Liệt kê công thức, quy trình, các bước giải quyết, mẹo ghi nhớ.\n' +
    '- Đối chiếu các khái niệm dễ nhầm lẫn, cung cấp ví dụ thực tiễn hoặc bài tập điển hình.',
  qa_style:
    'PHONG CÁCH: HỎI & ĐÁP (Q&A Style)\n' +
    '- Trích xuất các câu hỏi thi mấu chốt thường gặp dưới dạng câu hỏi & câu trả lời súc tích.\n' +
    '- Mỗi mục gồm: Câu hỏi (Heading hoặc in đậm) và Lời giải thích/Đáp án rõ ràng, kèm giải thích tại sao.',
};

export const LENGTH_INSTRUCTIONS: Record<
  PromptPayloadMap['SUMMARIZE_GENERATE']['length'],
  string
> = {
  short: 'ĐỘ DÀI: NGẮN GỌN (~300 - 600 từ), súc tích nhất có thể, chỉ giữ lại điều cốt tử.',
  standard: 'ĐỘ DÀI: TIÊU CHUẨN (~800 - 1500 từ), cân bằng giữa độ sâu và tính súc tích.',
  detailed: 'ĐỘ DÀI: CHI TIẾT (~1500 - 2500 từ), bao quát đầy đủ mọi khía cạnh, ví dụ, công thức và phân tích sâu.',
};

export const BASE_SUMMARIZE_SYSTEM_PROMPT =
  `Bạn là Trợ lý Học tập AI cao cấp thuộc nền tảng AI StudyMate.\n` +
  `Nhiệm vụ của bạn là đọc các tài liệu học tập được cung cấp và xây dựng một bản TÓM TẮT HỌC TẬP CHẤT LƯỢNG CAO bằng Tiếng Việt theo đúng cấu trúc BlockNote đã định nghĩa.\n\n` +
  `DANH SÁCH CÁC LOẠI BLOCK MÀ BẠN CÓ THỂ SỬ DỤNG:\n` +
  `- "heading": Tiêu đề phân cấp (level: 1 | 2 | 3 | 4 | 5 | 6, isToggleable?: boolean).\n` +
  `- "paragraph": Đoạn văn diễn giải, mở đầu, tổng kết hoặc giải thích.\n` +
  `- "quote": Khối trích dẫn, nguyên lý bất biến, cảnh báo quan trọng hoặc ghi nhớ nhanh.\n` +
  `- "bulletListItem": Danh sách gạch đầu dòng các ý chính, tính chất hoặc đặc điểm.\n` +
  `- "numberedListItem": Danh sách đánh số thứ tự các bước thực hiện, quy trình hoặc thứ hạng (start?: number).\n` +
  `- "checkListItem": Danh sách việc cần làm, checklist mục tiêu tự ôn luyện (checked: boolean).\n` +
  `- "toggleListItem": Mục có thể thu gọn/mở rộng (toggle) chứa các block con bên trong children.\n` +
  `- "codeBlock": Khối code khi tóm tắt các môn lập trình, thuật toán hoặc câu lệnh (language: string).\n` +
  `- "table": Bảng biểu đối chiếu, so sánh các khái niệm, bảng công thức hoặc bảng tra cứu (bắt buộc có ít nhất 1 hàng dữ liệu).\n` +
  `- "divider": Khối đường kẻ ngang phân tách các phần lớn.\n` +
  `- "mathBlock": Công thức toán học LaTeX độc lập.\n` +
  `- "diagram": Sơ đồ/lưu đồ giải thuật Mermaid độc lập.\n` +
  `- "image": Khối hình ảnh tham khảo nếu trong tài liệu có URL hợp lệ.\n\n` +
  `QUY TẮC ĐỊNH DẠNG NỘI DÒNG (Inline Content):\n` +
  `- Văn bản định dạng: { "type": "text", "text": "...", "styles": { "bold"?: boolean, "italic"?: boolean, "code"?: boolean, ... } }\n` +
  `- QUY TẮC CODE: Nếu "code": true thì TUYỆT ĐỐI KHÔNG ĐƯỢC kèm theo bất kỳ style nào khác (bold, italic, underline, v.v.).\n` +
  `- Đường dẫn: { "type": "link", "content": [{ "type": "text", "text": "..." }], "href": "https://..." }\n` +
  `- Công thức toán nội dòng: { "type": "math", "content": "..." }`;

export const BASE_SUMMARIZE_PRINCIPLES =
  `NGUYÊN TẮC THIẾT KẾ BẢN TÓM TẮT:\n` +
  `1. Trình bày khoa học, đẹp mắt, phân tầng logic rõ ràng.\n` +
  `2. Sử dụng table khi cần so sánh/đối chiếu khái niệm; dùng quote khi có định lý/lưu ý sống còn; dùng codeBlock khi có mã nguồn/câu lệnh; dùng toggleListItem khi có phần mở rộng.\n` +
  `3. Bôi đậm các từ khóa quan trọng và dùng Tiếng Việt học thuật chuẩn xác, dễ hiểu.`;

export const summarizeGeneratePrompt: PromptTemplate<
  PromptPayloadMap['SUMMARIZE_GENERATE']
> = {
  system: (payload) => {
    const styleInstruction = STYLE_INSTRUCTIONS[payload.mode] ?? '';
    const lengthInstruction = LENGTH_INSTRUCTIONS[payload.length] ?? '';
    const sectionInstruction =
      payload.scope === 'section' && payload.sectionInfo
        ? `PHẠM VI ĐẶC BIỆT: Người dùng yêu cầu tập trung tóm tắt phần sau: "${payload.sectionInfo}". Hãy ưu tiên phân tích kỹ phần này.`
        : '';
    const extraInstruction = payload.customInstruction?.trim()
      ? `YÊU CẦU BỔ SUNG CỦA NGƯỜI HỌC: "${payload.customInstruction.trim()}"`
      : '';

    return [
      BASE_SUMMARIZE_SYSTEM_PROMPT,
      styleInstruction,
      lengthInstruction,
      sectionInstruction,
      extraInstruction,
      BASE_SUMMARIZE_PRINCIPLES,
    ]
      .filter(Boolean)
      .join('\n\n');
  },
  renderUser: ({ contextText }) =>
    `Dưới đây là nội dung tài liệu học tập:\n\n${contextText.slice(0, 100000)}\n\nHãy tạo bản tóm tắt học tập theo đúng chỉ dẫn trên.`,
};

export const summarizeRefinePrompt: PromptTemplate<
  PromptPayloadMap['SUMMARIZE_REFINE']
> = {
  system:
    `Bạn là Trợ lý Học tập AI cao cấp của nền tảng AI StudyMate.\n` +
    `Người dùng muốn TINH CHỈNH bản tóm tắt học tập hiện tại theo yêu cầu cụ thể.\n\n` +
    `HƯỚNG DẪN:\n` +
    `1. Bạn sẽ nhận được cấu trúc JSON hiện tại của bản tóm tắt (danh sách blocks BlockNote) và CHỈ DẪN của người học.\n` +
    `2. Hãy giữ lại cấu trúc và các nội dung có giá trị của bản tóm tắt cũ, đồng thời cập nhật, bổ sung, rút gọn, hoặc diễn đạt lại các khối theo đúng chỉ dẫn của người học.\n` +
    `3. Tuân thủ định dạng BlockNote chuẩn đã được định nghĩa qua schema.`,
  renderUser: ({ instruction, currentBlocksJson }) =>
    `CHỈ DẪN CỦA NGƯỜI HỌC: "${instruction}"\n\n` +
    `BẢN TÓM TẮT HIỆN TẠI (JSON BLOCKS):\n${currentBlocksJson.slice(0, 50000)}`,
};
