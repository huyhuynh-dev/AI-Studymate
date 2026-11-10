import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiService } from './ai.service.js';

export interface GenerateSummaryOptions {
  documentTexts: Array<{ fileName?: string; text: string }>;
  mode: 'key_takeaways' | 'study_guide' | 'qa_style';
  length: 'short' | 'standard' | 'detailed';
  scope: 'conversation' | 'document' | 'section';
  sectionInfo?: string;
  customInstruction?: string;
  modelName?: string;
}

export interface SummaryBlock {
  id: string;
  type: string;
  props?: Record<string, any>;
  content?: any;
  children?: SummaryBlock[];
}

export interface SummaryResult {
  title: string;
  blocks: SummaryBlock[];
}

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Sinh bản tóm tắt mới bằng AI với Structured Output (Zod Schema)
   */
  async generateSummary(
    options: GenerateSummaryOptions,
  ): Promise<SummaryResult> {
    const contextText = options.documentTexts
      .map((doc, idx) => {
        const header = doc.fileName
          ? `=== TÀI LIỆU ${idx + 1}: ${doc.fileName} ===`
          : `=== TÀI LIỆU ${idx + 1} ===`;
        return `${header}\n${doc.text}\n`;
      })
      .join('\n\n');

    if (!contextText.trim()) {
      throw new Error('Không có nội dung văn bản để thực hiện tóm tắt');
    }

    try {
      this.logger.log(
        `Đang gọi model ${options.modelName || 'STANDARD (SUMMARIZE)'} với Structured Output (${options.mode}, ${options.length})...`,
      );

      const { object } =
        await this.aiService.generateObjectForFeature(
          'SUMMARIZE_GENERATE',
          {
            contextText,
            mode: options.mode,
            length: options.length,
            scope: options.scope,
            sectionInfo: options.sectionInfo,
            customInstruction: options.customInstruction,
          },
          options.modelName ? { modelName: options.modelName } : undefined,
        );

      return this.ensureBlockNoteCompatibility(object.blocks, object.title);
    } catch (error: any) {
      this.logger.error(`Lỗi sinh tóm tắt: ${error.message}`, error.stack);
      throw new Error(`AI Tóm tắt thất bại: ${error.message}`);
    }
  }

  /**
   * Tinh chỉnh bản tóm tắt hiện có theo chỉ dẫn của người học với Structured Output
   */
  async refineSummary(
    currentBlocks: any[],
    instruction: string,
  ): Promise<SummaryResult> {
    if (
      !currentBlocks ||
      !Array.isArray(currentBlocks) ||
      currentBlocks.length === 0
    ) {
      throw new Error('Bản tóm tắt hiện tại không có dữ liệu để tinh chỉnh');
    }

    try {
      this.logger.log(
        `Đang gọi model STANDARD để tinh chỉnh tóm tắt theo chỉ dẫn: "${instruction}"...`,
      );

      const { object } =
        await this.aiService.generateObjectForFeature(
          'SUMMARIZE_REFINE',
          {
            currentBlocksJson: JSON.stringify(currentBlocks, null, 2),
            instruction,
          },
        );

      return this.ensureBlockNoteCompatibility(object.blocks, object.title);
    } catch (error: any) {
      this.logger.error(`Lỗi tinh chỉnh tóm tắt: ${error.message}`, error.stack);
      throw new Error(`AI Tinh chỉnh thất bại: ${error.message}`);
    }
  }

  /**
   * Chuẩn hóa và bảo đảm tính tương thích với BlockNote Editor (gọn nhẹ)
   * - Tự động bổ sung id duy nhất (UUID) cho bất kỳ block nào chưa có
   * - Loại bỏ các giá trị null phát sinh từ Strict Mode schema
   * - Xử lý quy tắc ProseMirror code mark: loại bỏ các style khác nếu code: true
   * - Chuẩn hóa ô bảng (cells) sang mảng inline content nếu nhận được chuỗi text đơn giản
   * - Đệ quy xử lý các block con trong children
   * - Cung cấp fallback paragraph mặc định nếu danh sách blocks rỗng
   */
  private ensureBlockNoteCompatibility(
    rawBlocks: any[],
    title?: string,
  ): SummaryResult {
    const cleanTitle =
      typeof title === 'string' && title.trim()
        ? title.trim()
        : 'Bản Tóm Tắt Học Tập';

    const safeBlocks = Array.isArray(rawBlocks) ? rawBlocks : [];
    const validatedBlocks = this.sanitizeBlockList(safeBlocks);

    if (validatedBlocks.length === 0) {
      validatedBlocks.push({
        id: randomUUID(),
        type: 'paragraph',
        props: {
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left',
        },
        content: [
          {
            type: 'text',
            text: 'Bản tóm tắt đang được xử lý hoặc nội dung trống.',
            styles: {},
          },
        ],
        children: [],
      });
    }

    return {
      title: cleanTitle,
      blocks: validatedBlocks,
    };
  }

  /**
   * Duyệt và chuẩn hóa mảng blocks theo quy chuẩn BlockNote
   */
  private sanitizeBlockList(blocks: any[]): SummaryBlock[] {
    return blocks.map((b) => {
      const blockId =
        typeof b?.id === 'string' && b.id.trim() ? b.id : randomUUID();
      const blockType = typeof b?.type === 'string' ? b.type : 'paragraph';

      // Xóa các props có giá trị null hoặc undefined
      const rawProps =
        typeof b?.props === 'object' && b?.props ? b.props : {};
      const props: Record<string, any> = {};
      for (const [k, v] of Object.entries(rawProps)) {
        if (v !== null && v !== undefined) {
          props[k] = v;
        }
      }

      if (blockType === 'heading' && !props.level) {
        props.level = 2;
      }

      // Giữ nguyên các loại block chuẩn và extension (mathBlock, diagram, codeBlock, table, ...)
      let finalType = blockType;
      let content: any = undefined;

      if (finalType === 'table') {
        const rawRows = b?.content?.rows || b?.rows || [];
        if (Array.isArray(rawRows) && rawRows.length > 0) {
          content = {
            type: 'tableContent',
            rows: rawRows.map((row: any) => ({
              cells: Array.isArray(row?.cells)
                ? row.cells.map((cell: any) => this.sanitizeTableCell(cell))
                : [],
            })),
          };
        } else {
          // Bảng rỗng không thể render trong BlockNote -> chuyển thành paragraph
          finalType = 'paragraph';
          content = [{ type: 'text', text: '', styles: {} }];
        }
      } else if (
        ['divider', 'file', 'image', 'video', 'audio'].includes(finalType)
      ) {
        content = undefined;
      } else if (['codeBlock', 'mathBlock', 'diagram'].includes(finalType)) {
        if (typeof b?.content === 'string') {
          content = [{ type: 'text', text: b.content, styles: {} }];
        } else if (Array.isArray(b?.content)) {
          content = b.content.map((item: any) => this.sanitizeInlineItem(item));
        } else {
          content = [{ type: 'text', text: '', styles: {} }];
        }
      } else {
        // paragraph, heading, quote, bulletListItem, numberedListItem, checkListItem, toggleListItem
        if (Array.isArray(b?.content)) {
          content = b.content.map((item: any) => this.sanitizeInlineItem(item));
        } else if (typeof b?.content === 'string') {
          content = [{ type: 'text', text: b.content, styles: {} }];
        } else {
          content = [{ type: 'text', text: '', styles: {} }];
        }
      }

      const children =
        Array.isArray(b?.children) && b.children.length > 0
          ? this.sanitizeBlockList(b.children)
          : [];

      return {
        id: blockId,
        type: finalType,
        props,
        content,
        children,
      };
    });
  }

  /**
   * Chuẩn hóa phần tử nội dòng (Inline Item: text, link)
   */
  private sanitizeInlineItem(item: any): any {
    if (!item || typeof item !== 'object') {
      return {
        type: 'text',
        text: typeof item === 'string' ? item : '',
        styles: {},
      };
    }
    if (item?.type === 'link') {
      const rawContent = item.content;
      return {
        type: 'link',
        href: typeof item.href === 'string' ? item.href : '#',
        content: Array.isArray(rawContent)
          ? rawContent.map((c: any) => this.sanitizeInlineItem(c))
          : [{ type: 'text', text: String(rawContent || ''), styles: {} }],
      };
    }
    if (item?.type === 'math') {
      return {
        type: 'math',
        props: {},
        content:
          typeof item.content === 'string'
            ? item.content
            : typeof item.text === 'string'
              ? item.text
              : '',
      };
    }

    const rawStyles: Record<string, any> =
      typeof item?.styles === 'object' && item.styles ? item.styles : {};

    const styles: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawStyles)) {
      if (v !== null && v !== undefined && v !== false) {
        styles[k] = v;
      }
    }

    // Quy tắc ProseMirror: code không đi cùng các styles khác (bold, italic, strike, underline)
    if (styles.code) {
      return {
        type: 'text',
        text: typeof item?.text === 'string' ? item.text : '',
        styles: { code: true },
      };
    }

    return {
      type: 'text',
      text: typeof item?.text === 'string' ? item.text : '',
      styles,
    };
  }

  /**
   * Chuẩn hóa ô bảng (Table Cell)
   */
  private sanitizeTableCell(cell: any): any[] {
    if (Array.isArray(cell)) {
      return cell.map((item) => this.sanitizeInlineItem(item));
    }
    if (typeof cell === 'string') {
      return [{ type: 'text', text: cell, styles: {} }];
    }
    if (cell && typeof cell === 'object') {
      if (cell.type === 'tableCell') {
        return Array.isArray(cell.content)
          ? cell.content.map((item: any) => this.sanitizeInlineItem(item))
          : [{ type: 'text', text: '', styles: {} }];
      }
      return [this.sanitizeInlineItem(cell)];
    }
    return [{ type: 'text', text: '', styles: {} }];
  }
}
