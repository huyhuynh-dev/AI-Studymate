"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button, Row, RowGroup, SectionCard, TextField } from "./shared";

export interface DangerZoneSectionProps {
    onDeleteAccount?: () => void | Promise<void>;
}

/** Bỏ dấu + chữ thường để "XÓA", "xóa", "xoa" đều hợp lệ (bàn phím không gõ được dấu vẫn xác nhận được). */
function normalize(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

const CONFIRM_KEYWORD = "xoa";

function DeleteDialogContent({
    titleId,
    onCancel,
    onConfirm,
}: {
    titleId: string;
    onCancel: () => void;
    onConfirm: () => Promise<void>;
}) {
    const [confirmText, setConfirmText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [hasError, setHasError] = useState(false);

    const canConfirm = normalize(confirmText) === CONFIRM_KEYWORD;

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canConfirm) return;

        setIsDeleting(true);
        setHasError(false);
        try {
            await onConfirm();
        } catch {
            setHasError(true);
            setIsDeleting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} noValidate className="landing-pop p-6">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-error/10 text-error">
                <AlertTriangle className="size-6" aria-hidden />
            </span>

            <h2
                id={titleId}
                className="mt-4 font-heading text-xl font-semibold tracking-tight text-foreground"
            >
                Xóa tài khoản vĩnh viễn?
            </h2>
            <p className="mt-2 text-sm text-muted">
                Toàn bộ tài liệu đã tải lên, tóm tắt bài giảng AI và các bộ flashcard của bạn sẽ bị xóa
                khỏi hệ thống. Hành động này không thể hoàn tác.
            </p>

            <div className="mt-5">
                <TextField
                    label="Nhập “XÓA” để xác nhận"
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    error={hasError ? "Không thể xóa tài khoản. Vui lòng thử lại." : undefined}
                />
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button onClick={onCancel} disabled={isDeleting}>
                    Hủy
                </Button>
                <Button type="submit" variant="danger" disabled={!canConfirm} isLoading={isDeleting}>
                    <Trash2 className="size-4" aria-hidden />
                    Xóa vĩnh viễn
                </Button>
            </div>
        </form>
    );
}

export default function DangerZoneSection({ onDeleteAccount }: DangerZoneSectionProps) {
    const titleId = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    // Nội dung dialog chỉ mount khi mở → state nhập liệu tự reset, animation chạy lại mỗi lần mở.
    const [isOpen, setIsOpen] = useState(false);

    const openDialog = () => {
        setIsOpen(true);
        dialogRef.current?.showModal(); // focus trap + Esc + inert nền do trình duyệt xử lý
    };

    const closeDialog = () => dialogRef.current?.close();

    const confirmDelete = async () => {
        await onDeleteAccount?.();
        closeDialog();
    };

    return (
        <>
            <SectionCard
                id="danger-zone"
                tone="danger"
                title="Vùng nguy hiểm"
                description="Các hành động vĩnh viễn, không thể khôi phục."
            >
                <RowGroup>
                    <Row
                        label="Xóa tài khoản"
                        description="Xóa toàn bộ tài liệu, tóm tắt AI và flashcard cá nhân khỏi hệ thống."
                    >
                        <Button variant="danger-quiet" onClick={openDialog} aria-haspopup="dialog">
                            <Trash2 className="size-4" aria-hidden />
                            Xóa tài khoản
                        </Button>
                    </Row>
                </RowGroup>
            </SectionCard>

            <dialog
                ref={dialogRef}
                aria-labelledby={titleId}
                onClose={() => setIsOpen(false)}
                onClick={(event) => {
                    if (event.target === event.currentTarget) closeDialog(); // bấm nền mờ để đóng
                }}
                className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-hairline bg-raised p-0 text-foreground shadow-[0_24px_64px_-16px_rgba(11,28,48,0.28)] backdrop:bg-black/40 backdrop:backdrop-blur-sm"
            >
                {isOpen && (
                    <DeleteDialogContent
                        titleId={titleId}
                        onCancel={closeDialog}
                        onConfirm={confirmDelete}
                    />
                )}
            </dialog>
        </>
    );
}

export { DangerZoneSection };
