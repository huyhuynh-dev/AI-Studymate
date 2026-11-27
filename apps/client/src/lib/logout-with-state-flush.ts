import { workspaceStateCoordinator } from '@/lib/workspace-state.singleton';
import { usersApi } from '@/services/users.api';

/**
 * Gửi nốt các thay đổi workspace đang chờ (tối đa 1500ms), xóa sạch bộ nhớ
 * coordinator rồi mới thực hiện đăng xuất để chống rò rỉ giữa tài khoản.
 */
export async function logoutWithWorkspaceStateFlush(): Promise<{
  success: boolean;
  serverRevoked?: boolean;
  message?: string;
}> {
  try {
    await workspaceStateCoordinator.flushNow(1500);
  } catch {
    // Không bao giờ để lỗi lưu trạng thái chặn thao tác đăng xuất
  } finally {
    workspaceStateCoordinator.reset();
  }
  return usersApi.logout();
}
