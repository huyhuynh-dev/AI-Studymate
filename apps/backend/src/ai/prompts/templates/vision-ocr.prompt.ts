import type { PromptPayloadMap, PromptTemplate } from '../types.js';

export const VISION_OCR_PROMPT =
  'Bạn là chuyên gia OCR văn bản chuyên nghiệp. Hãy trích xuất toàn bộ văn bản có trong hình ảnh này.\n' +
  'Yêu cầu:\n' +
  '1. Giữ nguyên cấu trúc, dấu câu, định dạng và các đoạn xuống dòng của tài liệu.\n' +
  '2. Hỗ trợ đầy đủ tiếng Việt và tiếng Anh, bao gồm cả chữ viết tay hoặc chữ in.\n' +
  '3. Tuyệt đối không thêm lời giải thích hay nhận xét, chỉ trả về chính xác nội dung văn bản được nhận dạng. Nếu ảnh không có chữ, trả về chuỗi rỗng.';

export const visionOcrPrompt: PromptTemplate<PromptPayloadMap['VISION_OCR']> = {
  system: VISION_OCR_PROMPT,
  renderUser: () => VISION_OCR_PROMPT,
};
