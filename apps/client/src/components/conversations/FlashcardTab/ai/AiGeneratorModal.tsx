"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CARD_TYPE_LABEL } from "../constants";
import type { AiConfig, CardType } from "../types";
import { Button, ChipToggleGroup, Field, Input, Modal, SegmentedControl, Textarea } from "../ui";

export type AiTarget = { kind: "new" } | { kind: "deck"; deckId: string; deckName: string };

interface Props {
  target: AiTarget | null;
  onClose: () => void;
  onGenerate: (cfg: AiConfig) => void;
}

/** Hộp thoại cấu hình AI tạo thẻ chuẩn Apple HIG */
export function AiGeneratorModal({ target, onClose, onGenerate }: Props) {
  if (!target) return null;
  return <AiDialog target={target} onClose={onClose} onGenerate={onGenerate} />;
}

const TYPE_OPTIONS = (Object.keys(CARD_TYPE_LABEL) as CardType[]).map((v) => ({ value: v, label: CARD_TYPE_LABEL[v] }));

function AiDialog({ target, onClose, onGenerate }: { target: AiTarget; onClose: () => void; onGenerate: Props["onGenerate"] }) {
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<CardType[]>(["basic", "cloze"]);
  const [instructions, setInstructions] = useState("");
  const [deckName, setDeckName] = useState("");
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const generate = () => {
    setLoading(true);
    timer.current = setTimeout(() => {
      onGenerate({ count, types, instructions, deckName });
      onClose();
    }, 1400);
  };

  return (
    <Modal
      open
      onClose={loading ? () => {} : onClose}
      title="Tạo thẻ bằng AI"
      description={target.kind === "deck" ? `Thêm thẻ vào “${target.deckName}”` : "AI sẽ trích xuất thẻ từ tài liệu trong phiên học này."}
      footer={
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" disabled={loading} onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="primary"
            disabled={loading || types.length === 0}
            icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            onClick={generate}
          >
            {loading ? "Đang tạo thẻ…" : "Tạo thẻ"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {target.kind === "new" && (
          <Field label="Tên bộ thẻ" htmlFor="ai-deck" optional>
            <Input id="ai-deck" value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="Bộ thẻ AI" />
          </Field>
        )}
        <Field label="Số lượng thẻ">
          <SegmentedControl<number>
            value={count}
            onChange={setCount}
            options={[10, 20, 30].map((n) => ({ value: n, label: `${n} thẻ` }))}
          />
        </Field>
        <Field label="Loại thẻ" hint="Chọn ít nhất một loại.">
          <ChipToggleGroup options={TYPE_OPTIONS} value={types} onChange={setTypes} />
        </Field>
        <Field label="Yêu cầu thêm" htmlFor="ai-note" optional>
          <Textarea
            id="ai-note"
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="VD: Tập trung vào chương 3, ưu tiên các định nghĩa quan trọng."
          />
        </Field>
      </div>
    </Modal>
  );
}
