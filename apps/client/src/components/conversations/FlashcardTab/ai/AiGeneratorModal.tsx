"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { CARD_TYPE_LABEL } from "../constants";
import type { AiConfig, AiDocument, CardType } from "../types";
import { Button, ChipToggleGroup, Field, Input, Modal, SegmentedControl, Textarea } from "../ui";
import { DocumentPicker, type DocumentSelection } from "./DocumentPicker";

export type AiTarget = { kind: "new" } | { kind: "deck"; deckId: string; deckName: string };

interface Props {
  target: AiTarget | null;
  documents?: AiDocument[];
  onClose: () => void;
  onGenerate: (cfg: AiConfig) => Promise<void>;
}

/** Hộp thoại cấu hình AI tạo thẻ chuẩn Apple HIG */
export function AiGeneratorModal({ target, documents, onClose, onGenerate }: Props) {
  if (!target) return null;
  return <AiDialog target={target} documents={documents} onClose={onClose} onGenerate={onGenerate} />;
}

const TYPE_OPTIONS = (Object.keys(CARD_TYPE_LABEL) as CardType[]).map((v) => ({ value: v, label: CARD_TYPE_LABEL[v] }));

function AiDialog({
  target,
  documents,
  onClose,
  onGenerate,
}: {
  target: AiTarget;
  documents?: AiDocument[];
  onClose: () => void;
  onGenerate: Props["onGenerate"];
}) {
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<CardType[]>(["basic", "cloze"]);
  const [instructions, setInstructions] = useState("");
  const [deckName, setDeckName] = useState("");
  const [documentIds, setDocumentIds] = useState<DocumentSelection>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDocumentsInput = documents !== undefined;
  const noDocuments = hasDocumentsInput && documents.length === 0;
  const noSelection = Array.isArray(documentIds) && documentIds.length === 0;

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      await onGenerate({
        count,
        types,
        instructions,
        deckName,
        documentIds: hasDocumentsInput ? documentIds : "all",
      });
      onClose();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Không thể tạo thẻ bằng AI. Vui lòng thử lại.";
      setError(msg);
    } finally {
      setLoading(false);
    }
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
            disabled={loading || types.length === 0 || noDocuments || noSelection}
            icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            onClick={generate}
          >
            {loading ? "Đang tạo thẻ bằng AI…" : "Tạo thẻ"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {error && (
          <div
            role="alert"
            className="rounded-xl bg-rose-500/10 px-4 py-3 text-[13px] leading-5 text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-500/20"
          >
            {error}
          </div>
        )}
        {target.kind === "new" && (
          <Field label="Tên bộ thẻ" htmlFor="ai-deck" optional>
            <Input id="ai-deck" value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="Bộ thẻ AI" disabled={loading} />
          </Field>
        )}
        {hasDocumentsInput && (
          <Field label="Tài liệu nguồn" hint={noSelection ? "Chọn ít nhất một tài liệu." : undefined}>
            <DocumentPicker documents={documents ?? []} value={documentIds} onChange={setDocumentIds} />
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
            disabled={loading}
          />
        </Field>
      </div>
    </Modal>
  );
}
