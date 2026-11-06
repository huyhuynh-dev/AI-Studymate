"use client";

import { useRef, useState } from "react";
import { BASIC_FORMATS, CLOZE_FORMATS, finalizeRich, isRichEmpty, toRichHtml } from "../richtext";
import { ClozeText } from "../shared/ClozeText";
import type { CardDraft, CardType, Flashcard } from "../types";
import { hasCloze } from "../utils/cloze";
import { Button, Checkbox, Collapse, Field, Input, Modal, SegmentedControl } from "../ui";
import { MediaAttach } from "./MediaAttach";
import { RichTextEditor, type RichTextEditorHandle } from "./RichTextEditor";

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
  // Dữ liệu cũ là text thuần → toRichHtml chuyển sang HTML (và đổi {{x}} thành chỗ trống nếu là thẻ cloze)
  const [front, setFront] = useState(() => toRichHtml(card?.front ?? "", { legacyCloze: card?.type === "cloze" }));
  // Mặt sau dạng rich (Cơ bản / ghi chú Cloze) và đáp án Gõ chính xác (text thuần) tách riêng
  // → đổi qua lại giữa các loại thẻ không làm lẫn định dạng
  const [back, setBack] = useState(() => (card && card.type !== "typein" ? toRichHtml(card.back) : ""));
  const [answer, setAnswer] = useState(card?.type === "typein" ? card.back : "");
  const [imageUrl, setImageUrl] = useState(card?.imageUrl);
  const [audioUrl, setAudioUrl] = useState(card?.audioUrl);
  const [keepCreating, setKeepCreating] = useState(false);
  const [error, setError] = useState("");
  const frontRef = useRef<RichTextEditorHandle>(null);

  const validate = () => {
    if (isRichEmpty(front)) return "Vui lòng nhập nội dung mặt trước.";
    if (type === "cloze" && !hasCloze(front)) return "Hãy bôi đen một cụm từ rồi bấm “Chỗ trống”.";
    if (type === "basic" && isRichEmpty(back)) return "Vui lòng nhập mặt sau.";
    if (type === "typein" && !answer.trim()) return "Vui lòng nhập đáp án chính xác.";
    return "";
  };

  const submit = () => {
    const err = validate();
    setError(err);
    if (err) return;
    // finalizeRich = sanitize theo allowlist của loại thẻ (thẻ không phải Cloze sẽ tự gỡ chỗ trống còn sót)
    onSave({
      type,
      front: finalizeRich(front, type === "cloze" ? CLOZE_FORMATS : BASIC_FORMATS),
      back: type === "typein" ? answer.trim() : finalizeRich(back, BASIC_FORMATS),
      imageUrl,
      audioUrl,
    });
    if (keepCreating && !isEdit) {
      setFront("");
      setBack("");
      setAnswer("");
      setImageUrl(undefined);
      setAudioUrl(undefined);
      frontRef.current?.focus();
    } else onClose();
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
                <RichTextEditor
                  id="card-front"
                  ref={frontRef}
                  value={front}
                  onChange={setFront}
                  formats={CLOZE_FORMATS}
                  placeholder="Bôi đen một cụm từ trong câu rồi bấm “Chỗ trống”."
                />
                <Collapse open={hasCloze(front)}>
                  <div className="rounded-xl bg-[#EFF4FF]/70 px-4 py-3 text-[14px] leading-7 text-[#0B1C30]">
                    <p className="mb-0.5 text-[12px] font-semibold text-[#777587]">Người học sẽ thấy</p>
                    <ClozeText text={front} mode="hidden" />
                  </div>
                </Collapse>
              </div>
            </Field>
            <Field label="Ghi chú / Giải thích bổ sung ở mặt sau" htmlFor="card-back" optional>
              <RichTextEditor id="card-back" value={back} onChange={setBack} formats={BASIC_FORMATS} compact />
            </Field>
          </>
        ) : (
          <>
            <Field label={type === "basic" ? "Mặt trước (Câu hỏi / Thuật ngữ)" : "Câu hỏi / Gợi ý hiển thị ở mặt trước"} htmlFor="card-front">
              <RichTextEditor id="card-front" ref={frontRef} value={front} onChange={setFront} formats={BASIC_FORMATS} />
            </Field>
            {type === "basic" ? (
              <Field label="Mặt sau (Câu trả lời / Định nghĩa)" htmlFor="card-back">
                <RichTextEditor id="card-back" value={back} onChange={setBack} formats={BASIC_FORMATS} />
              </Field>
            ) : (
              <Field label="Đáp án chính xác" htmlFor="card-answer" hint="Người học sẽ phải gõ khớp từng ký tự với đáp án này (văn bản thuần, không định dạng).">
                <Input id="card-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
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
