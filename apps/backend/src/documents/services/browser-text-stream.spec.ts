import { describe, expect, it, vi } from 'vitest';
import type { BrowserDocumentApi } from 'superdoc/ui';
import { BrowserTextStreamManager } from '../../../../client/src/components/conversations/DocumentsTab/word/stream/browser-text-stream';

if (typeof globalThis.window === 'undefined') {
  (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
}

function createMockDocApi() {
  let revCounter = 1;
  let blockCounter = 0;
  const blocks = new Map<string, string>();
  const order: string[] = [];

  const events: Array<{
    op: 'create.paragraph' | 'insert';
    blockId?: string;
    offset?: number;
    text: string;
    expectedRevision?: string;
  }> = [];

  const doc = {
    blocks: {
      list: vi.fn(async () => ({
        revision: `rev-${revCounter}`,
        items: [],
      })),
    },
    query: {
      match: vi.fn(async ({ select }: { select: { pattern: string } }) => {
        const items: Array<{
          address: { kind: 'block'; nodeType: 'paragraph'; nodeId: string };
          target: {
            kind: 'text';
            start: { kind: 'text'; blockId: string; offset: number };
            end: { kind: 'text'; blockId: string; offset: number };
          };
        }> = [];
        for (const blockId of order) {
          const text = blocks.get(blockId) ?? '';
          const idx = text.indexOf(select.pattern);
          if (idx !== -1) {
            items.push({
              address: { kind: 'block', nodeType: 'paragraph', nodeId: blockId },
              target: {
                kind: 'text',
                start: { kind: 'text', blockId, offset: idx },
                end: {
                  kind: 'text',
                  blockId,
                  offset: idx + select.pattern.length,
                },
              },
            });
          }
        }
        return { items };
      }),
    },
    create: {
      paragraph: vi.fn(async (input: { text?: string }) => {
        blockCounter += 1;
        revCounter += 1;
        const blockId = `p-${blockCounter}`;
        const text = input.text ?? '';
        blocks.set(blockId, text);
        order.push(blockId);
        events.push({
          op: 'create.paragraph',
          blockId,
          offset: 0,
          text,
        });
        // SuperDoc v2 trả insertionPoint ở cuối phần text vừa chèn (start === end === text.length)
        return {
          success: true,
          paragraph: { kind: 'block', nodeType: 'paragraph', nodeId: blockId },
          insertionPoint: {
            kind: 'text',
            blockId,
            range: { start: text.length, end: text.length },
          },
          evaluatedRevision: `rev-${revCounter}`,
        };
      }),
    },
    insert: vi.fn(
      async (input: {
        target: { start: { blockId: string; offset: number } };
        value: string;
        expectedRevision?: string;
      }) => {
        const blockId = input.target.start.blockId;
        const offset = input.target.start.offset;
        const existing = blocks.get(blockId) ?? '';
        if (offset > existing.length) {
          return {
            success: false,
            failure: {
              code: 'INVALID_TARGET',
              message: `Offset ${offset} exceeds block length ${existing.length}`,
            },
          };
        }
        const nextText =
          existing.slice(0, offset) + input.value + existing.slice(offset);
        blocks.set(blockId, nextText);
        revCounter += 1;
        events.push({
          op: 'insert',
          blockId,
          offset,
          text: input.value,
          expectedRevision: input.expectedRevision,
        });
        return {
          success: true,
          evaluatedRevision: {
            before: `rev-${revCounter - 1}`,
            after: `rev-${revCounter}`,
          },
          effects: {
            insertedText: [
              {
                kind: 'insertedText',
                target: {
                  kind: 'text',
                  blockId,
                  range: { start: offset, end: offset + input.value.length },
                },
                text: input.value,
              },
            ],
          },
        };
      },
    ),
  };

  return {
    doc: doc as unknown as BrowserDocumentApi,
    blocks,
    events,
    spies: doc,
  };
}

describe('BrowserTextStreamManager', () => {
  it('chèn O(1) đúng offset=1 sau doc.create.paragraph và phát tọa độ live cursor', async () => {
    const { doc, blocks, events, spies } = createMockDocApi();
    const cursors: Array<{ blockId: string; offset: number }> = [];

    const manager = new BrowserTextStreamManager({
      doc,
      onCursorMove: (c) => cursors.push({ blockId: c.blockId, offset: c.offset }),
    });

    manager.pushUpdate(
      'call-1',
      { mode: 'append', anchor: null, text: 'Chào' },
      'tracked',
      true,
    );

    const res = await manager.waitForAll();
    expect(res).toEqual({ anyLiveSucceeded: true, anyFailed: false });
    expect(blocks.get('p-1')).toBe('Chào');

    expect(events[0]).toMatchObject({
      op: 'create.paragraph',
      blockId: 'p-1',
      text: 'C',
    });
    expect(events[1]).toMatchObject({
      op: 'insert',
      blockId: 'p-1',
      offset: 1,
      text: 'h',
    });
    expect(events[2]).toMatchObject({
      op: 'insert',
      blockId: 'p-1',
      offset: 2,
      text: 'à',
    });
    expect(events[3]).toMatchObject({
      op: 'insert',
      blockId: 'p-1',
      offset: 3,
      text: 'o',
    });

    expect(spies.query.match).not.toHaveBeenCalled();
    expect(cursors.map((c) => c.offset)).toEqual([1, 2, 3, 4]);

    await manager.dispose();
  });

  it('tuần tự hóa 4 toolCallId qua hàng đợi FIFO toàn cục (Câu 2 chỉ chạy sau khi Câu 1 gõ xong 100%)', async () => {
    const { doc, blocks, events } = createMockDocApi();
    const manager = new BrowserTextStreamManager({ doc });

    manager.pushUpdate(
      'call-1',
      { mode: 'append', anchor: null, text: 'Câu 1' },
      'tracked',
      true,
    );
    manager.pushUpdate(
      'call-2',
      { mode: 'paragraphAfter', anchor: 'Câu 1', text: 'Câu 2' },
      'tracked',
      true,
    );
    manager.pushUpdate(
      'call-3',
      { mode: 'paragraphAfter', anchor: 'Câu 2', text: 'Câu 3' },
      'tracked',
      true,
    );
    manager.pushUpdate(
      'call-4',
      { mode: 'paragraphAfter', anchor: 'Câu 3', text: 'Câu 4' },
      'tracked',
      true,
    );

    const res = await manager.waitForAll();
    expect(res).toEqual({ anyLiveSucceeded: true, anyFailed: false });

    expect(blocks.get('p-1')).toBe('Câu 1');
    expect(blocks.get('p-2')).toBe('Câu 2');
    expect(blocks.get('p-3')).toBe('Câu 3');
    expect(blocks.get('p-4')).toBe('Câu 4');

    const lastP1Idx = events.map((e) => e.blockId).lastIndexOf('p-1');
    const firstP2Idx = events.map((e) => e.blockId).indexOf('p-2');
    const lastP2Idx = events.map((e) => e.blockId).lastIndexOf('p-2');
    const firstP3Idx = events.map((e) => e.blockId).indexOf('p-3');
    const lastP3Idx = events.map((e) => e.blockId).lastIndexOf('p-3');
    const firstP4Idx = events.map((e) => e.blockId).indexOf('p-4');

    expect(lastP1Idx).toBeLessThan(firstP2Idx);
    expect(lastP2Idx).toBeLessThan(firstP3Idx);
    expect(lastP3Idx).toBeLessThan(firstP4Idx);

    await manager.dispose();
  });
});
