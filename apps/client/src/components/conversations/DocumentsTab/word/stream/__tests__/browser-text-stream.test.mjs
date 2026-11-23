import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BrowserTextStreamManager } from "../browser-text-stream.ts";

function createMockDoc({ failOnInsert = false } = {}) {
  const paragraphs = [];
  let revCounter = 1;

  return {
    getParagraphTexts() {
      return paragraphs.map((p) => p.text);
    },
    blocks: {
      async list() {
        return { revision: `rev-${revCounter}` };
      },
    },
    query: {
      async match(query) {
        const pattern = query?.select?.pattern ?? "";
        const targetNodeId = query?.within?.nodeId;
        const items = [];
        for (const p of paragraphs) {
          if (targetNodeId && p.nodeId !== targetNodeId) continue;
          const idx = p.text.indexOf(pattern);
          if (idx >= 0) {
            items.push({
              address: { kind: "block", nodeType: "paragraph", nodeId: p.nodeId },
              target: {
                kind: "selection",
                start: { kind: "text", blockId: p.nodeId, offset: idx },
                end: {
                  kind: "text",
                  blockId: p.nodeId,
                  offset: idx + pattern.length,
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
        const nodeId = `p-${paragraphs.length + 1}`;
        const text = input?.text ?? "";
        paragraphs.push({ nodeId, text });
        revCounter += 1;
        return {
          success: true,
          paragraph: { kind: "block", nodeType: "paragraph", nodeId },
          insertionPoint: {
            kind: "text",
            blockId: nodeId,
            range: { start: 0, end: text.length },
          },
          evaluatedRevision: `rev-${revCounter}`,
        };
      },
    },
    async insert(input) {
      if (failOnInsert) {
        return {
          success: false,
          failure: { code: "INVALID_TARGET", message: "Mock insert failure" },
        };
      }
      const blockId = input?.target?.start?.blockId;
      const offset = input?.target?.start?.offset ?? 0;
      const value = input?.value ?? "";
      const p = paragraphs.find((item) => item.nodeId === blockId);
      assert.ok(p, `Paragraph ${blockId} should exist`);
      p.text = p.text.slice(0, offset) + value + p.text.slice(offset);
      revCounter += 1;
      return {
        receipt: {
          success: true,
          evaluatedRevision: { after: `rev-${revCounter}` },
          effects: {
            insertedText: [
              {
                target: {
                  kind: "text",
                  blockId,
                  range: { start: offset, end: offset + value.length },
                },
              },
            ],
          },
        },
      };
    },
    async replace() {
      throw new Error("Unexpected replace call");
    },
  };
}

describe("BrowserTextStreamManager (Option C fixes)", () => {
  it("không cắt cụt đoạn văn khi khoảng nghỉ giữa 2 đợt token vượt quá 1.8 giây", async () => {
    const doc = createMockDoc();
    const errors = [];
    const manager = new BrowserTextStreamManager({
      doc,
      onError: (err) => errors.push(err),
    });

    manager.pushUpdate(
      "call-1",
      { mode: "append", anchor: null, text: "Ngôi" },
      "tracked",
      false,
    );

    // Giả lập model qua proxy bị ngắt quãng > 2.0 giây trước khi gửi tiếp
    await new Promise((resolve) => setTimeout(resolve, 2100));

    manager.pushUpdate(
      "call-1",
      {
        mode: "append",
        anchor: null,
        text: "Ngôi nhà nhỏ bên hàng cây xanh mát vào mỗi buổi sớm.",
      },
      "tracked",
      true,
    );

    const outcome = await manager.waitForAll({ finalizeTurn: true });
    assert.equal(errors.length, 0);
    assert.equal(outcome.anyLiveSucceeded, true);
    assert.equal(outcome.anyFailed, false);
    assert.deepEqual(doc.getParagraphTexts(), [
      "Ngôi nhà nhỏ bên hàng cây xanh mát vào mỗi buổi sớm.",
    ]);
  });

  it("không cắt ngang call-1 khi call-2 bắt đầu xếp hàng trước lúc call-1 hoàn tất", async () => {
    const doc = createMockDoc();
    const manager = new BrowserTextStreamManager({ doc });

    manager.pushUpdate(
      "call-1",
      { mode: "append", anchor: null, text: "Ngôi" },
      "tracked",
      false,
    );
    await new Promise((resolve) => setTimeout(resolve, 60));

    // call-2 đến sớm hơn trước khi call-1 gửi phần còn lại + isFinal
    manager.pushUpdate(
      "call-2",
      { mode: "append", anchor: null, text: "Đoạn thứ hai đầy đủ nội dung." },
      "tracked",
      true,
    );

    await new Promise((resolve) => setTimeout(resolve, 120));
    manager.pushUpdate(
      "call-1",
      { mode: "append", anchor: null, text: "Ngôi nhà thân yêu của em." },
      "tracked",
      true,
    );

    const outcome = await manager.waitForAll({ finalizeTurn: true });
    assert.equal(outcome.anyLiveSucceeded, true);
    assert.equal(outcome.anyFailed, false);
    assert.deepEqual(doc.getParagraphTexts(), [
      "Ngôi nhà thân yêu của em.",
      "Đoạn thứ hai đầy đủ nội dung.",
    ]);
  });

  it("không nuốt lỗi doc.insert và báo anyFailed=true khi chèn tiếp thất bại", async () => {
    const doc = createMockDoc({ failOnInsert: true });
    const captured = [];
    const manager = new BrowserTextStreamManager({
      doc,
      onError: (err, id) => captured.push({ message: err.message, id }),
    });

    manager.pushUpdate(
      "call-err",
      {
        mode: "append",
        anchor: null,
        text: "Ngôi nhà có hai tầng sơn màu vàng nhạt rất đẹp.",
      },
      "tracked",
      true,
    );

    const outcome = await manager.waitForAll({ finalizeTurn: true });
    assert.equal(outcome.anyFailed, true);
    assert.equal(outcome.anyLiveSucceeded, false);
    assert.equal(captured.length, 1);
    assert.equal(captured[0].id, "call-err");
    assert.match(captured[0].message, /Mock insert failure/);
  });
});
