/**
 * Tiện ích chuẩn hóa và quy đổi hệ tọa độ giữa Docling và EmbedPDF
 * 
 * - Docling lưu bbox theo đơn vị points với coord_origin: "BOTTOMLEFT" (trục Y hướng từ dưới lên)
 *   hoặc "TOPLEFT" (trục Y hướng từ trên xuống).
 * - EmbedPDF (@embedpdf/plugin-scroll) sử dụng hệ tọa độ points với gốc TOPLEFT chuẩn PDF.
 * - Hỗ trợ cả 2 dạng dữ liệu từ backend:
 *   + Dạng lồng (Nested): { page_no, bbox: { l, t, r, b, coord_origin } }
 *   + Dạng phẳng (Flat): { page_no, l, t, r, b, coord_origin }
 */

export interface RawDoclingBBox {
  page_no?: number;
  label?: string;
  self_ref?: string;
  l?: number;
  t?: number;
  r?: number;
  b?: number;
  coord_origin?: 'BOTTOMLEFT' | 'TOPLEFT' | string;
  bbox?: {
    l?: number;
    t?: number;
    r?: number;
    b?: number;
    coord_origin?: 'BOTTOMLEFT' | 'TOPLEFT' | string;
  };
}

export interface FlatBBox {
  page_no?: number;
  l: number;
  t: number;
  r: number;
  b: number;
  coord_origin: 'BOTTOMLEFT' | 'TOPLEFT';
}

export interface EmbedPdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Unwrap an toàn dữ liệu bbox nhận từ API backend (xử lý cả nested và flat)
 */
export function unwrapDoclingBBox(rawItem: unknown): FlatBBox | null {
  if (!rawItem || typeof rawItem !== 'object') return null;
  const item = rawItem as RawDoclingBBox;
  const inner = item.bbox && typeof item.bbox === 'object' ? item.bbox : item;

  const l = Number(inner.l ?? 0);
  const t = Number(inner.t ?? 0);
  const r = Number(inner.r ?? 0);
  const b = Number(inner.b ?? 0);

  if (Number.isNaN(l) || Number.isNaN(t) || Number.isNaN(r) || Number.isNaN(b)) {
    return null;
  }

  const rawOrigin = inner.coord_origin || item.coord_origin || 'BOTTOMLEFT';
  const coord_origin =
    String(rawOrigin).toUpperCase() === 'TOPLEFT' ? 'TOPLEFT' : 'BOTTOMLEFT';

  return {
    page_no: typeof item.page_no === 'number' ? item.page_no : undefined,
    l,
    t,
    r,
    b,
    coord_origin,
  };
}

/**
 * Quy đổi Docling BBox sang EmbedPDF Rect (đơn vị points, gốc TOPLEFT)
 * 
 * @param rawItem Đối tượng bbox (có thể ở dạng flat hoặc nested)
 * @param pageHeight Chiều cao trang PDF tính bằng points (mặc định 792 pt = 11 inches)
 */
export function toEmbedPdfRect(
  rawItem: unknown,
  pageHeight: number = 792,
): EmbedPdfRect | null {
  const bbox = unwrapDoclingBBox(rawItem);
  if (!bbox) return null;

  const width = Math.max(1, Math.abs(bbox.r - bbox.l));
  const height = Math.max(1, Math.abs(bbox.t - bbox.b));
  const effectiveHeight = pageHeight > 0 ? pageHeight : 792;

  // Nếu gốc là BOTTOMLEFT: đỉnh trên của box cách mép trên trang là (pageHeight - max(t, b))
  if (bbox.coord_origin === 'BOTTOMLEFT' || bbox.t > bbox.b) {
    const topFromBottom = Math.max(bbox.t, bbox.b);
    return {
      x: Math.min(bbox.l, bbox.r),
      y: Math.max(0, effectiveHeight - topFromBottom),
      width,
      height,
    };
  }

  // Nếu gốc đã là TOPLEFT
  return {
    x: Math.min(bbox.l, bbox.r),
    y: Math.min(bbox.t, bbox.b),
    width,
    height,
  };
}

/**
 * Quy đổi tọa độ points của trang PDF thành tọa độ pixels hiển thị trên màn hình
 * phục vụ cho việc vẽ thẻ Highlight overlay tuyệt đối trong Scroller renderPage.
 */
export function calcBoxPixels(
  rawItem: unknown,
  pagePointWidth: number,
  pagePointHeight: number,
  renderedPixelWidth: number,
  renderedPixelHeight: number,
): { left: number; top: number; width: number; height: number } | null {
  const effectivePointHeight = pagePointHeight > 0 ? pagePointHeight : 792;
  const rect = toEmbedPdfRect(rawItem, effectivePointHeight);
  if (!rect) return null;

  const safePointWidth = pagePointWidth > 0 ? pagePointWidth : 612;
  const safePointHeight = effectivePointHeight;

  const scaleX = renderedPixelWidth / safePointWidth;
  const scaleY = renderedPixelHeight / safePointHeight;

  return {
    left: Math.round(rect.x * scaleX),
    top: Math.round(rect.y * scaleY),
    width: Math.max(4, Math.round(rect.width * scaleX)),
    height: Math.max(4, Math.round(rect.height * scaleY)),
  };
}
