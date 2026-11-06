import type { ReactNode } from "react";
import { cx, GLASS, Pill, SHADOW_3, SQUIRCLE } from "../../ui";
import { AudioButton } from "./AudioButton";

interface Props {
  typeLabel: string;
  audioUrl?: string;
  onClick?: () => void;
  children: ReactNode;
}

/** B2 — Khung thẻ lớn chuẩn Apple Stage Card: phân tầng trục Z, bo 28px, bóng chiều sâu */
export function CardShell({ typeLabel, audioUrl, onClick, children }: Props) {
  return (
    <div
      onClick={onClick}
      style={SQUIRCLE}
      className={cx(
        GLASS,
        SHADOW_3,
        "relative flex min-h-[340px] w-full max-w-2xl flex-col rounded-[28px] p-6 sm:p-10 transition-transform duration-200",
        onClick && "cursor-pointer active:scale-[0.99]"
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
