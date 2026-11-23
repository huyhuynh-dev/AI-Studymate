import type {
  ContentControlInfo,
  DocumentApi,
  PartialBrowserDocumentApi,
  SelectionInfo,
  SelectionTarget,
} from "superdoc/ui";
import {
  getSelectedContentControls,
  isContentLocked,
} from "./contentControlSelection";
import { checkReceipt } from "./operationResults";

type MutationPlan = Parameters<DocumentApi["mutations"]["apply"]>[0];
type MutationStep = MutationPlan["steps"][number];
type AtomicPlanEntry = Parameters<
  DocumentApi["plan"]["execute"]
>[0]["entries"][number];

export type ChangeMode = MutationPlan["changeMode"];
export type InlineFormatting = Parameters<
  DocumentApi["format"]["apply"]
>[0]["inline"];

/** Hai dạng biến đổi vùng chọn được hỗ trợ bởi toolbar và phím tắt. */
export type SelectionChange =
  | { kind: "format"; target: SelectionTarget; inline: InlineFormatting }
  | { kind: "replaceText"; target: SelectionTarget; text: string };

interface ApplySelectionChangesInput {
  doc: PartialBrowserDocumentApi;
  selection: SelectionInfo;
  changes: SelectionChange[];
  changeMode: ChangeMode;
}

/**
 * Thực thi mutation nguyên tử lên vùng chọn hiện tại:
 * - Văn bản thường: dùng `doc.mutations.apply` trực tiếp.
 * - Vùng có content control bị khóa: mở khóa tạm -> áp dụng -> khóa lại trong 1 Undo duy nhất.
 */
export async function applySelectionChanges({
  doc,
  selection,
  changes,
  changeMode,
}: ApplySelectionChangesInput): Promise<void> {
  if (changes.length === 0) return;

  const mutation = createMutationPlan(changes, changeMode);
  const selectedControls = await getSelectedContentControls(doc, selection);
  const lockedControls = selectedControls.filter(isContentLocked);

  if (lockedControls.length === 0) {
    if (!doc.mutations?.apply) {
      throw new Error("Trình thực thi mutation của SuperDoc chưa sẵn sàng.");
    }
    checkReceipt(await doc.mutations.apply(mutation));
    return;
  }

  if (!doc.plan?.execute) {
    throw new Error("Chế độ áp dụng định dạng nguyên tử hiện không khả dụng.");
  }

  const unlockControls = lockedControls.map((control) =>
    setControlLock(control, "unlocked"),
  );
  const applyFormatting: AtomicPlanEntry = {
    operationId: "mutations.apply",
    input: mutation,
  };
  const restoreLocks = [...lockedControls]
    .reverse()
    .map((control) => setControlLock(control, control.lockMode));

  const result = await doc.plan.execute({
    atomic: true,
    entries: [...unlockControls, applyFormatting, ...restoreLocks],
  });

  if (result.failure) {
    throw new Error(result.failure.message);
  }
}

function createMutationPlan(
  changes: SelectionChange[],
  changeMode: ChangeMode,
): MutationPlan {
  return {
    atomic: true,
    changeMode,
    steps: changes.map(createMutationStep),
  };
}

function createMutationStep(
  change: SelectionChange,
  index: number,
): MutationStep {
  const where = { by: "target", target: change.target } as const;

  switch (change.kind) {
    case "format":
      return {
        id: `format-${index}`,
        op: "format.apply",
        where,
        args: { inline: change.inline },
      } satisfies Extract<MutationStep, { op: "format.apply" }>;

    case "replaceText":
      return {
        id: `replace-${index}`,
        op: "text.rewrite",
        where,
        args: { replacement: { text: change.text } },
      } satisfies Extract<MutationStep, { op: "text.rewrite" }>;
  }
}

function setControlLock(
  control: ContentControlInfo,
  lockMode: ContentControlInfo["lockMode"],
): AtomicPlanEntry {
  return {
    operationId: "contentControls.setLockMode",
    input: { target: control.target, lockMode },
    options: { changeMode: "direct" },
  };
}
