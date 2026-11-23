import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { StyleCatalogItem } from "superdoc/ui";
import {
  useSuperDocCommand,
  useSuperDocDocument,
  useSuperDocUI,
  useSuperDocZoom,
} from "superdoc/ui/react";
import { useSelectionFormatting } from "./useSelectionFormatting";
import {
  computeClampedMenuPosition,
  getMenuPortalTarget,
  useToolbarMenuCapture,
} from "./useToolbarMenuCapture";

type ActiveMenu =
  | {
      kind: "styles" | "zoom";
      left: number;
      top: number;
      trigger: HTMLButtonElement;
    }
  | null;

const ZOOM_PRESETS = [75, 90, 100, 115, 125, 150];

/**
 * Dropdown chọn nhanh Style (Normal, Heading 1-3...) kèm preview trực quan,
 * bộ điều chỉnh Zoom Fit-Width và thao tác duyệt Track Changes cho RightSidebar.
 */
export const WordStyleAndReviewControls = memo(function WordStyleAndReviewControls() {
  const ui = useSuperDocUI();
  const documentSlice = useSuperDocDocument();
  const zoom = useSuperDocZoom();
  const formatting = useSelectionFormatting();
  const acceptAll = useSuperDocCommand("acceptAllChanges");
  const rejectAll = useSuperDocCommand("rejectAllChanges");
  const { preserveSelection, clearCapturedSelection, restoreSelection } =
    useToolbarMenuCapture();

  const [styles, setStyles] = useState<readonly StyleCatalogItem[]>([]);
  const [activeStyleId, setActiveStyleId] = useState<string | null>(null);
  const [menu, setMenu] = useState<ActiveMenu>(null);
  const [reviewPending, setReviewPending] = useState<"accept" | "reject" | null>(
    null,
  );
  const [status, setStatus] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ui) return;
    const syncStyles = () => {
      const snapshot = ui.styles.getSnapshot();
      setStyles(snapshot.quickGallery);
      setActiveStyleId(snapshot.activeParagraphStyleId);
    };
    syncStyles();
    return ui.styles.observe(syncStyles);
  }, [ui]);

  useEffect(() => {
    if (!menu) return;

    const handleOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !rootRef.current?.contains(target)
      ) {
        setMenu(null);
        clearCapturedSelection();
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
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        menu.trigger.focus();
        setMenu(null);
        clearCapturedSelection();
      }
    };

    window.document.addEventListener("pointerdown", handleOutside);
    window.document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleDismiss);
    window.addEventListener("scroll", handleDismiss, true);

    const firstFocus =
      menuRef.current?.querySelector<HTMLButtonElement>(
        'button[aria-checked="true"]',
      ) ?? menuRef.current?.querySelector<HTMLButtonElement>("button");
    firstFocus?.focus();

    return () => {
      window.document.removeEventListener("pointerdown", handleOutside);
      window.document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleDismiss);
      window.removeEventListener("scroll", handleDismiss, true);
    };
  }, [clearCapturedSelection, menu]);

  const activeStyle = styles.find((item) => item.id === activeStyleId) ?? null;
  const activeStyleLabel = activeStyle?.name ?? "Kiểu văn bản";
  const stylesDisabled =
    !documentSlice.ready ||
    documentSlice.mode === "viewing" ||
    formatting.pending ||
    styles.length === 0;

  const toggleMenu = (
    kind: "styles" | "zoom",
    trigger: HTMLButtonElement,
  ) => {
    if (menu?.kind === kind) {
      setMenu(null);
      clearCapturedSelection();
      return;
    }
    if (kind === "styles") {
      preserveSelection();
    }
    const width = kind === "styles" ? 240 : 168;
    const pos = computeClampedMenuPosition(trigger, width, 280);
    setMenu({ kind, left: pos.left, top: pos.top, trigger });
  };

  const applyStyle = async (styleId: string) => {
    setStatus("");
    const restored = restoreSelection();
    setMenu(null);
    try {
      await restored;
      await formatting.execute("linked-style", styleId);
      const editorHost = ui?.viewport.getHost();
      const imeTarget = editorHost?.querySelector<HTMLElement>(
        '[data-v2-ime-host="true"]',
      );
      (imeTarget ?? editorHost)?.focus?.({ preventScroll: true });
    } catch {
      setStatus("Không thể áp dụng kiểu văn bản cho vùng chọn này.");
    }
  };

  const decideAll = async (action: "accept" | "reject") => {
    if (reviewPending) return;
    const command = action === "accept" ? acceptAll : rejectAll;
    if (!command.enabled) return;

    setReviewPending(action);
    setStatus("");
    try {
      const result = await command.executeAsync();
      if (
        result === false ||
        (typeof result === "object" && result !== null && !result.success)
      ) {
        setStatus(
          action === "accept"
            ? "Không thể chấp nhận toàn bộ thay đổi."
            : "Không thể từ chối toàn bộ thay đổi.",
        );
      }
    } catch {
      setStatus(
        action === "accept"
          ? "Không thể chấp nhận toàn bộ thay đổi."
          : "Không thể từ chối toàn bộ thay đổi.",
      );
    } finally {
      setReviewPending(null);
    }
  };

  const zoomLabel =
    zoom.mode === "fit-width"
      ? `Vừa trang (${Math.round(zoom.value || 100)}%)`
      : `${Math.round(zoom.value || 100)}%`;

  const hasTrackedReviewActions = acceptAll.enabled || rejectAll.enabled;
  const portalTarget = getMenuPortalTarget();

  return (
    <>
      <div
        ref={rootRef}
        className="sd-toolbar-group sd-toolbar-right-group"
        role="group"
        aria-label="Kiểu văn bản, thu phóng và duyệt thay đổi"
      >
        <div className="sd-toolbar-row sd-toolbar-right-row">
          <button
            type="button"
            className="sd-toolbar-dropdown-trigger sd-toolbar-style-trigger"
            disabled={stylesDisabled}
            aria-label={`Kiểu văn bản: ${activeStyleLabel}`}
            title={`Kiểu văn bản: ${activeStyleLabel}`}
            aria-haspopup="menu"
            aria-expanded={menu?.kind === "styles"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => toggleMenu("styles", event.currentTarget)}
          >
            <span className="sd-toolbar-font-value">{activeStyleLabel}</span>
            <span className="sd-toolbar-caret" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="sd-toolbar-dropdown-trigger sd-toolbar-zoom-trigger"
            disabled={!documentSlice.ready}
            aria-label={`Mức thu phóng: ${zoomLabel}`}
            title={`Thu phóng: ${zoomLabel}`}
            aria-haspopup="menu"
            aria-expanded={menu?.kind === "zoom"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => toggleMenu("zoom", event.currentTarget)}
          >
            <span className="sd-toolbar-font-value">
              {zoom.mode === "fit-width"
                ? `Vừa trang`
                : `${Math.round(zoom.value || 100)}%`}
            </span>
            <span className="sd-toolbar-caret" aria-hidden="true" />
          </button>
        </div>

        <div
          className="sd-toolbar-row sd-toolbar-right-row"
          role="group"
          aria-label="Duyệt Track Changes"
          aria-busy={reviewPending !== null}
        >
          <button
            type="button"
            className="sd-toolbar-review-btn sd-toolbar-review-accept"
            disabled={!acceptAll.enabled || reviewPending !== null}
            title="Chấp nhận toàn bộ thay đổi được đề xuất"
            aria-label="Chấp nhận toàn bộ thay đổi"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void decideAll("accept")}
          >
            {reviewPending === "accept" ? "Đang duyệt…" : "✓ Chấp nhận"}
          </button>
          <button
            type="button"
            className="sd-toolbar-review-btn sd-toolbar-review-reject"
            disabled={!rejectAll.enabled || reviewPending !== null}
            title="Từ chối toàn bộ thay đổi được đề xuất"
            aria-label="Từ chối toàn bộ thay đổi"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void decideAll("reject")}
          >
            {reviewPending === "reject" ? "Đang hủy…" : "✕ Từ chối"}
          </button>
          {!hasTrackedReviewActions ? (
            <span className="sd-toolbar-review-hint">Không có đề xuất</span>
          ) : null}
        </div>
      </div>

      {menu && portalTarget
        ? createPortal(
            <div
              ref={menuRef}
              className={`sd-toolbar-menu sd-toolbar-menu-${menu.kind}`}
              role="menu"
              aria-label={
                menu.kind === "styles" ? "Chọn kiểu văn bản" : "Chọn tỷ lệ thu phóng"
              }
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
                  ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? buttons.length - 1
                        : (index +
                            (event.key === "ArrowDown" ? 1 : -1) +
                            buttons.length) %
                          buttons.length;
                  buttons[next]?.focus();
                }
                if (event.key === "Tab") {
                  setMenu(null);
                  clearCapturedSelection();
                }
              }}
            >
              {menu.kind === "styles" ? (
                <>
                  <div className="sd-toolbar-menu-heading">Thư viện Styles</div>
                  {styles.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={activeStyleId === style.id}
                      className="sd-toolbar-menu-item sd-toolbar-style-option"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void applyStyle(style.id)}
                    >
                      <span className="sd-toolbar-font-check" aria-hidden="true">
                        {activeStyleId === style.id ? "✓" : ""}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span
                          className="sd-toolbar-style-sample truncate"
                          style={(style.preview?.css ?? {}) as CSSProperties}
                        >
                          {style.name}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <div className="sd-toolbar-menu-heading">Thu phóng trang</div>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={zoom.mode === "fit-width"}
                    className="sd-toolbar-menu-item sd-toolbar-font-option"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      ui?.zoom.setMode("fit-width");
                      setMenu(null);
                    }}
                  >
                    <span className="sd-toolbar-font-check" aria-hidden="true">
                      {zoom.mode === "fit-width" ? "✓" : ""}
                    </span>
                    <span>Vừa chiều ngang</span>
                  </button>
                  {ZOOM_PRESETS.map((percent) => {
                    const checked =
                      zoom.mode === "manual" &&
                      Math.round(zoom.value) === percent;
                    return (
                      <button
                        key={percent}
                        type="button"
                        role="menuitemradio"
                        aria-checked={checked}
                        className="sd-toolbar-menu-item sd-toolbar-font-option"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          ui?.zoom.set(percent);
                          setMenu(null);
                        }}
                      >
                        <span
                          className="sd-toolbar-font-check"
                          aria-hidden="true"
                        >
                          {checked ? "✓" : ""}
                        </span>
                        <span>{percent}%</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>,
            portalTarget,
          )
        : null}

      {status ? (
        <div className="sd-toolbar-status" role="status" aria-live="polite">
          <span>{status}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setStatus("")}
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
});
