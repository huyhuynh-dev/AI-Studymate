import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkReceipt } from "../operationResults.ts";
import {
  restoreDocumentSelection,
  runDocumentAction,
  waitForDocumentAction,
  waitForDocumentSelection,
} from "../documentActions.ts";
import {
  getFormattingSelection,
  isContentLocked,
} from "../contentControlSelection.ts";

describe("Word toolbar action & selection engine", () => {
  it("checkReceipt bỏ qua NO_OP và ném lỗi khi receipt thất bại", () => {
    assert.doesNotThrow(() => checkReceipt(undefined));
    assert.doesNotThrow(() => checkReceipt({ success: true }));
    assert.doesNotThrow(() =>
      checkReceipt({ success: false, failure: { code: "NO_OP" } }),
    );
    assert.throws(() => checkReceipt(false));
    assert.throws(
      () =>
        checkReceipt({
          success: false,
          failure: { code: "INVALID_TARGET", message: "Vùng chọn lỗi" },
        }),
      /Vùng chọn lỗi/,
    );
  });

  it("runDocumentAction tuần tự hóa các thao tác cùng document và không làm kẹt hàng đợi khi 1 task lỗi", async () => {
    const doc = {};
    const order = [];

    const first = runDocumentAction(doc, async () => {
      await new Promise((r) => setTimeout(r, 25));
      order.push("first");
    });

    const failing = runDocumentAction(doc, async () => {
      order.push("failing");
      throw new Error("boom");
    });

    const third = runDocumentAction(doc, async () => {
      order.push("third");
    });

    await assert.rejects(failing, /boom/);
    await Promise.all([first, third]);
    await waitForDocumentAction(doc);

    assert.deepEqual(order, ["first", "failing", "third"]);
  });

  it("waitForDocumentSelection đợi worker xác nhận đúng range trước khi resolve", async () => {
    const expectedTarget = {
      kind: "selection",
      start: { kind: "text", blockId: "p-1", offset: 2 },
      end: { kind: "text", blockId: "p-1", offset: 8 },
    };

    let pollCount = 0;
    const doc = {
      selection: {
        current: async () => {
          pollCount += 1;
          if (pollCount < 3) {
            return {
              empty: true,
              selectionTarget: {
                kind: "selection",
                start: { kind: "text", blockId: "p-1", offset: 2 },
                end: { kind: "text", blockId: "p-1", offset: 2 },
              },
            };
          }
          return {
            empty: false,
            selectionTarget: expectedTarget,
          };
        },
      },
    };

    await waitForDocumentSelection(doc, expectedTarget, 1000);
    assert.equal(pollCount, 3);
  });

  it("restoreDocumentSelection gọi ui.selection.restore và chờ worker xác nhận khớp target", async () => {
    const target = {
      kind: "selection",
      start: { kind: "text", blockId: "p-2", offset: 0 },
      end: { kind: "text", blockId: "p-2", offset: 5 },
    };

    let restoredCalls = 0;
    const ui = {
      selection: {
        restore: () => {
          restoredCalls += 1;
          return { ok: true, success: true };
        },
      },
    };

    const doc = {
      selection: {
        current: async () => ({
          empty: false,
          selectionTarget: target,
        }),
      },
    };

    await restoreDocumentSelection(doc, ui, {
      selectionTarget: target,
      empty: false,
      capturedAt: Date.now(),
    });
    assert.equal(restoredCalls, 1);

    const failingUi = {
      selection: {
        restore: () => ({ ok: false, success: false }),
      },
    };
    await assert.rejects(
      restoreDocumentSelection(doc, failingUi, {
        selectionTarget: target,
        empty: false,
        capturedAt: Date.now(),
      }),
      /bôi đen lại/i,
    );
  });

  it("isContentLocked và getFormattingSelection xử lý đúng content control bị khóa", async () => {
    assert.equal(isContentLocked({ lockMode: "contentLocked" }), true);
    assert.equal(isContentLocked({ lockMode: "sdtContentLocked" }), true);
    assert.equal(isContentLocked({ lockMode: "unlocked" }), false);

    const bounds = {
      kind: "selection",
      start: { kind: "text", blockId: "b-1", offset: 0 },
      end: { kind: "text", blockId: "b-1", offset: 12 },
    };

    const ui = {
      contentControls: {
        getSnapshot: () => ({ activeIds: ["cc-1"] }),
        get: () => ({ target: { kind: "inline", nodeType: "sdt", nodeId: "cc-1" } }),
      },
    };

    const doc = {
      selection: {
        current: async () => ({
          empty: true,
          selectionTarget: {
            kind: "selection",
            start: { kind: "text", blockId: "b-1", offset: 4 },
            end: { kind: "text", blockId: "b-1", offset: 4 },
          },
          target: null,
          text: "",
        }),
      },
      contentControls: {
        get: async () => ({
          lockMode: "contentLocked",
          selectionTarget: bounds,
          text: "Locked text!",
        }),
      },
    };

    const resolved = await getFormattingSelection(doc, ui);
    assert.equal(resolved.empty, false);
    assert.equal(resolved.text, "Locked text!");
    assert.deepEqual(resolved.selectionTarget, bounds);
  });
});
