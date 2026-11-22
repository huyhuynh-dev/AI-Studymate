export function isSuperDocToolFailed(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const obj = result as Record<string, unknown>;

  if (Array.isArray(obj.receipts)) {
    if (
      typeof obj.total === 'number' &&
      typeof obj.completed === 'number' &&
      obj.completed !== obj.total
    ) {
      return true;
    }
    if (
      obj.receipts.some((r) => {
        if (!r || typeof r !== 'object') return false;
        const receipt = r as Record<string, unknown>;
        return receipt.ok === false || isSuperDocToolFailed(receipt.result);
      })
    ) {
      return true;
    }
  }

  const nestedResult =
    typeof obj.result === 'object' && obj.result !== null
      ? (obj.result as Record<string, unknown>)
      : undefined;

  return (
    obj.ok === false ||
    obj.success === false ||
    nestedResult?.success === false ||
    obj.status === 'failed' ||
    Boolean(obj.error)
  );
}

function extractToolErrorDetail(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return 'Công cụ báo lỗi không xác định.';
  }
  const obj = result as Record<string, unknown>;
  const receipts = Array.isArray(obj.receipts) ? obj.receipts : undefined;
  const failedReceipt = receipts?.find((r) => {
    if (!r || typeof r !== 'object') return false;
    const item = r as Record<string, unknown>;
    return item.ok === false || isSuperDocToolFailed(item.result);
  }) as Record<string, unknown> | undefined;

  const failure =
    typeof obj.failure === 'object' && obj.failure !== null
      ? (obj.failure as Record<string, unknown>)
      : undefined;
  const nestedResult =
    typeof obj.result === 'object' && obj.result !== null
      ? (obj.result as Record<string, unknown>)
      : undefined;
  const nestedFailure =
    typeof nestedResult?.failure === 'object' && nestedResult.failure !== null
      ? (nestedResult.failure as Record<string, unknown>)
      : undefined;
  const failedReceiptResult =
    typeof failedReceipt?.result === 'object' && failedReceipt.result !== null
      ? (failedReceipt.result as Record<string, unknown>)
      : undefined;
  const failedReceiptFailure =
    typeof failedReceiptResult?.failure === 'object' &&
    failedReceiptResult.failure !== null
      ? (failedReceiptResult.failure as Record<string, unknown>)
      : undefined;

  const detail =
    obj.error ??
    failure?.message ??
    nestedFailure?.message ??
    failedReceipt?.error ??
    failedReceiptFailure?.message ??
    obj.reason;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail);
  }
  return 'Công cụ báo lỗi không xác định.';
}

function normalizeStableArguments(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeStableArguments);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .filter(
      (key) =>
        key !== 'expectedRevision' &&
        key !== 'changeMode' &&
        record[key] != null,
    )
    .map((key) => [key, normalizeStableArguments(record[key])]);

  return Object.fromEntries(entries);
}

export interface SuperDocRunProgressTracker {
  record(call: {
    tool: string;
    args: Record<string, unknown>;
    result: unknown;
  }): {
    failed: boolean;
    repeatedFailure: boolean;
    stopMessage?: string;
  };
}

/**
 * Theo dõi tiến độ các lệnh gọi tool SuperDoc trong một lượt chat để ngắt ngay
 * khi cùng một thao tác lỗi lặp lại 2 lần liên tiếp (giống agent-run-progress.js trong Demo).
 */
export function createSuperDocRunProgress(): SuperDocRunProgressTracker {
  const failures = new Map<string, number>();

  return {
    record({ tool, args, result }) {
      if (!isSuperDocToolFailed(result)) {
        return { failed: false, repeatedFailure: false };
      }

      const error = extractToolErrorDetail(result);
      const obj =
        typeof result === 'object' && result !== null
          ? (result as Record<string, unknown>)
          : undefined;
      const issues = Array.isArray(obj?.issues)
        ? obj.issues
            .map(normalizeStableArguments)
            .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
        : undefined;

      const signature = JSON.stringify({
        tool,
        args: normalizeStableArguments(args),
        code: obj?.code,
        ...(issues ? { issues } : { error }),
      });

      const attempts = (failures.get(signature) ?? 0) + 1;
      failures.set(signature, attempts);

      if (attempts >= 2) {
        return {
          failed: true,
          repeatedFailure: true,
          stopMessage: `Đã dừng thao tác "${tool}" do lỗi lặp lại 2 lần liên tiếp: ${error}. Hãy báo cáo rõ cho người dùng thay vì thử lại cùng tham số.`,
        };
      }

      return { failed: true, repeatedFailure: false };
    },
  };
}
