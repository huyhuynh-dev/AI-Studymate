import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { SelectionTarget } from "superdoc/ui";
import {
  useSuperDocFontOptions,
  useSuperDocFontSizeOptions,
  useSuperDocHost,
  useSuperDocToolbar,
  useSuperDocUI,
} from "superdoc/ui/react";
import {
  WordToolbarIcon,
  type WordToolbarIconName,
} from "./WordToolbarIcons";
import { useSelectionFormatting } from "./useSelectionFormatting";
import { applyDocumentSelection } from "./documentActions";
import {
  computeClampedMenuPosition,
  getMenuPortalTarget,
  useToolbarMenuCapture,
} from "./useToolbarMenuCapture";

type MenuId =
  | "fonts"
  | "table"
  | "underline"
  | "case"
  | "highlight"
  | "color"
  | "bullets"
  | "numbers"
  | "spacing";

type OpenMenu = {
  id: MenuId;
  left: number;
  top: number;
  trigger: HTMLButtonElement;
};

type ToolOptions = (
  | { command: string; menu?: never; action?: never }
  | { command?: never; menu: MenuId; action?: never }
  | { command?: never; menu?: never; action: () => void }
) & {
  payload?: unknown;
  active?: boolean;
  disabled?: boolean;
  className?: string;
};

const MENU_WIDTHS: Record<MenuId, number> = {
  fonts: 260,
  table: 216,
  bullets: 260,
  numbers: 260,
  color: 236,
  highlight: 236,
  spacing: 190,
  case: 204,
  underline: 190,
};

const COLORS = [
  "#000000",
  "#ffffff",
  "#e50022",
  "#ff9900",
  "#fff200",
  "#70ad47",
  "#00b0f0",
  "#0070c0",
  "#7030a0",
  "#666666",
];

const NUMBER_PRESETS = [
  { label: "Số thập phân (1. 2. 3.)", preset: "decimal", markers: ["1.", "2.", "3."] },
  {
    label: "Số kèm ngoặc (1) 2) 3))",
    preset: "decimalParenthesis",
    markers: ["1)", "2)", "3)"],
  },
  {
    label: "La Mã hoa (I. II. III.)",
    preset: "upperRoman",
    markers: ["I.", "II.", "III."],
  },
  { label: "Chữ hoa (A. B. C.)", preset: "upperLetter", markers: ["A.", "B.", "C."] },
  {
    label: "Chữ thường ngoặc (a) b) c))",
    preset: "lowerLetterParenthesis",
    markers: ["a)", "b)", "c)"],
  },
  { label: "Chữ thường (a. b. c.)", preset: "lowerLetter", markers: ["a.", "b.", "c."] },
  {
    label: "La Mã thường (i. ii. iii.)",
    preset: "lowerRoman",
    markers: ["i.", "ii.", "iii."],
  },
];

function ListPreview({ markers }: { markers: string[] }) {
  return (
    <span className="sd-toolbar-list-preview" aria-hidden="true">
      {markers.map((marker, index) => (
        <span key={index}>
          <span>{marker}</span>
          <i />
        </span>
      ))}
    </span>
  );
}

/**
 * Nhóm nút định dạng văn bản & đoạn văn dùng chung bộ điều phối selection với keyboard shortcuts.
 */
