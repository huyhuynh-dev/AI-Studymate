import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { AiService } from './src/ai/ai.service.js';
import { VisionService } from './src/ai/vision.service.js';

const imagePath =
  'C:\\Users\\huyhn\\OneDrive\\Pictures\\Screenshots\\Screenshot 2026-09-03 at 08-18-22 THÔNG TIN THỰC HIỆN BÀI THU HOẠCH SINH HOẠT CÔNG DÂN – SINH VIÊN NĂM HỌC 2026 - 2027 - 2224802010817@student.tdmu.edu.vn - Thư Đại học Thủ Dầu Một.png';

try {
  const imageBuffer = await readFile(imagePath);
  const visionService = new VisionService(
    new AiService(undefined!, undefined!),
  );
  const text = await visionService.extractTextFromImage(
    imageBuffer,
    'image/png',
  );

  console.log(text);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
