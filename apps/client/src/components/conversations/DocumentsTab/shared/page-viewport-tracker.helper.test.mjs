import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveVisiblePageFromOffsets,
  resolveVisiblePageFromRects,
} from "./page-viewport-tracker.helper.ts";

test("returns null for empty inputs", () => {
  assert.equal(resolveVisiblePageFromRects({ top: 0, bottom: 800 }, []), null);
  assert.equal(resolveVisiblePageFromOffsets(0, 800, []), null);
});

test("selects page 1 when viewing top of document", () => {
  const pages = [
    { pageNumber: 1, top: 20, bottom: 920 },
    { pageNumber: 2, top: 940, bottom: 1840 },
    { pageNumber: 3, top: 1860, bottom: 2760 },
  ];
  assert.equal(resolveVisiblePageFromRects({ top: 0, bottom: 700 }, pages), 1);
});

test("selects scrolled-down page 4", () => {
  const pages = [
    { pageNumber: 3, top: -800, bottom: -20 },
    { pageNumber: 4, top: 0, bottom: 900 },
    { pageNumber: 5, top: 920, bottom: 1820 },
  ];
  assert.equal(resolveVisiblePageFromRects({ top: 0, bottom: 700 }, pages), 4);
});

test("prefers page with greater visible overlap when two pages split the viewport", () => {
  // Viewport [0, 700]: page 3 shows 200px (0..200), page 4 shows 450px (250..700)
  const pages = [
    { pageNumber: 3, top: -700, bottom: 200 },
    { pageNumber: 4, top: 250, bottom: 1150 },
  ];
  assert.equal(resolveVisiblePageFromRects({ top: 0, bottom: 700 }, pages), 4);
});

test("breaks tie using 40% focus line when two short pages are both 100% visible", () => {
  // Viewport [0, 1000], focusY = 400. Page 1 (50..350) & Page 2 (370..670) both show 300px; page 2 contains focusY=400
  const pages = [
    { pageNumber: 1, top: 50, bottom: 350 },
    { pageNumber: 2, top: 370, bottom: 670 },
  ];
  assert.equal(
    resolveVisiblePageFromRects({ top: 0, bottom: 1000 }, pages),
    2,
  );
});

test("clips oversized viewport against windowHeight when outer ancestor scrolls", () => {
  // Viewport container expanded to [-1500, 6500] while windowHeight is 900; visible window band [0, 900] shows page 3
  const pages = [
    { pageNumber: 1, top: -1500, bottom: -600 },
    { pageNumber: 2, top: -580, bottom: -10 },
    { pageNumber: 3, top: 10, bottom: 880 },
    { pageNumber: 4, top: 920, bottom: 1820 },
  ];
  assert.equal(
    resolveVisiblePageFromRects({ top: -1500, bottom: 6500 }, pages, 900),
    3,
  );
});

test("resolveVisiblePageFromOffsets resolves virtualized page across 20 pages", () => {
  const pages = Array.from({ length: 20 }, (_, i) => ({
    pageNumber: i + 1,
    top: i * 1000,
    height: 980,
  }));
  // scrollTop=3200, clientHeight=700 -> [3200, 3900], overlaps page 4 (3000..3980) completely
  assert.equal(resolveVisiblePageFromOffsets(3200, 700, pages), 4);
  // scrollTop=14600 -> page 16 (15000..15980) covers majority of [14600, 15300]? 14600..14980 is 380px on page 15 vs 300px on page 16 -> page 15
  assert.equal(resolveVisiblePageFromOffsets(14600, 700, pages), 15);
  // scrollTop=14800 -> page 15 shows 180px (14800..14980), page 16 shows 500px (15000..15500) -> page 16
  assert.equal(resolveVisiblePageFromOffsets(14800, 700, pages), 16);
});
