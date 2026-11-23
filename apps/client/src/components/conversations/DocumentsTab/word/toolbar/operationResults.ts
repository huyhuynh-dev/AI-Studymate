/**
 * Kiểm tra kết quả receipt trả về từ Document API hoặc SuperDoc UI command.
 * Bỏ qua mã NO_OP vì thao tác không cần thay đổi gì vẫn hợp lệ.
 */
export function checkReceipt(result: unknown): void {
  if (result === false) {
    throw new Error("Thao tác định dạng hiện không khả dụng cho vùng chọn này.");
  }
  if (
    result &&
    typeof result === "object" &&
    "success" in result &&
    result.success === false
  ) {
    const failure =
      "failure" in result
        ? (result.failure as { code?: string; message?: string } | undefined)
        : undefined;
    if (failure?.code !== "NO_OP") {
      throw new Error(
        failure?.message ?? "Không thể áp dụng định dạng lên tài liệu.",
      );
    }
  }
}
