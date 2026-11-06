"use client";

import { useState } from "react";
import type { Deck } from "../types";
import { Button, Field, Input, Modal, Textarea } from "../ui";

interface Props {
  open: boolean;
  deck: Deck | null;
  onClose: () => void;
  onSubmit: (v: { name: string; description: string }) => void;
}

/** A3 — Hộp thoại Tạo mới / Chỉnh sửa Deck (mount lại mỗi lần mở để reset state) */
export function DeckFormModal({ open, deck, onClose, onSubmit }: Props) {
  if (!open) return null;
  return <DeckFormDialog key={deck?.id ?? "new"} deck={deck} onClose={onClose} onSubmit={onSubmit} />;
}

function DeckFormDialog({ deck, onClose, onSubmit }: Omit<Props, "open">) {
  const [name, setName] = useState(deck?.name ?? "");
  const [description, setDescription] = useState(deck?.description ?? "");
  const [touched, setTouched] = useState(false);
  const invalid = touched && !name.trim();

  const submit = () => {
    setTouched(true);
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim() });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={deck ? "Chỉnh sửa bộ thẻ" : "Tạo bộ thẻ mới"}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" onClick={submit}>
            Lưu bộ thẻ
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Tên bộ thẻ" htmlFor="deck-name" error={invalid ? "Vui lòng nhập tên bộ thẻ." : undefined}>
          <Input id="deck-name" autoFocus value={name} invalid={invalid} onChange={(e) => setName(e.target.value)} placeholder="VD: Ngăn xếp & Hàng đợi" />
        </Field>
        <Field label="Mô tả bộ thẻ" htmlFor="deck-desc" optional>
          <Textarea id="deck-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bộ thẻ này dùng để ôn tập nội dung gì?" />
        </Field>
      </form>
    </Modal>
  );
}
