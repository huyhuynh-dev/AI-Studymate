export interface PageVerticalRect {
  pageNumber: number;
  top: number;
  bottom: number;
}

export interface PageOffsetMetrics {
  pageNumber: number;
  top: number;
  height: number;
}

interface CandidatePageScore {
  pageNumber: number;
  overlapPx: number;
  containsFocus: boolean;
  distanceToFocus: number;
}

const OVERLAP_TIE_TOLERANCE_PX = 8;
const DEFAULT_FALLBACK_VIEWPORT_HEIGHT = 800;

/**
 * Resolve the active 1-based page number from measured page vertical bounds inside a viewport.
 * Clips against window bounds when outer containers scroll so visible on-screen pages win.
 */
export function resolveVisiblePageFromRects(
  viewportRect: { top: number; bottom: number },
  pageRects: readonly PageVerticalRect[],
  windowHeight?: number,
): number | null {
  if (pageRects.length === 0) return null;

  const hasWindowClip =
    typeof windowHeight === "number" &&
    Number.isFinite(windowHeight) &&
    windowHeight > 0;
  const visTop = hasWindowClip
    ? Math.max(viewportRect.top, 0)
    : viewportRect.top;
  const visBottom = hasWindowClip
    ? Math.min(viewportRect.bottom, windowHeight)
    : viewportRect.bottom;

  if (
    !Number.isFinite(visTop) ||
    !Number.isFinite(visBottom) ||
    visBottom <= visTop
  ) {
    return null;
  }

  const focusY = visTop + (visBottom - visTop) * 0.4;
  const candidates: CandidatePageScore[] = [];

  for (const page of pageRects) {
    if (
      !Number.isFinite(page.pageNumber) ||
      page.pageNumber < 1 ||
      !Number.isFinite(page.top) ||
      !Number.isFinite(page.bottom) ||
      page.bottom <= page.top
    ) {
      continue;
    }

    const overlapPx = Math.max(
      0,
      Math.min(page.bottom, visBottom) - Math.max(page.top, visTop),
    );
    const containsFocus = page.top <= focusY && page.bottom >= focusY;
    const distanceToFocus = containsFocus
      ? 0
      : Math.min(Math.abs(page.top - focusY), Math.abs(page.bottom - focusY));

    candidates.push({
      pageNumber: Math.trunc(page.pageNumber),
      overlapPx,
      containsFocus,
      distanceToFocus,
    });
  }

  if (candidates.length === 0) return null;

  const intersecting = candidates.filter((c) => c.overlapPx > 0);
  if (intersecting.length === 0) {
    candidates.sort(
      (a, b) =>
        a.distanceToFocus - b.distanceToFocus || a.pageNumber - b.pageNumber,
    );
    return candidates[0].pageNumber;
  }

  let best = intersecting[0];
  for (let i = 1; i < intersecting.length; i += 1) {
    const candidate = intersecting[i];
    const overlapDiff = candidate.overlapPx - best.overlapPx;
    if (overlapDiff > OVERLAP_TIE_TOLERANCE_PX) {
      best = candidate;
      continue;
    }
    if (Math.abs(overlapDiff) <= OVERLAP_TIE_TOLERANCE_PX) {
      if (candidate.containsFocus !== best.containsFocus) {
        if (candidate.containsFocus) {
          best = candidate;
        }
        continue;
      }
      if (candidate.distanceToFocus !== best.distanceToFocus) {
        if (candidate.distanceToFocus < best.distanceToFocus) {
          best = candidate;
        }
        continue;
      }
      if (candidate.pageNumber < best.pageNumber) {
        best = candidate;
      }
    }
  }

  return best.pageNumber;
}

/**
 * Fallback resolver for virtualized scroll viewers using scrollTop, clientHeight, and page offset metrics.
 */
export function resolveVisiblePageFromOffsets(
  scrollTop: number,
  clientHeight: number,
  pages: readonly PageOffsetMetrics[],
): number | null {
  if (pages.length === 0) return null;

  const safeScrollTop = Number.isFinite(scrollTop) ? scrollTop : 0;
  const effectiveHeight =
    Number.isFinite(clientHeight) && clientHeight > 0
      ? clientHeight
      : DEFAULT_FALLBACK_VIEWPORT_HEIGHT;

  const rects: PageVerticalRect[] = [];
  for (const page of pages) {
    if (
      !Number.isFinite(page.pageNumber) ||
      page.pageNumber < 1 ||
      !Number.isFinite(page.top) ||
      !Number.isFinite(page.height) ||
      page.height <= 0
    ) {
      continue;
    }
    rects.push({
      pageNumber: Math.trunc(page.pageNumber),
      top: page.top,
      bottom: page.top + page.height,
    });
  }

  if (rects.length === 0) return null;

  return resolveVisiblePageFromRects(
    { top: safeScrollTop, bottom: safeScrollTop + effectiveHeight },
    rects,
  );
}
