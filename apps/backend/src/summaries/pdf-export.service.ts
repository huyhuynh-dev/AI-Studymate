import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

@Injectable()
export class PdfExportService {
    private readonly logger = new Logger(PdfExportService.name);

    constructor(private readonly configService: ConfigService) { }

    /**
     * Tìm đường dẫn trình duyệt Chromium/Edge khả dụng trên hệ thống
     */
    private getExecutablePath(): string {
        const envPath = this.configService.get<string>('PUPPETEER_EXECUTABLE_PATH');
        if (envPath && existsSync(envPath)) {
            return envPath;
        }

        const candidatePaths = [
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
        ];

        for (const p of candidatePaths) {
            if (existsSync(p)) {
                return p;
            }
        }

        throw new Error(
            'Không tìm thấy trình duyệt Chromium hoặc Edge trên hệ thống để xuất PDF. ' +
            'Vui lòng cấu hình biến môi trường PUPPETEER_EXECUTABLE_PATH.',
        );
    }

    /**
     * Chuyển đổi khối BlockNote JSON sang mã HTML học tập chuẩn mực
     */
    convertBlockNoteToHtml(title: string, blocks: any[]): string {
        const dateStr = new Date().toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        let bodyHtml = '';

        if (Array.isArray(blocks)) {
            for (const block of blocks) {
                bodyHtml += this.renderBlockToHtml(block);
            }
        }

        return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${this.escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
    
    @page {
      size: A4;
      margin: 18mm 15mm 20mm 15mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1E293B;
      background: #FFFFFF;
      line-height: 1.65;
      font-size: 13.5px;
      -webkit-font-smoothing: antialiased;
    }

    .header-card {
      border-bottom: 2px solid #E2E8F0;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .brand-tag {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #4F46E5;
      background: #EEF2FF;
      padding: 4px 10px;
      border-radius: 6px;
      display: inline-block;
      margin-bottom: 8px;
    }

    h1.doc-title {
      font-size: 22px;
      font-weight: 800;
      color: #0F172A;
      line-height: 1.3;
      margin-bottom: 6px;
    }

    .meta-info {
      font-size: 11.5px;
      color: #64748B;
    }

    .content-area {
      padding: 0 4px;
    }

    h1 {
      font-size: 18px;
      font-weight: 700;
      color: #1E1B4B;
      margin-top: 22px;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 1.5px solid #E0E7FF;
      page-break-after: avoid;
    }

    h2 {
      font-size: 15.5px;
      font-weight: 700;
      color: #312E81;
      margin-top: 18px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }

    h3 {
      font-size: 14px;
      font-weight: 600;
      color: #3730A3;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    p {
      margin-bottom: 10px;
      text-align: justify;
    }

    ul, ol {
      margin-left: 22px;
      margin-bottom: 12px;
    }

    li {
      margin-bottom: 5px;
    }

    li::marker {
      color: #4F46E5;
    }

    .check-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 6px;
    }

    .check-box {
      width: 14px;
      height: 14px;
      border: 1.5px solid #94A3B8;
      border-radius: 3px;
      margin-top: 3px;
      display: inline-block;
      flex-shrink: 0;
    }

    .check-box.checked {
      background: #4F46E5;
      border-color: #4F46E5;
    }

    .bold {
      font-weight: 700;
      color: #0F172A;
    }

    .italic {
      font-style: italic;
    }

    .underline {
      text-decoration: underline;
    }

    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      font-size: 10px;
      color: #94A3B8;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #F1F5F9;
      padding-top: 6px;
    }
  </style>
</head>
<body>
  <div class="header-card">
    <div>
      <span class="brand-tag">✨ AI StudyMate • Tóm tắt Thông minh</span>
      <h1 class="doc-title">${this.escapeHtml(title)}</h1>
      <div class="meta-info">Xuất bản: ${dateStr} • Được tạo tự động bởi AI StudyMate</div>
    </div>
  </div>

  <div class="content-area">
    ${bodyHtml}
  </div>

  <div class="footer">
    <span>AI StudyMate Platform</span>
    <span>Trang tài liệu học tập tóm tắt</span>
  </div>
</body>
</html>`;
    }

    private renderBlockToHtml(block: any): string {
        const type = block?.type || 'paragraph';
        const contentHtml = this.renderInlineContent(block?.content);
        const childrenHtml = Array.isArray(block?.children) && block.children.length > 0
            ? block.children.map((child: any) => this.renderBlockToHtml(child)).join('')
            : '';

        switch (type) {
            case 'heading': {
                const level = block?.props?.level || 2;
                return `<h${level}>${contentHtml}</h${level}>${childrenHtml}`;
            }
            case 'bulletListItem': {
                return `<ul><li>${contentHtml}${childrenHtml}</li></ul>`;
            }
            case 'numberedListItem': {
                return `<ol><li>${contentHtml}${childrenHtml}</li></ol>`;
            }
            case 'checkListItem': {
                const isChecked = Boolean(block?.props?.checked);
                return `<div class="check-item"><span class="check-box ${isChecked ? 'checked' : ''}"></span><span>${contentHtml}</span></div>${childrenHtml}`;
            }
            case 'paragraph':
            default: {
                if (!contentHtml.trim() && !childrenHtml) {
                    return '';
                }
                return `<p>${contentHtml}</p>${childrenHtml}`;
            }
        }
    }

    private renderInlineContent(content: any): string {
        if (!content) return '';
        if (typeof content === 'string') return this.escapeHtml(content);

        if (Array.isArray(content)) {
            return content
                .map((item) => {
                    const text = this.escapeHtml(item?.text || '');
                    const styles = item?.styles || {};
                    let wrapped = text;

                    if (styles.bold) {
                        wrapped = `<span class="bold">${wrapped}</span>`;
                    }
                    if (styles.italic) {
                        wrapped = `<span class="italic">${wrapped}</span>`;
                    }
                    if (styles.underline) {
                        wrapped = `<span class="underline">${wrapped}</span>`;
                    }
                    if (styles.textColor && styles.textColor !== 'default') {
                        wrapped = `<span style="color: ${this.escapeHtml(styles.textColor)}">${wrapped}</span>`;
                    }

                    return wrapped;
                })
                .join('');
        }

        return '';
    }

    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Render chuỗi HTML thành PDF Buffer sử dụng Puppeteer-core
     */
    async renderHtmlToPdf(html: string): Promise<Buffer> {
        const executablePath = this.getExecutablePath();
        this.logger.log(`Khởi chạy Chromium/Edge từ [${executablePath}] để xuất PDF...`);

        const browser = await puppeteer.launch({
            executablePath,
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--font-render-hinting=none',
            ],
        });

        try {
            const page = await browser.newPage();
            await page.setContent(html, {
                waitUntil: 'domcontentloaded',
                timeout: 30000,
            });

            const pdfUint8Array = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '18mm',
                    bottom: '20mm',
                    left: '15mm',
                    right: '15mm',
                },
            });

            return Buffer.from(pdfUint8Array);
        } finally {
            await browser.close().catch((err) => {
                this.logger.warn(`Lỗi khi đóng Puppeteer browser: ${err.message}`);
            });
        }
    }
}
