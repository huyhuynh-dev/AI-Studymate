import { describe, expect, it } from 'vitest';
import { parseExpiresInSeconds } from './token-duration.util.js';

describe('parseExpiresInSeconds', () => {
  it('hiểu chuỗi số thuần túy là giây thay vì mili-giây', () => {
    expect(parseExpiresInSeconds('3600', 100)).toBe(3600);
    expect(parseExpiresInSeconds('604800', 100)).toBe(604800);
    expect(parseExpiresInSeconds('2592000', 100)).toBe(2592000);
    expect(parseExpiresInSeconds('  86400  ', 100)).toBe(86400);
  });

  it('chuyển đổi chính xác các hậu tố s/m/h/d/w và ms', () => {
    expect(parseExpiresInSeconds('45s', 100)).toBe(45);
    expect(parseExpiresInSeconds('15m', 100)).toBe(900);
    expect(parseExpiresInSeconds('1h', 100)).toBe(3600);
    expect(parseExpiresInSeconds('7d', 100)).toBe(604800);
    expect(parseExpiresInSeconds('30d', 100)).toBe(2592000);
    expect(parseExpiresInSeconds('1w', 100)).toBe(604800);
    expect(parseExpiresInSeconds('5000ms', 100)).toBe(5);
  });

  it('trả về fallback khi giá trị rỗng, âm hoặc không hợp lệ', () => {
    expect(parseExpiresInSeconds(undefined, 3600)).toBe(3600);
    expect(parseExpiresInSeconds('', 3600)).toBe(3600);
    expect(parseExpiresInSeconds('0', 3600)).toBe(3600);
    expect(parseExpiresInSeconds('-10', 3600)).toBe(3600);
    expect(parseExpiresInSeconds('invalid', 3600)).toBe(3600);
    expect(parseExpiresInSeconds(120, 3600)).toBe(120);
  });
});
