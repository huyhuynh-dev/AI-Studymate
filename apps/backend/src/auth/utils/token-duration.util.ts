const UNIT_TO_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
  w: 60 * 60 * 24 * 7,
};

/**
 * Chuẩn hóa giá trị thời hạn JWT từ biến môi trường về đơn vị giây (number).
 * Hỗ trợ cả số nguyên/chuỗi số (luôn hiểu là giây) và hậu tố s/m/h/d/w/ms
 * để tránh lỗi thư viện `ms` hiểu chuỗi số không đơn vị là mili-giây.
 */
export function parseExpiresInSeconds(
  rawValue: string | number | undefined | null,
  fallbackSeconds: number,
): number {
  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) && rawValue > 0
      ? Math.floor(rawValue)
      : fallbackSeconds;
  }

  if (typeof rawValue !== 'string') {
    return fallbackSeconds;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return fallbackSeconds;
  }

  if (/^\d+$/.test(trimmed)) {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.floor(parsed)
      : fallbackSeconds;
  }

  const msMatch = /^(\d+)\s*ms$/i.exec(trimmed);
  if (msMatch) {
    const msValue = Number(msMatch[1]);
    return Number.isFinite(msValue) && msValue > 0
      ? Math.max(1, Math.floor(msValue / 1000))
      : fallbackSeconds;
  }

  const unitMatch = /^(\d+)\s*([smhdw])$/i.exec(trimmed);
  if (unitMatch) {
    const amount = Number(unitMatch[1]);
    const multiplier = UNIT_TO_SECONDS[unitMatch[2].toLowerCase()];
    if (Number.isFinite(amount) && amount > 0 && multiplier) {
      return Math.floor(amount * multiplier);
    }
  }

  return fallbackSeconds;
}
