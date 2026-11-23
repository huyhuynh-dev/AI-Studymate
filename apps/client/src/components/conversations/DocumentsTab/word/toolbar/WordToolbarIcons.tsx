import type { ReactNode } from "react";

export type WordToolbarIconName =
  | "undo"
  | "redo"
  | "grow"
  | "shrink"
  | "case"
  | "clear"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "subscript"
  | "superscript"
  | "highlight"
  | "color"
  | "bullets"
  | "numbers"
  | "outdent"
  | "indent"
  | "marks"
  | "left"
  | "center"
  | "right"
  | "justify"
  | "spacing"
  | "table";

export function WordToolbarIcon({ name }: { name: WordToolbarIconName }) {
  const accent = "var(--sd-toolbar-accent, #2563eb)";
  const glyph = (value: string, props: Record<string, unknown> = {}) => (
    <text
      x="12"
      y="18"
      textAnchor="middle"
      fill="currentColor"
      stroke="none"
      fontSize="19"
      fontFamily="Calibri, Arial, sans-serif"
      {...props}
    >
      {value}
    </text>
  );

  let content: ReactNode;
  switch (name) {
    case "undo":
      content = (
        <path
          strokeWidth="1.6"
          d="M9 8H5V4M5 8c2.6-2.8 7-3.4 10.4-1.3C18.8 8.7 20 12.6 18.6 16c-1.4 3.4-5 5.1-8.6 4.3"
        />
      );
      break;
    case "redo":
      content = (
        <path
          strokeWidth="1.6"
          d="M17 8h4V4M21 8c-2.6-2.8-7-3.4-10.4-1.3C7.2 8.7 6 12.6 7.4 16c1.4 3.4 5 5.1 8.6 4.3"
        />
      );
      break;
    case "grow":
    case "shrink":
      content = (
        <>
          {glyph("A", { x: 10, fontSize: name === "grow" ? 20 : 16 })}
          <path
            stroke={accent}
            strokeWidth="1.7"
            d={name === "grow" ? "m17 7 3-3 3 3" : "m17 4 3 3 3-3"}
          />
        </>
      );
      break;
    case "case":
      content = glyph("Aa", { fontSize: 17 });
      break;
    case "clear":
      content = (
        <>
          {glyph("A", { x: 9 })}
          <path fill="#c571bd" stroke="#a1549b" d="m15 10 6 5-5 6-6-5z" />
          <path stroke="#fff" d="m13 16 4 3" />
        </>
      );
      break;
    case "bold":
      content = glyph("B", { fontWeight: 700, fontSize: 17 });
      break;
    case "italic":
      content = glyph("I", {
        fontStyle: "italic",
        fontFamily: "Georgia, serif",
        fontSize: 17,
      });
      break;
    case "underline":
      content = (
        <>
          {glyph("U", { y: 16, fontSize: 17 })}
          <path d="M6 20h12" />
        </>
      );
      break;
    case "strike":
      content = (
        <>
          {glyph("ab", {
            x: 13,
            y: 13,
            dominantBaseline: "central",
            fontSize: 14,
          })}
          <path d="M3 14.5h20" />
        </>
      );
      break;
    case "subscript":
    case "superscript":
      content = (
        <>
          {glyph("x", { x: 9, fontSize: 18 })}
          {glyph("2", {
            x: 18,
            y: name === "subscript" ? 22 : 9,
            fontSize: 11,
            fill: accent,
          })}
        </>
      );
      break;
    case "highlight":
      content = (
        <>
          <path fill="#737b7e" d="m9 13 9-10 4 4-10 9-5 1z" />
          <path d="m8 14 3 3-4 3H4z" />
          <path stroke="#facc15" strokeWidth="4" d="M2 22h20" />
        </>
      );
      break;
    case "color":
      content = (
        <>
          {glyph("A", { y: 17 })}
          <path stroke="#e50022" strokeWidth="4" d="M2 22h20" />
        </>
      );
      break;
    case "bullets":
    case "numbers":
      content = (
        <>
          {[5, 12, 19].map((y, index) => (
            <g key={y}>
              {name === "bullets" ? (
                <rect
                  x="2"
                  y={y - 1}
                  width="2"
                  height="2"
                  fill={accent}
                  stroke={accent}
                />
              ) : (
                <text
                  x="1"
                  y={y + 2}
                  fill={accent}
                  stroke="none"
                  fontSize="7"
                >{`${index + 1}.`}</text>
              )}
              <path d={`M8 ${y}H22`} />
            </g>
          ))}
        </>
      );
      break;
    case "outdent":
    case "indent":
      content = (
        <>
          <path d="M3 4h19M10 9h12M10 14h12M3 19h19" />
          <path
            stroke={accent}
            strokeWidth="1.5"
            d={name === "indent" ? "M1 11h6M4 8l3 3-3 3" : "M7 11H1M4 8l-3 3 3 3"}
          />
        </>
      );
      break;
    case "marks":
      content = glyph("¶", {
        fontSize: 21,
        fontFamily: "Georgia, serif",
        fontWeight: 700,
      });
      break;
    case "left":
    case "center":
    case "right":
    case "justify":
      content = (
        <>
          {[4, 9, 14, 19].map((y, index) => {
            const short = index % 2 === 1 && name !== "justify";
            const x = !short || name === "left" ? 3 : name === "center" ? 6 : 9;
            return <path key={y} d={`M${x} ${y}h${short ? 12 : 18}`} />;
          })}
        </>
      );
      break;
    case "spacing":
      content = (
        <>
          <path
            stroke={accent}
            d="M5 2v20M2 5l3-3 3 3M2 19l3 3 3-3"
          />
          <path d="M12 5h10M12 12h10M12 19h10" />
        </>
      );
      break;
    case "table":
      content = (
        <>
          <rect x="3" y="4" width="20" height="18" rx="1" />
          <path
            fill="var(--sd-toolbar-table-head, #dbeaf4)"
            stroke="none"
            d="M4 5h18v5H4z"
          />
          <path d="M3 10h20M3 16h20M10 4v18M17 4v18" />
        </>
      );
      break;
  }

  return (
    <svg
      className={`sd-toolbar-icon sd-toolbar-icon-${name}`}
      viewBox="0 0 26 26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}
