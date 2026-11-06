import { Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { FONT_HEADING, cx } from "./tokens";

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Hộp thoại xác nhận hành động nguy hiểm chuẩn Apple Destructive Alert Sheet */
export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = "Hủy bỏ", onConfirm, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} size="sm" bare>
      <div className="flex flex-col items-start">
        <span className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400">
          <Trash2 className="h-6 w-6" />
        </span>
        <h2 className={cx(FONT_HEADING, "mt-4 text-lg font-bold text-neutral-900 dark:text-white")}>{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{description}</p>
        <div className="mt-6 flex w-full items-center justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
