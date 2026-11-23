import { describe, expect, it, vi } from 'vitest';
import {
  NON_STREAMING_TEXT_ACTIONS,
  commitServerTextStream,
  extractNativeApiCalls,
  filterToolkitPerformActionTool,
  normalizeNativeOperationId,
  validateStreamTextArgs,
} from './superdoc-stream-text.helper.js';
import {
  createSuperDocRunProgress,
  isSuperDocToolFailed,
} from './superdoc-run-progress.helper.js';

describe('superdoc-stream-text.helper', () => {
  it('nên chuẩn hóa operationId và trích xuất batch calls đúng chuẩn', () => {
    expect(normalizeNativeOperationId('citations.sources.insert')).toBe(
      'doc.citations.sources.insert',
    );
    expect(normalizeNativeOperationId('doc.fields.list')).toBe(
      'doc.fields.list',
    );

    expect(extractNativeApiCalls({ operationId: 'doc.fields.list' })).toEqual([
      { operationId: 'doc.fields.list' },
    ]);
    expect(
      extractNativeApiCalls({
        calls: [{ operationId: 'doc.a' }, { operationId: 'doc.b' }],
      }),
    ).toEqual([{ operationId: 'doc.a' }, { operationId: 'doc.b' }]);
  });

  it('nên lọc bỏ toàn bộ 5 non-streaming text actions khỏi schema superdoc_perform_action', () => {
    const filtered = filterToolkitPerformActionTool({
      name: 'superdoc_perform_action',
      description: 'Original SDK description',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'rewrite_block',
              'replace_text',
              'insert_paragraphs',
              'insert_heading',
              'fill_placeholders',
              'apply_style',
              'format_text',
              'insert_table',
            ],
          },
        },
      },
    });

    const enumList = (
      (filtered.inputSchema?.properties as Record<string, any>)?.action
        ?.enum ?? []
    ) as string[];

    for (const blocked of NON_STREAMING_TEXT_ACTIONS) {
      expect(enumList).not.toContain(blocked);
    }
    expect(enumList).toEqual(['apply_style', 'format_text', 'insert_table']);
    expect(filtered.description).toContain('superdoc_stream_text');
  });

  it('nên kiểm duyệt chặt chẽ tham số superdoc_stream_text', () => {
    expect(
      validateStreamTextArgs({
        mode: 'replace',
        anchor: 'Đoạn văn gốc',
        text: 'Đoạn văn mới',
      }),
    ).toEqual({
      valid: true,
      normalized: {
        mode: 'replace',
        anchor: 'Đoạn văn gốc',
        text: 'Đoạn văn mới',
      },
    });

    expect(
      validateStreamTextArgs({
        mode: 'append',
        anchor: null,
        text: 'Đoạn mới ở cuối',
      }),
    ).toEqual({
      valid: true,
      normalized: {
        mode: 'append',
        anchor: null,
        text: 'Đoạn mới ở cuối',
      },
    });

    expect(
      validateStreamTextArgs({
        mode: 'replace',
        anchor: 'Đoạn gốc',
        text: 'Dòng 1\nDòng 2',
      }).valid,
    ).toBe(false);

    expect(
      validateStreamTextArgs({
        mode: 'replace',
        anchor: '',
        text: 'Nội dung',
      }).valid,
    ).toBe(false);
  });

  it('commitServerTextStream nên dùng doc.replace cho mode=replace và doc.create.paragraph cho mode=append', async () => {
    const mockHandle = {
      blocks: {
        list: vi.fn().mockResolvedValue({ revision: 'rev-10' }),
      },
      query: {
        match: vi.fn().mockResolvedValue({
          items: [
            {
              address: { blockId: 'b1' },
              target: {
                start: { blockId: 'b1', offset: 0 },
                end: { blockId: 'b1', offset: 12 },
              },
            },
          ],
        }),
      },
      replace: vi.fn().mockResolvedValue({
        receipt: { success: true, revision: 'rev-11' },
      }),
      insert: vi.fn(),
      create: {
        paragraph: vi.fn().mockResolvedValue({
          receipt: { success: true, revision: 'rev-12' },
        }),
      },
    };

    const replaceRes = await commitServerTextStream(
      mockHandle,
      { mode: 'replace', anchor: 'Hello world!', text: 'Xin chào!' },
      'tracked',
    );
    expect(mockHandle.replace).toHaveBeenCalledTimes(1);
    expect(replaceRes).toMatchObject({
      status: 'ok',
      success: true,
      streamed: true,
      mode: 'replace',
      changeMode: 'tracked',
      postSnapshot: { revision: 'rev-11' },
    });

    const appendRes = await commitServerTextStream(
      mockHandle,
      { mode: 'append', anchor: null, text: 'Kết luận.' },
      'direct',
    );
    expect(mockHandle.create.paragraph).toHaveBeenCalledTimes(1);
    expect(appendRes).toMatchObject({
      status: 'ok',
      mode: 'append',
      changeMode: 'direct',
      postSnapshot: { revision: 'rev-12' },
    });
  });

  it('createSuperDocRunProgress nên phát hiện repeatedFailure ở lần lỗi thứ 2', () => {
    const progress = createSuperDocRunProgress();
    expect(isSuperDocToolFailed({ status: 'failed', error: 'Err' })).toBe(true);
    expect(isSuperDocToolFailed({ status: 'ok' })).toBe(false);

    const first = progress.record({
      tool: 'superdoc_stream_text',
      args: { mode: 'replace', anchor: 'A', text: 'B', expectedRevision: 'r1' },
      result: { status: 'failed', error: { message: 'Anchor not found' } },
    });
    expect(first.failed).toBe(true);
    expect(first.repeatedFailure).toBe(false);

    const second = progress.record({
      tool: 'superdoc_stream_text',
      args: { mode: 'replace', anchor: 'A', text: 'B', expectedRevision: 'r2' },
      result: { status: 'failed', error: { message: 'Anchor not found' } },
    });
    expect(second.failed).toBe(true);
    expect(second.repeatedFailure).toBe(true);
    expect(second.stopMessage).toContain('lặp lại 2 lần');
  });
});
