import type {
  BorrowedSuperDocUI,
  PartialBrowserDocumentApi,
  SelectionCapture,
  SelectionInfo,
  SelectionPoint,
  SelectionTarget,
} from "superdoc/ui";

const pendingActions = new WeakMap<PartialBrowserDocumentApi, Promise<void>>();

/** Chờ mọi thao tác phục hồi vùng chọn hoặc mutation trước đó hoàn tất trên Document API. */
export async function waitForDocumentAction(
  doc: PartialBrowserDocumentApi,
): Promise<void> {
  await pendingActions.get(doc);
}

/** Xếp hàng tuần tự các thao tác lên cùng một document để tránh tranh chấp vùng chọn với worker. */
export function runDocumentAction(
  doc: PartialBrowserDocumentApi,
  action: () => Promise<void>,
): Promise<void> {
  const task = (pendingActions.get(doc) ?? Promise.resolve()).then(action);
  const settled = task.catch(() => {});
  pendingActions.set(doc, settled);
  void settled.then(() => {
    if (pendingActions.get(doc) === settled) {
      pendingActions.delete(doc);
    }
  });
  return task;
}

/** `ui.selection.apply` chỉ xếp hàng lệnh sang worker; phải chờ worker xác nhận range thật. */
export async function applyDocumentSelection(
  doc: PartialBrowserDocumentApi,
  ui: BorrowedSuperDocUI,
  target: SelectionTarget,
): Promise<void> {
  if (!ui.selection.apply(target).ok) {
    throw new Error("Không thể khôi phục vùng chọn trong tài liệu.");
  }
  await waitForDocumentSelection(doc, target);
}

/** Phục hồi vùng chọn đã capture trước khi mở menu dropdown và đợi worker xác nhận khớp. */
export async function restoreDocumentSelection(
  doc: PartialBrowserDocumentApi,
  ui: BorrowedSuperDocUI,
  capture: SelectionCapture,
): Promise<void> {
  if (!ui.selection.restore(capture).success) {
    throw new Error("Vui lòng bôi đen lại đoạn văn bản trước khi tiếp tục.");
  }
  if (capture.selectionTarget) {
    await waitForDocumentSelection(doc, capture.selectionTarget);
    return;
  }
  const hasCellOrPainted =
    "_tableCellSelectionTarget" in capture ||
    "_paintedSelectionTarget" in capture;
  if (!hasCellOrPainted) {
    throw new Error("Phạm vi vùng chọn hiện tại không khả dụng.");
  }
}

/** Chờ `doc.selection.current()` phản hồi vùng chọn khớp chính xác với target mong đợi. */
export function waitForDocumentSelection(
  doc: PartialBrowserDocumentApi,
  target: SelectionTarget,
  timeoutMs = 5000,
): Promise<void> {
  const current = doc.selection?.current?.bind(doc.selection);
  if (!current) {
    return Promise.reject(
      new Error("Không thể truy cập trạng thái vùng chọn của tài liệu."),
    );
  }

  return new Promise((resolve, reject) => {
    let done = false;
    let poll: ReturnType<typeof setTimeout> | undefined;

    const finish = (error?: unknown) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      clearTimeout(poll);
      if (error) reject(error);
      else resolve();
    };

    const timeout = setTimeout(
      () =>
        finish(
          new Error(
            "Không thể khôi phục vùng chọn trước khi áp dụng định dạng. Hãy chọn lại văn bản.",
          ),
        ),
      timeoutMs,
    );

    const check = async () => {
      try {
        const selection = await current();
        if (done) return;
        if (selectionMatches(selection, target)) {
          finish();
        } else {
          poll = setTimeout(() => void check(), 16);
        }
      } catch (error) {
        finish(error);
      }
    };

    void check();
  });
}

function selectionMatches(
  selection: SelectionInfo,
  target: SelectionTarget,
): boolean {
  const actual = selection.selectionTarget;
  if (
    !actual ||
    (actual.coordinateSpace ?? "visible") !==
      (target.coordinateSpace ?? "visible")
  ) {
    return false;
  }
  const start = pointKey(target.start, target);
  const end = pointKey(target.end, target);
  return (
    selection.empty === (start === end) &&
    pointKey(actual.start, actual) === start &&
    pointKey(actual.end, actual) === end
  );
}

function pointKey(point: SelectionPoint, range: SelectionTarget): string {
  const story =
    range.story ??
    (point.kind === "text" ? point.story : point.node.story) ??
    { kind: "story", storyType: "body" };
  const storyKey = Object.entries(story).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return JSON.stringify(
    point.kind === "text"
      ? [point.kind, point.blockId, point.offset, storyKey]
      : [
          point.kind,
          point.node.nodeType,
          point.node.nodeId,
          point.edge,
          storyKey,
        ],
  );
}
