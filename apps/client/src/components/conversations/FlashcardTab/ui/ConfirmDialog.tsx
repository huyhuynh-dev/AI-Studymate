import { AlertTriangle } from "lucide-react";
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

/** Hộp thoại xác nhận hành động nguy hiểm (xóa bộ thẻ, xóa thẻ…) */
export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = "Hủy bỏ", onConfirm, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} size="sm" bare>
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFDAD6]/80 text-[#BA1A1A]">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h2 className={cx(FONT_HEADING, "mt-4 text-xl font-semibold tracking-[-0.015em] text-[#0B1C30]")}>{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#464555]/80">{description}</p>
        <div className="mt-6 grid w-full grid-cols-2 gap-3">
          <Button size="lg" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button size="lg" variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
