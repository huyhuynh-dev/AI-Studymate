import { describe, expect, it } from 'vitest';
import {
  createServerCollaborationTextStream,
  createStreamUpdateBuffer,
  partialTextArguments,
  type CollaborativeDocumentHandleLike,
} from './superdoc-server-text-stream.js';

function createMockCollabHandle(): CollaborativeDocumentHandleLike & {
  getParagraphs: () => string[];
  getMutationCount: () => number;
} {
  const paragraphs = [{ nodeId: 'p-1', text: 'Đoạn mở đầu sẵn có.' }];
  let rev = 1;
  let mutationCount = 0;

  return {
    getParagraphs: () => paragraphs.map((p) => p.text),
    getMutationCount: () => mutationCount,
    blocks: {
      async list() {
        return { revision: `rev-${rev}` };
      },
    },
    query: {
      async match({ select, within }) {
        const nodeId = (within as { nodeId?: string } | undefined)?.nodeId;
        const items = [];
        for (const p of paragraphs) {
          if (nodeId && p.nodeId !== nodeId) continue;
          const idx = p.text.indexOf(select.pattern);
          if (idx >= 0) {
            items.push({
              address: { kind: 'block', nodeType: 'paragraph', nodeId: p.nodeId },
              target: {
                kind: 'selection',
                start: { kind: 'text', blockId: p.nodeId, offset: idx },
                end: {
                  kind: 'text',
                  blockId: p.nodeId,
                  offset: idx + select.pattern.length,
                },
              },
            });
          }
        }
        return { items };
      },
    },
    create: {
      async paragraph(input) {
        mutationCount += 1;
        rev += 1;
        const text = typeof input.text === 'string' ? input.text : '';
        const nodeId = `p-${paragraphs.length + 1}`;
        paragraphs.push({ nodeId, text });
        return {
          receipt: { success: true, revision: `rev-${rev}` },
          paragraph: { kind: 'block', nodeType: 'paragraph', nodeId },
        };
      },
    },
    async insert(input) {
      mutationCount += 1;
      rev += 1;
      const target = input.target as {
        start: { blockId: string; offset: number };
      };
      const value = typeof input.value === 'string' ? input.value : '';
      const p = paragraphs.find((item) => item.nodeId === target.start.blockId);
      if (!p) {
        return { receipt: { success: false, error: 'Missing block' } };
      }
      p.text =
        p.text.slice(0, target.start.offset) +
        value +
        p.text.slice(target.start.offset);
      return { receipt: { success: true, revision: `rev-${rev}` } };
    },
    async replace(input) {
      mutationCount += 1;
      rev += 1;
      const target = input.target as {
        start: { blockId: string; offset: number };
        end: { offset: number };
      };
      const text = typeof input.text === 'string' ? input.text : '';
      const p = paragraphs.find((item) => item.nodeId === target.start.blockId);
      if (!p) {
        return { receipt: { success: false, error: 'Missing block' } };
      }
      p.text =
        p.text.slice(0, target.start.offset) + text + p.text.slice(target.end.offset);
      return { receipt: { success: true, revision: `rev-${rev}` } };
    },
  };
}

describe('superdoc-server-text-stream', () => {
  it('partialTextArguments tách đúng tham số đang stream từng phần', () => {
    expect(partialTextArguments('{"text":"chưa có mode"')).toBeUndefined();
    expect(
      partialTextArguments('{"mode":"append","anchor":null,"text":"Xin'),
    ).toEqual({
      mode: 'append',
      anchor: null,
      text: 'Xin',
    });
    expect(
      partialTextArguments(
        '{"mode":"replace","anchor":"Đoạn cũ","text":"Đoạn\\u0020mới\\n',
      ),
    ).toEqual({
      mode: 'replace',
      anchor: 'Đoạn cũ',
      text: 'Đoạn mới\n',
    });
  });

  it('stream từng đợt 5 ký tự / 50ms lên handle cộng tác và commit phần cuối đầy đủ', async () => {
    const handle = createMockCollabHandle();
    const writer = createServerCollaborationTextStream(handle, {
      changeMode: 'tracked',
    });
    const buffer = createStreamUpdateBuffer(writer, undefined, {
      charactersPerUpdate: 5,
      updateIntervalMs: 10,
    });

    buffer.push({
      mode: 'append',
      anchor: null,
      text: 'Ngôi nhà nhỏ',
    });
    await new Promise((r) => setTimeout(r, 25));
    buffer.push({
      mode: 'append',
      anchor: null,
      text: 'Ngôi nhà nhỏ thân yêu của em.',
    });

    await buffer.drain();
    const receipt = await writer.commit({
      mode: 'append',
      anchor: null,
      text: 'Ngôi nhà nhỏ thân yêu của em.',
    });

    expect(receipt.status).toBe('ok');
    expect(receipt.characters).toBe('Ngôi nhà nhỏ thân yêu của em.'.length);
    expect(handle.getMutationCount()).toBeGreaterThanOrEqual(4);
    expect(handle.getParagraphs()).toEqual([
      'Đoạn mở đầu sẵn có.',
      'Ngôi nhà nhỏ thân yêu của em.',
    ]);
  });
});
