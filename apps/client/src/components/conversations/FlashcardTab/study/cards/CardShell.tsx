import type { ReactNode } from "react";
import { cx, GLASS, Pill, SQUIRCLE } from "../../ui";
import { AudioButton } from "./AudioButton";

interface Props {
  typeLabel: string;
  audioUrl?: string;
  onClick?: () => void;
  children: ReactNode;
}

/** B2 — Khung thẻ lớn: kính mờ, bo rộng, bóng mềm; nhãn loại thẻ ở góc trái, loa ở góc phải */
export function CardShell({ typeLabel, audioUrl, onClick, children }: Props) {
  return (
    <div
      onClick={onClick}
      style={SQUIRCLE}
      className={cx(
        GLASS,
        "relative flex min-h-[340px] w-full max-w-2xl flex-col rounded-[28px] bg-white/85 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_24px_48px_-12px_rgba(79,70,229,0.14),0_2px_6px_rgba(11,28,48,0.04)] sm:p-10",
        onClick && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between">
        <Pill tone="indigo">{typeLabel}</Pill>
        {audioUrl && <AudioButton url={audioUrl} />}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">{children}</div>
    </div>
  );
}
