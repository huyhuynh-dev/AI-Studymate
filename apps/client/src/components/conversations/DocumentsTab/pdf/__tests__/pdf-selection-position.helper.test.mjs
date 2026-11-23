import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePdfSelectionMenuPosition,
  PDF_COMPACT_MENU_HEIGHT,
  PDF_EXPANDED_MENU_HEIGHT,
  PDF_EXPANDED_MENU_WIDTH,
  PDF_MENU_GAP,
  PDF_PAGE_EDGE_PADDING,
} from '../pdf-selection-position.helper.ts';

describe('pdf-selection-position.helper', () => {
  it('đặt menu gọn phía trên vùng chọn khi suggestTop=true và kẹp biên trái/phải hợp lệ', () => {
    const pos = computePdfSelectionMenuPosition({
      rectOriginX: 250,
      rectWidth: 140,
      rectHeight: 20,
      suggestTop: true,
      spaceAbove: 120,
      spaceBelow: 400,
      pageWidth: 800,
      isExpanded: false,
    });

    assert.equal(pos.placedAbove, true);
    assert.equal(pos.top, -(PDF_COMPACT_MENU_HEIGHT + PDF_MENU_GAP));
    assert.ok(250 + pos.left >= PDF_PAGE_EDGE_PADDING);
    assert.ok(250 + pos.left + pos.menuWidth <= 800 - PDF_PAGE_EDGE_PADDING);
  });

  it('tự động lật xuống dưới khi mở rộng khung Prompt mà phía trên không đủ chỗ', () => {
    const pos = computePdfSelectionMenuPosition({
      rectOriginX: 100,
      rectWidth: 180,
      rectHeight: 24,
      suggestTop: true,
      spaceAbove: 70, // đủ cho compact 44px nhưng thiếu cho expanded 176px
      spaceBelow: 350,
      pageWidth: 800,
      isExpanded: true,
    });

    assert.equal(pos.placedAbove, false);
    assert.equal(pos.top, 24 + PDF_MENU_GAP);
    assert.equal(pos.menuWidth, PDF_EXPANDED_MENU_WIDTH);
  });

  it('giữ phía trên khi mở rộng nếu phía trên đủ chỗ và phía dưới bị chật', () => {
    const pos = computePdfSelectionMenuPosition({
      rectOriginX: 200,
      rectWidth: 120,
      rectHeight: 18,
      suggestTop: false,
      spaceAbove: 260,
      spaceBelow: 90,
      pageWidth: 800,
      isExpanded: true,
    });

    assert.equal(pos.placedAbove, true);
    assert.equal(pos.top, -(PDF_EXPANDED_MENU_HEIGHT + PDF_MENU_GAP));
  });

  it('kẹp sát mép trái và mép phải để không tràn khỏi trang PDF hẹp', () => {
    const nearLeft = computePdfSelectionMenuPosition({
      rectOriginX: 12,
      rectWidth: 60,
      rectHeight: 18,
      suggestTop: true,
      spaceAbove: 220,
      spaceBelow: 300,
      pageWidth: 460,
      isExpanded: true,
    });
    assert.equal(12 + nearLeft.left, PDF_PAGE_EDGE_PADDING);

    const nearRight = computePdfSelectionMenuPosition({
      rectOriginX: 400,
      rectWidth: 50,
      rectHeight: 18,
      suggestTop: true,
      spaceAbove: 220,
      spaceBelow: 300,
      pageWidth: 460,
      isExpanded: true,
    });
    assert.equal(
      400 + nearRight.left + nearRight.menuWidth,
      460 - PDF_PAGE_EDGE_PADDING,
    );
  });
});