export function WordFormattingControls({
  className = "",
}: {
  className?: string;
}) {
  const ui = useSuperDocUI();
  const host = useSuperDocHost();
  const toolbar = useSuperDocToolbar();
  const formatting = useSelectionFormatting();
  const fonts = useSuperDocFontOptions();
  const sizes = useSuperDocFontSizeOptions();
  const { preserveSelection, clearCapturedSelection, restoreSelection } =
    useToolbarMenuCapture();

  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [status, setStatus] = useState("");
  const [formattingPending, setFormattingPending] = useState(false);
  const [tableSize, setTableSize] = useState({ rows: 1, columns: 1 });

  const menuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tableTargetRef = useRef<SelectionTarget | null>(null);
  const fontSearchRef = useRef({ text: "", time: 0 });

  const getCommandState = (command: string) => toolbar.commands[command];
  const readOnly = formatting.readOnly || formatting.pending || formattingPending;

  const font = String(getCommandState("font-family")?.value ?? "Calibri");
  const size = String(getCommandState("font-size")?.value ?? "11");
  const fontOptions = fonts.some((option) => option.value === font)
    ? fonts
    : [{ label: font, value: font, previewFamily: font }, ...fonts];
  const fontLabel =
    fontOptions.find((option) => option.value === font)?.label ?? font;

  const focusEditorSurface = () => {
    const editorHost = ui?.viewport.getHost();
    const imeTarget = editorHost?.querySelector<HTMLElement>(
      '[data-v2-ime-host="true"]',
    );
    (imeTarget ?? editorHost)?.focus?.({ preventScroll: true });
  };

  const closeMenu = (focusTrigger = false) => {
    if (focusTrigger) menu?.trigger.focus();
    setMenu(null);
    clearCapturedSelection();
    tableTargetRef.current = null;
  };

  const run = async (command: string, payload?: unknown) => {
    if (readOnly) return;
    setFormattingPending(true);
    setStatus("");
    const tableTarget = tableTargetRef.current;
    const restored = restoreSelection();
    closeMenu();
    try {
      await restored;
      const doc = host?.activeEditor?.doc;
      if (command === "table-insert" && tableTarget && ui && doc) {
        await applyDocumentSelection(doc, ui, tableTarget);
      }
      await formatting.execute(command, payload);
      focusEditorSurface();
    } catch {
      setStatus("Không thể áp dụng định dạng cho vùng chọn này.");
    } finally {
      setFormattingPending(false);
    }
  };

  const openMenu = (id: MenuId, trigger: HTMLButtonElement) => {
    if (menu?.id === id) {
      closeMenu();
      return;
    }
    preserveSelection();
    fontSearchRef.current = { text: "", time: 0 };
    tableTargetRef.current = null;

    if (id === "table") {
      setTableSize({ rows: 1, columns: 1 });
      const selection = ui?.selection.getSnapshot();
      const target = selection?.target;
      tableTargetRef.current =
        selection?.selectionTarget ??
        (target
          ? {
              kind: "selection",
              start: {
                kind: "text",
                blockId: target.segments[0].blockId,
                offset: target.segments[0].range.start,
                ...(target.story ? { story: target.story } : {}),
              },
              end: {
                kind: "text",
                blockId: target.segments[target.segments.length - 1].blockId,
                offset:
                  target.segments[target.segments.length - 1].range.end,
                ...(target.story ? { story: target.story } : {}),
              },
              ...(target.story ? { story: target.story } : {}),
              ...(target.coordinateSpace
                ? { coordinateSpace: target.coordinateSpace }
                : {}),
            }
          : null);
    }

    const pos = computeClampedMenuPosition(
      trigger,
      MENU_WIDTHS[id],
      id === "fonts" ? 380 : 260,
    );
    setMenu({ id, left: pos.left, top: pos.top, trigger });
  };

  useEffect(() => {
    if (!menu) return;

    const handleOutside = (event: PointerEvent) => {
      const targetNode = event.target as Node;
      if (
        !menuRef.current?.contains(targetNode) &&
        !rootRef.current?.contains(targetNode)
      ) {
        setMenu(null);
        clearCapturedSelection();
        tableTargetRef.current = null;
      }
    };

    const handleDismiss = (event: Event) => {
      if (
        event.target instanceof Node &&
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setMenu(null);
      clearCapturedSelection();
      tableTargetRef.current = null;
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        menu.trigger.focus();
        setMenu(null);
        clearCapturedSelection();
        tableTargetRef.current = null;
      }
    };

    window.document.addEventListener("pointerdown", handleOutside);
    window.document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleDismiss);
    window.addEventListener("scroll", handleDismiss, true);

    const initialFocus =
      menuRef.current?.querySelector<HTMLButtonElement>(
        'button[aria-checked="true"]',
      ) ?? menuRef.current?.querySelector<HTMLButtonElement>("button");
    initialFocus?.focus();

    return () => {
      window.document.removeEventListener("pointerdown", handleOutside);
      window.document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleDismiss);
      window.removeEventListener("scroll", handleDismiss, true);
    };
  }, [clearCapturedSelection, menu]);

  const applyVerticalAlign = async (value: "subscript" | "superscript") => {
    if (readOnly || formattingPending) return;
    const doc = host?.activeEditor?.doc;
    if (!doc?.selection?.current || !doc.format?.apply) return;
    setFormattingPending(true);
    setStatus("");
    try {
      await restoreSelection();
      await formatting.execute(value);
      focusEditorSurface();
    } catch {
      setStatus("Không thể áp dụng định dạng chỉ số trên/dưới.");
    } finally {
      setFormattingPending(false);
    }
  };

  const applyChangeCase = async (transform: (text: string) => string) => {
    if (readOnly || formattingPending) return;
    const doc = host?.activeEditor?.doc;
    if (!doc?.selection?.current || !doc.invoke) return;
    setFormattingPending(true);
    setStatus("");
    try {
      await restoreSelection();
      closeMenu();
      const selection = await formatting.getSelection();
      if (
        selection.empty ||
        !selection.selectionTarget ||
        selection.text === undefined
      ) {
        return;
      }
      const nextText = transform(selection.text);
      if (nextText === selection.text) return;
      await formatting.applyChanges(selection, [
        { kind: "replaceText", target: selection.selectionTarget, text: nextText },
      ]);
      focusEditorSurface();
    } catch {
      setStatus("Không thể chuyển đổi kiểu chữ cho vùng chọn này.");
    } finally {
      setFormattingPending(false);
    }
  };

  const renderToolButton = (
    label: string,
    icon: WordToolbarIconName,
    options: ToolOptions,
  ) => {
    const isActive =
      options.active ??
      (options.command ? Boolean(getCommandState(options.command)?.active) : false);
    const isDisabled =
      readOnly ||
      (options.disabled ??
        (options.command ? !formatting.canExecute(options.command) : false));

    return (
      <button
        type="button"
        className={`sd-toolbar-tool ${options.className ?? ""} ${isActive ? "is-active" : ""}`.trim()}
        aria-label={label}
        title={label}
        disabled={isDisabled}
        aria-pressed={
          options.command || options.active !== undefined ? isActive : undefined
        }
        aria-haspopup={options.menu ? "menu" : undefined}
        aria-expanded={options.menu ? menu?.id === options.menu : undefined}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          if (options.menu) {
            openMenu(options.menu, event.currentTarget);
          } else if (options.action) {
            options.action();
          } else if (options.command) {
            void run(options.command, options.payload);
          }
        }}
      >
        <WordToolbarIcon name={icon} />
        {options.menu ? (
          <span className="sd-toolbar-caret" aria-hidden="true" />
        ) : null}
      </button>
    );
  };

  const renderSplitButton = (
    label: string,
    icon: WordToolbarIconName,
    command: string,
    id: MenuId,
    payload?: unknown,
  ) => (
    <span className="sd-toolbar-split">
      {renderToolButton(label, icon, { command, payload })}
      <button
        type="button"
        className="sd-toolbar-tool sd-toolbar-menu-arrow"
        aria-label={`Tùy chọn ${label.toLowerCase()}`}
        title={`Tùy chọn ${label.toLowerCase()}`}
        aria-haspopup="menu"
        aria-expanded={menu?.id === id}
        disabled={readOnly}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => openMenu(id, event.currentTarget)}
      >
        <span className="sd-toolbar-caret" aria-hidden="true" />
      </button>
    </span>
  );

  const renderMenuItem = (
    label: string,
    action: () => void,
    children?: ReactNode,
  ) => (
    <button
      type="button"
      role="menuitem"
      className={children ? "sd-toolbar-gallery-tile" : "sd-toolbar-menu-item"}
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >
      {children ?? label}
    </button>
  );

  const clearList = () => {
    if (getCommandState("bullet-list")?.active) {
      void run("bullet-list");
    } else if (getCommandState("numbered-list")?.active) {
      void run("numbered-list");
    } else {
      void restoreSelection();
      closeMenu();
    }
  };

  let menuContent: ReactNode = null;
  if (menu) {
    switch (menu.id) {
      case "fonts":
        menuContent = (
          <>
            <div className="sd-toolbar-menu-heading">Phông chữ</div>
            {fontOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={option.value === font}
                aria-label={option.label}
                title={option.label}
                data-font-name={option.label}
                className="sd-toolbar-menu-item sd-toolbar-font-option"
                style={{ fontFamily: option.previewFamily ?? option.value }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void run("font-family", option.value)}
              >
                <span className="sd-toolbar-font-check" aria-hidden="true">
                  {option.value === font ? "✓" : ""}
                </span>
                <span className="truncate">{option.label}</span>
              </button>
            ))}
          </>
        );
        break;
      case "table":
        menuContent = (
          <>
            <div className="sd-toolbar-menu-heading">Chèn bảng</div>
            <div className="sd-toolbar-table-size">
              Bảng {tableSize.columns} × {tableSize.rows}
            </div>
            <div
              className="sd-toolbar-table-grid"
              onPointerLeave={() => setTableSize({ rows: 1, columns: 1 })}
            >
              {Array.from({ length: 48 }, (_, index) => {
                const rows = Math.floor(index / 8) + 1;
                const columns = (index % 8) + 1;
                const selected =
                  rows <= tableSize.rows && columns <= tableSize.columns;
                return (
                  <button
                    key={index}
                    type="button"
                    role="menuitem"
                    aria-label={`Chèn bảng ${columns} cột ${rows} hàng`}
                    title={`Bảng ${columns} × ${rows}`}
                    className={selected ? "is-selected" : ""}
                    onPointerEnter={() => setTableSize({ rows, columns })}
                    onFocus={() => setTableSize({ rows, columns })}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void run("table-insert", { rows, columns })}
                  />
                );
              })}
            </div>
          </>
        );
        break;
      case "bullets":
        menuContent = (
          <>
            <div className="sd-toolbar-menu-heading">Kiểu dấu đầu dòng</div>
            <div className="sd-toolbar-bullet-grid">
              {renderMenuItem("Không dùng dấu đầu dòng", clearList, <span>Không</span>)}
              {(
                [
                  ["Chấm tròn đặc", "disc", "●"],
                  ["Vòng tròn rỗng", "circle", "○"],
                  ["Hình vuông", "square", "▪"],
                ] as const
              ).map(([label, preset, glyph]) => (
                <span key={preset}>
                  {renderMenuItem(
                    label,
                    () =>
                      void run("bullet-list", {
                        preset,
                        behavior: "toggleStyle",
                      }),
                    <span className="sd-toolbar-bullet-glyph">{glyph}</span>,
                  )}
                </span>
              ))}
            </div>
          </>
        );
        break;
      case "numbers":
        menuContent = (
          <>
            <div className="sd-toolbar-menu-heading">Thư viện đánh số</div>
            <div className="sd-toolbar-number-grid">
              {renderMenuItem("Không đánh số", clearList, <span>Không</span>)}
              {NUMBER_PRESETS.map(({ label, preset, markers }) => (
                <span key={preset}>
                  {renderMenuItem(
                    label,
                    () =>
                      void run("numbered-list", {
                        preset,
                        behavior: "toggleStyle",
                      }),
                    <ListPreview markers={markers} />,
                  )}
                </span>
              ))}
            </div>
          </>
        );
        break;
      case "spacing":
        menuContent = (
          <>
            <div className="sd-toolbar-menu-heading">Giãn dòng</div>
            {[1, 1.15, 1.5, 2, 2.5, 3].map((value) => (
              <span key={value}>
                {renderMenuItem(`${value}`, () => void run("line-height", value))}
              </span>
            ))}
          </>
        );
        break;
      case "color":
      case "highlight":
        menuContent = (
          <>
            <div className="sd-toolbar-menu-heading">
              {menu.id === "color" ? "Màu chữ" : "Màu tô sáng"}
            </div>
            <div className="sd-toolbar-color-grid">
              {COLORS.map((color) => (
                <button
                  type="button"
                  role="menuitem"
                  key={color}
                  aria-label={`Áp dụng màu ${color}`}
                  title={color}
                  style={{ backgroundColor: color }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    void run(
                      menu.id === "color" ? "text-color" : "highlight-color",
                      color,
                    )
                  }
                />
              ))}
            </div>
            {menu.id === "highlight"
              ? renderMenuItem("Không tô màu", () =>
                  void run("highlight-color", "none"),
                )
              : renderMenuItem("Màu tự động (Đen)", () =>
                  void run("text-color", "#000000"),
                )}
          </>
        );
        break;
      case "case":
        menuContent = (
          <>
            {renderMenuItem("Viết hoa đầu câu.", () =>
              void applyChangeCase((text) =>
                text
                  .toLowerCase()
                  .replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, (letter) =>
                    letter.toUpperCase(),
                  ),
              ),
            )}
            {renderMenuItem("chữ thường (lowercase)", () =>
              void applyChangeCase((text) => text.toLowerCase()),
            )}
            {renderMenuItem("CHỮ IN HOA (UPPERCASE)", () =>
              void applyChangeCase((text) => text.toUpperCase()),
            )}
            {renderMenuItem("Viết Hoa Từng Từ", () =>
              void applyChangeCase((text) =>
                text
                  .toLowerCase()
                  .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()),
              ),
            )}
            {renderMenuItem("Đảo Hoa/Thường", () =>
              void applyChangeCase((text) =>
                [...text]
                  .map((letter) =>
                    letter === letter.toLowerCase()
                      ? letter.toUpperCase()
                      : letter.toLowerCase(),
                  )
                  .join(""),
              ),
            )}
          </>
        );
        break;
      case "underline":
        menuContent = (
          <>
            {renderMenuItem("Bật / tắt gạch chân", () => void run("underline"))}
          </>
        );
        break;
    }
  }

  const portalTarget = getMenuPortalTarget();

  return (
    <>
      <div
        ref={rootRef}
        className={`sd-toolbar-formatting-controls ${className}`.trim()}
        role="group"
        aria-label="Định dạng văn bản và đoạn văn"
      >
        <div className="sd-toolbar-group sd-toolbar-history-group" role="group" aria-label="Lịch sử">
          <div className="sd-toolbar-row">
            {renderToolButton("Hoàn tác (Ctrl+Z)", "undo", { command: "undo" })}
          </div>
          <div className="sd-toolbar-row">
            {renderToolButton("Làm lại (Ctrl+Y)", "redo", { command: "redo" })}
          </div>
        </div>

        <div className="sd-toolbar-group" role="group" aria-label="Phông chữ">
          <div className="sd-toolbar-row">
            <button
              type="button"
              aria-label="Phông chữ"
              title={`Phông chữ: ${fontLabel}`}
              className="sd-toolbar-font-select"
              disabled={readOnly}
              aria-haspopup="menu"
              aria-expanded={menu?.id === "fonts"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => openMenu("fonts", event.currentTarget)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  openMenu("fonts", event.currentTarget);
                }
              }}
            >
              <span className="sd-toolbar-font-value">{fontLabel}</span>
              <span className="sd-toolbar-caret" aria-hidden="true" />
            </button>

            <select
              aria-label="Cỡ chữ"
              title="Cỡ chữ"
              className="sd-toolbar-size-select"
              value={size}
              disabled={readOnly}
              onPointerDown={preserveSelection}
              onFocus={() => preserveSelection()}
              onBlur={() => {
                if (!menu) clearCapturedSelection();
              }}
              onChange={(event) =>
                void run("font-size", Number(event.target.value))
              }
            >
              {!sizes.some((option) => option.value === size) ? (
                <option value={size}>{size}</option>
              ) : null}
              {sizes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {renderToolButton("Tăng cỡ chữ", "grow", {
              command: "font-size",
              payload: Math.min(1638, Number(size) + 1),
            })}
            {renderToolButton("Giảm cỡ chữ", "shrink", {
              command: "font-size",
              payload: Math.max(1, Number(size) - 1),
            })}
            <span className="sd-toolbar-divider" aria-hidden="true" />
            {renderToolButton("Đổi kiểu chữ hoa/thường", "case", {
              menu: "case",
            })}
            {renderToolButton("Xóa toàn bộ định dạng (Ctrl+Alt+C)", "clear", {
              command: "clear-formatting",
            })}
          </div>

          <div className="sd-toolbar-row sd-toolbar-font-bottom">
            {renderToolButton("In đậm (Ctrl+B)", "bold", { command: "bold" })}
            {renderToolButton("In nghiêng (Ctrl+I)", "italic", {
              command: "italic",
            })}
            {renderSplitButton(
              "Gạch chân (Ctrl+U)",
              "underline",
              "underline",
              "underline",
            )}
            {renderToolButton("Gạch ngang chữ (Ctrl+Shift+X)", "strike", {
              command: "strikethrough",
            })}
            {renderToolButton("Chỉ số dưới (Ctrl+=)", "subscript", {
              action: () => void applyVerticalAlign("subscript"),
              disabled: readOnly || formattingPending,
            })}
            {renderToolButton("Chỉ số trên (Ctrl+Shift+=)", "superscript", {
              action: () => void applyVerticalAlign("superscript"),
              disabled: readOnly || formattingPending,
            })}
            <span className="sd-toolbar-divider" aria-hidden="true" />
            {renderSplitButton(
              "Tô màu nền chữ",
              "highlight",
              "highlight-color",
              "highlight",
              "#fff200",
            )}
            {renderSplitButton(
              "Màu chữ",
              "color",
              "text-color",
              "color",
              "#e50022",
            )}
          </div>
        </div>

        <div
          className="sd-toolbar-group"
          role="group"
          aria-label="Đoạn văn bản và bảng"
        >
          <div className="sd-toolbar-row">
            {renderSplitButton(
              "Danh sách dấu đầu dòng",
              "bullets",
              "bullet-list",
              "bullets",
            )}
            {renderSplitButton(
              "Danh sách đánh số",
              "numbers",
              "numbered-list",
              "numbers",
            )}
            <span className="sd-toolbar-divider" aria-hidden="true" />
            {renderToolButton("Giảm thụt lề", "outdent", {
              command: "indent-decrease",
            })}
            {renderToolButton("Tăng thụt lề", "indent", {
              command: "indent-increase",
            })}
            <span className="sd-toolbar-divider" aria-hidden="true" />
            {renderToolButton("Hiện/Ẩn ký tự định dạng (¶)", "marks", {
              command: "formatting-marks",
            })}
          </div>

          <div className="sd-toolbar-row sd-toolbar-paragraph-bottom">
            {(
              [
                ["left", "Căn trái"],
                ["center", "Căn giữa"],
                ["right", "Căn phải"],
                ["justify", "Căn đều hai bên"],
              ] as const
            ).map(([value, label]) => (
              <span key={value}>
                {renderToolButton(label, value, {
                  command: "text-align",
                  payload: value,
                  active: getCommandState("text-align")?.value === value,
                })}
              </span>
            ))}
            <span className="sd-toolbar-divider" aria-hidden="true" />
            {renderToolButton("Giãn dòng và đoạn", "spacing", {
              menu: "spacing",
            })}
            <span className="sd-toolbar-divider" aria-hidden="true" />
            {renderToolButton("Chèn bảng", "table", {
              menu: "table",
              disabled: !getCommandState("table-insert")?.enabled,
            })}
          </div>
        </div>
      </div>

      {menu && menuContent && portalTarget
        ? createPortal(
            <div
              ref={menuRef}
              className={`sd-toolbar-menu sd-toolbar-menu-${menu.id}`}
              role="menu"
              aria-label={`Menu ${menu.id}`}
              style={{ left: menu.left, top: menu.top }}
              onKeyDown={(event) => {
                const buttons = [
                  ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "button:not(:disabled)",
                  ),
                ];
                const index = buttons.indexOf(
                  window.document.activeElement as HTMLButtonElement,
                );
                if (
                  [
                    "ArrowDown",
                    "ArrowRight",
                    "ArrowUp",
                    "ArrowLeft",
                    "Home",
                    "End",
                  ].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? buttons.length - 1
                        : (index +
                            (["ArrowDown", "ArrowRight"].includes(event.key)
                              ? 1
                              : -1) +
                            buttons.length) %
                          buttons.length;
                  buttons[next]?.focus();
                }

                if (
                  menu.id === "fonts" &&
                  event.key !== " " &&
                  event.key.length === 1 &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.altKey
                ) {
                  event.preventDefault();
                  const now = Date.now();
                  const previous =
                    now - fontSearchRef.current.time < 700
                      ? fontSearchRef.current.text
                      : "";
                  const search = previous + event.key.toLowerCase();
                  fontSearchRef.current = { text: search, time: now };
                  const match =
                    buttons.find((btn) =>
                      btn.dataset.fontName?.toLowerCase().startsWith(search),
                    ) ??
                    buttons.find((btn) =>
                      btn.dataset.fontName
                        ?.toLowerCase()
                        .startsWith(event.key.toLowerCase()),
                    );
                  match?.focus();
                }

                if (event.key === "Tab") {
                  closeMenu();
                }
              }}
            >
              {menuContent}
            </div>,
            portalTarget,
          )
        : null}

      {status ? (
        <div className="sd-toolbar-status" role="status" aria-live="polite">
          <span>{status}</span>
          <button
            type="button"
            aria-label="Đóng thông báo định dạng"
            onClick={() => setStatus("")}
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
