import { Check, FileText, Layers, ListChecks, NotebookText } from "lucide-react";

/** Khung "giếng" chứa mockup — bán kính 24px lồng trong khung ngoài 32px + padding 8px. */
function Well({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-3 rounded-3xl bg-well p-6 sm:p-8">
      {children}
    </div>
  );
}

const rowCls =
  "flex items-center gap-3 rounded-2xl border border-hairline bg-raised p-4";

function RegisterVisual() {
  return (
    <Well>
      <p className="font-heading text-lg font-semibold tracking-tight">Chào mừng bạn</p>
      <div className="flex h-12 items-center justify-center gap-2 rounded-xl border border-hairline bg-raised text-sm font-medium">
        Tiếp tục với Google
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-hairline" />
        hoặc
        <span className="h-px flex-1 bg-hairline" />
      </div>
      <div className="flex h-12 items-center rounded-xl border border-hairline bg-raised px-4 text-sm text-muted">
        ban@email.com
      </div>
      <div className="flex h-12 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white">
        Tạo tài khoản
      </div>
    </Well>
  );
}

const files = [
  { name: "Giai-tich-1.pdf", pct: 100 },
  { name: "Bai-giang-sinh-hoc.pptx", pct: 64 },
  { name: "Ghi-chu-on-thi.docx", pct: 28 },
];

function UploadVisual() {
  return (
    <Well>
      {files.map((f) => (
        <div key={f.name} className={rowCls}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{f.name}</span>
              <span className="tabular-nums text-muted">{f.pct}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${f.pct}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </Well>
  );
}

const outputs = [
  { icon: Layers, label: "Flashcard", meta: "24 thẻ" },
  { icon: NotebookText, label: "Bản tóm tắt", meta: "5 ý chính" },
  { icon: ListChecks, label: "Câu hỏi ôn tập", meta: "10 câu" },
];

function GenerateVisual() {
  return (
    <Well>
      {outputs.map(({ icon: Icon, label, meta }) => (
        <div key={label} className={rowCls}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs tabular-nums text-muted">{meta}</p>
          </div>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/15 text-secondary">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        </div>
      ))}
    </Well>
  );
}

function ProgressVisual() {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = 0.72;
  return (
    <Well>
      <div className="flex items-center gap-6 rounded-2xl border border-hairline bg-raised p-6">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-foreground/10" />
            <circle
              cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
              className="stroke-primary"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold tabular-nums tracking-tight">
            72%
          </span>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Hôm nay</p>
          <p className="mt-1 tabular-nums text-muted">18 / 25 thẻ đã ôn</p>
        </div>
      </div>
      <div className={rowCls}>
        <span className="h-2 w-2 rounded-full bg-secondary" />
        <p className="text-sm text-muted">
          Tiến bộ <span className="font-semibold tabular-nums text-foreground">+12%</span> so với tuần trước
        </p>
      </div>
    </Well>
  );
}

export const STEP_VISUALS = [
  RegisterVisual,
  UploadVisual,
  GenerateVisual,
  ProgressVisual,
];
