"use client";

import { Highlighter } from "lucide-react";
import { useRef, useState } from "react";
import { ClozeText } from "../shared/ClozeText";
import type { CardDraft, CardType, Flashcard } from "../types";
import { hasCloze } from "../utils/cloze";
import { Button, Checkbox, Collapse, Field, Input, Modal, SegmentedControl, Textarea } from "../ui";
import { MediaAttach } from "./MediaAttach";

interface Props {
  open: boolean;
  card: Flashcard | null;
  onClose: () => void;
  onSave: (draft: CardDraft) => void;
}

/** B1 — Hộp thoại Thêm / Sửa một Flashcard (mount lại mỗi lần mở để reset state) */
export function CardEditorModal({ open, card, onClose, onSave }: Props) {
  if (!open) return null;
  return <EditorDialog key={card?.id ?? "new"} card={card} onClose={onClose} onSave={onSave} />;
}

function EditorDialog({ card, onClose, onSave }: Omit<Props, "open">) {
  const isEdit = !!card;
  const [type, setType] = useState<CardType>(card?.type ?? "basic");
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [imageUrl, setImageUrl] = useState(card?.imageUrl);
  const [audioUrl, setAudioUrl] = useState(card?.audioUrl);
  const [keepCreating, setKeepCreating] = useState(false);
  const [error, setError] = useState("");
  const frontRef = useRef<HTMLTextAreaElement>(null);

  const validate = () => {
    if (!front.trim()) return "Vui lòng nhập nội dung mặt trước.";
    if (type === "cloze" && !hasCloze(front)) return "Hãy bôi đen một cụm từ rồi bấm “Tạo chỗ trống”.";
    if (type === "basic" && !back.trim()) return "Vui lòng nhập mặt sau.";
    if (type === "typein" && !back.trim()) return "Vui lòng nhập đáp án chính xác.";
    return "";
  };

  const submit = () => {
    const err = validate();
    setError(err);
    if (err) return;
    onSave({ type, front: front.trim(), back: back.trim(), imageUrl, audioUrl });
    if (keepCreating && !isEdit) {
      setFront("");
      setBack("");
      setImageUrl(undefined);
      setAudioUrl(undefined);
      frontRef.current?.focus();
    } else onClose();
  };

  const makeBlank = () => {
    const el = frontRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    if (s === e) return setError("Hãy bôi đen cụm từ cần ẩn trước.");
    setFront(`${front.slice(0, s)}{{${front.slice(s, e)}}}${front.slice(e)}`);
    setError("");
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isEdit ? "Chỉnh sửa thẻ" : "Thêm thẻ mới"}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {isEdit ? <span /> : <Checkbox checked={keepCreating} onChange={setKeepCreating} label="Tiếp tục tạo thẻ tiếp theo" />}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Hủy
            </Button>
            <Button variant="primary" onClick={submit}>
              Lưu thẻ
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <SegmentedControl<CardType>
          value={type}
          onChange={(v) => { setType(v); setError(""); }}
          options={[
            { value: "basic", label: "Cơ bản" },
            { value: "cloze", label: "Điền khuyết" },
            { value: "typein", label: "Gõ đáp án" },
          ]}
        />

        {type === "cloze" ? (
          <>
            <Field label="Nội dung câu hoàn chỉnh" htmlFor="card-front">
              <div className="flex flex-col gap-2">
                <div>
                  <Button size="sm" icon={<Highlighter className="h-4 w-4 text-indigo-600" />} onClick={makeBlank}>
                    Tạo chỗ trống [...]
                  </Button>
                </div>
                <Textarea id="card-front" ref={frontRef} rows={4} value={front} onChange={(e) => setFront(e.target.value)} placeholder="Bôi đen một cụm từ trong câu rồi bấm “Tạo chỗ trống”." />
                <Collapse open={hasCloze(front)}>
                  <p className="rounded-xl bg-[#EFF4FF]/70 px-4 py-3 text-[14px] leading-7 text-[#0B1C30]">
                    <ClozeText text={front} mode="marked" />
                  </p>
                </Collapse>
              </div>
            </Field>
            <Field label="Ghi chú / Giải thích bổ sung ở mặt sau" htmlFor="card-back" optional>
              <Textarea id="card-back" rows={2} value={back} onChange={(e) => setBack(e.target.value)} />
            </Field>
          </>
        ) : (
          <>
            <Field label={type === "basic" ? "Mặt trước (Câu hỏi / Thuật ngữ)" : "Câu hỏi / Gợi ý hiển thị ở mặt trước"} htmlFor="card-front">
              <Textarea id="card-front" ref={frontRef} rows={4} value={front} onChange={(e) => setFront(e.target.value)} />
            </Field>
            {type === "basic" ? (
              <Field label="Mặt sau (Câu trả lời / Định nghĩa)" htmlFor="card-back">
                <Textarea id="card-back" rows={4} value={back} onChange={(e) => setBack(e.target.value)} />
              </Field>
            ) : (
              <Field label="Đáp án chính xác" htmlFor="card-back" hint="Người học sẽ phải gõ khớp từng ký tự với đáp án này.">
                <Input id="card-back" value={back} onChange={(e) => setBack(e.target.value)} />
              </Field>
            )}
          </>
        )}

        {error && <p className="-mt-2 text-[13px] text-[#BA1A1A]">{error}</p>}

        <MediaAttach imageUrl={imageUrl} audioUrl={audioUrl} onImage={setImageUrl} onAudio={setAudioUrl} />
      </div>
    </Modal>
  );
}
