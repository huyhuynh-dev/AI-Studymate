export interface PdfSelectionMenuPositionInput {
  rectOriginX: number;
  rectWidth: number;
  rectHeight: number;
  suggestTop: boolean;
  spaceAbove: number;
  spaceBelow: number;
  pageWidth: number;
  isExpanded: boolean;
  compactReaderMode?: boolean;
}

export interface PdfSelectionMenuPositionResult {
  top: number;
  left: number;
  menuWidth: number;
  placedAbove: boolean;
}

export const PDF_COMPACT_MENU_HEIGHT = 44;
export const PDF_COMPACT_MENU_WIDTH = 304;
export const PDF_COMPACT_READER_MENU_WIDTH = 212;
export const PDF_EXPANDED_MENU_HEIGHT = 176;
export const PDF_EXPANDED_MENU_WIDTH = 392;
export const PDF_MENU_GAP = 10;
export const PDF_PAGE_EDGE_PADDING = 8;

/**
 * Tính toán tọa độ đặt PdfSelectionMenu (theo hệ tọa độ cục bộ của `menuWrapperProps`)
 * có tự động lật trên/dưới (smart flip) và kẹp biên trái/phải để không tràn khỏi trang PDF.
 */
export function computePdfSelectionMenuPosition(
  input: PdfSelectionMenuPositionInput,
): PdfSelectionMenuPositionResult {
  const menuHeight = input.isExpanded
    ? PDF_EXPANDED_MENU_HEIGHT
    : PDF_COMPACT_MENU_HEIGHT;

  const rawTargetWidth = input.isExpanded
    ? PDF_EXPANDED_MENU_WIDTH
    : input.compactReaderMode
      ? PDF_COMPACT_READER_MENU_WIDTH
      : PDF_COMPACT_MENU_WIDTH;

  const maxAllowedWidth = Math.max(200, input.pageWidth - PDF_PAGE_EDGE_PADDING * 2);
  const menuWidth = Math.min(rawTargetWidth, maxAllowedWidth);

  const requiredVerticalSpace = menuHeight + PDF_MENU_GAP;
  let placedAbove = input.suggestTop;

  if (input.isExpanded) {
    if (input.suggestTop) {
      placedAbove =
        input.spaceAbove >= requiredVerticalSpace ||
        input.spaceAbove >= input.spaceBelow;
    } else {
      placedAbove =
        input.spaceBelow < requiredVerticalSpace &&
        input.spaceAbove >= requiredVerticalSpace;
    }
  }

  const top = placedAbove
    ? -(menuHeight + PDF_MENU_GAP)
    : input.rectHeight + PDF_MENU_GAP;

  // Căn giữa menu theo vùng chọn trong hệ tọa độ tương đối của menuWrapperProps (origin tại rect.origin.x)
  const idealRelativeLeft = (input.rectWidth - menuWidth) / 2;
  const minRelativeLeft = PDF_PAGE_EDGE_PADDING - input.rectOriginX;
  const maxRelativeLeft =
    Math.max(
      PDF_PAGE_EDGE_PADDING,
      input.pageWidth - menuWidth - PDF_PAGE_EDGE_PADDING,
    ) - input.rectOriginX;

  const left = Math.min(
    Math.max(idealRelativeLeft, minRelativeLeft),
    Math.max(minRelativeLeft, maxRelativeLeft),
  );

  return {
    top,
    left,
    menuWidth,
    placedAbove,
  };
}
