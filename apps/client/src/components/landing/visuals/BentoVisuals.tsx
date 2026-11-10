import { Check } from "lucide-react";

const raised = "rounded-2xl border border-hairline bg-raised";

export function FlashcardsVisual() {
  return (
    <div className="relative flex h-full min-h-64 items-center justify-center p-6">
      <div className={`${raised} absolute w-[72%] max-w-xs -translate-y-8 scale-90 p-5 opacity-50`} aria-hidden="true">
        <div className="h-3 w-1/2 rounded-full bg-foreground/10" />
      </div>
      <div className={`${raised} absolute w-[80%] max-w-xs -translate-y-4 scale-95 p-5 opacity-80`} aria-hidden="true">
        <div className="h-3 w-2/3 rounded-full bg-foreground/10" />
      </div>
      <div className={`${raised} relative w-[88%] max-w-xs translate-y-4 p-6`}>
        <p className="text-xs font-medium text-primary">Câu hỏi</p>
        <p className="font-heading mt-2 text-lg font-semibold leading-snug tracking-tight">
          Ti thể có chức năng gì trong tế bào?
        </p>
        <div className="mt-4 border-t border-hairline pt-4">
          <p className="text-xs font-medium text-secondary">Đáp án</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Tạo ra phần lớn ATP, nguồn năng lượng chính của tế bào.
          </p>
        </div>
      </div>
    </div>
  );
}

export function SummaryVisual() {
  const widths = ["w-full", "w-11/12", "w-4/5"];
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-5">
      <div className="h-3.5 w-1/3 rounded-full bg-foreground/20" />
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <div className={`h-2.5 rounded-full bg-foreground/10 ${w}`} />
        </div>
      ))}
    </div>
  );
}

export function QuizVisual() {
  const options = ["A", "B", "C", "D"];
  return (
    <div className="flex h-full flex-col justify-center gap-2 p-5">
      <div className="mb-1 h-3 w-3/4 rounded-full bg-foreground/20" />
      {options.map((o) => {
        const selected = o === "C";
        return (
          <div
            key={o}
            className={`flex h-9 items-center gap-3 rounded-xl border px-3 text-xs font-semibold ${
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-hairline bg-raised text-muted"
            }`}
          >
            {o}
            <span className={`h-2 flex-1 rounded-full ${selected ? "bg-primary/30" : "bg-foreground/10"}`} />
          </div>
        );
      })}
    </div>
  );
}

export function RetentionVisual() {
  return (
    <div className="flex h-full items-end p-5">
      <svg viewBox="0 0 400 140" className="h-auto w-full" role="img" aria-label="Đường ghi nhớ được củng cố sau mỗi lần ôn tập">
        <g className="stroke-foreground/10" strokeWidth="1">
          <line x1="0" y1="130" x2="400" y2="130" />
          <line x1="0" y1="70" x2="400" y2="70" strokeDasharray="4 6" />
        </g>
        {/* Đường quên không ôn */}
        <path d="M10 20 C 80 110, 200 125, 390 128" fill="none" strokeWidth="2" strokeDasharray="5 6" className="stroke-foreground/25" />
        {/* Đường ghi nhớ khi ôn đúng lúc */}
        <path
          d="M10 20 C 40 60, 70 70, 100 72 L 100 30 C 140 62, 180 68, 215 70 L 215 26 C 260 52, 310 56, 390 58"
          fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          className="stroke-primary"
        />
        {[100, 215].map((x) => (
          <circle key={x} cx={x} cy={x === 100 ? 30 : 26} r="5" className="fill-primary stroke-raised" strokeWidth="3" />
        ))}
      </svg>
    </div>
  );
}

export function AnalyticsVisual() {
  const bars = [36, 52, 44, 68, 60, 82, 74];
  const days = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  return (
    <div className="flex h-full items-end justify-between gap-4 p-5">
      <div className="pb-2">
        <p className="font-heading text-5xl font-bold tabular-nums tracking-tight">72%</p>
        <p className="mt-1 text-sm text-muted">Mức nắm vững tuần này</p>
      </div>
      <div className="flex h-28 flex-1 max-w-64 items-end gap-2">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={`w-full rounded-lg ${i === bars.length - 2 ? "bg-primary" : "bg-primary/25"}`}
              style={{ height: `${h}%` }}
            />
            <span className="text-[10px] tabular-nums text-muted">{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SecurityVisual() {
  return (
    <div className="flex h-full flex-col justify-center p-6">
      <p className="font-heading text-[clamp(2.5rem,6vw,4rem)] font-bold leading-none tracking-[-0.04em]">
        AES-256
      </p>
      <p className="mt-3 text-sm text-muted">Mã hóa dữ liệu lưu trữ</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {["TLS 1.3 khi truyền tải", "Không chia sẻ cho bên thứ ba"].map((t) => (
          <span key={t} className="rounded-full border border-hairline bg-raised px-3 py-1.5 text-xs font-medium">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
