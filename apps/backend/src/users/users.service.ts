import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import {
  UsersRepoService,
  type UserProfileRecord,
  type UserProfileStats,
} from '../repo/users-repo/users-repo.service.js';
import { Prisma, User } from '../generated/prisma/client.js';
import { StorageService } from '../storage/storage.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import {
  AVATAR_MAX_SIZE_BYTES,
  RequestAvatarUploadDto,
} from './dto/request-avatar-upload.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';

export interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  avatar_storage_key: string | null;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  daily_goal_minutes: number;
  provider: string | null;
  has_password: boolean;
  created_at: Date;
  updated_at: Date;
  stats: UserProfileStats;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepo: UsersRepoService,
    @Optional() private readonly storageService?: StorageService,
  ) {}

  async createUser(data: Prisma.UserCreateInput): Promise<User | null> {
    return this.usersRepo.createUser(data);
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findUserByEmail(email);
  }

  async findUserById(id: string): Promise<User | null> {
    return this.usersRepo.findUserById(id);
  }

  async updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.usersRepo.updateUser(id, data);
  }

  private sanitizeFileName(fileName: string): string {
    const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return cleaned.slice(0, 80) || 'avatar.png';
  }

  private async resolveAvatarDisplayUrl(
    rawAvatarUrl: string | null,
  ): Promise<string | null> {
    if (!rawAvatarUrl) {
      return null;
    }

    if (
      rawAvatarUrl.startsWith('http://') ||
      rawAvatarUrl.startsWith('https://')
    ) {
      return rawAvatarUrl;
    }

    if (rawAvatarUrl.startsWith('avatars/') && this.storageService) {
      try {
        return await this.storageService.getSignedUrlForDownload(
          rawAvatarUrl,
          undefined,
          3600,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Không thể tạo signed URL cho avatar [${rawAvatarUrl}]: ${msg}`,
        );
        return null;
      }
    }

    return null;
  }

  private async toProfileResponse(
    record: UserProfileRecord,
  ): Promise<UserProfileResponse> {
    const isR2Key = Boolean(record.avatar_url?.startsWith('avatars/'));
    const displayUrl = await this.resolveAvatarDisplayUrl(record.avatar_url);

    return {
      id: record.id,
      email: record.email,
      name: record.name,
      avatar_url: displayUrl,
      avatar_storage_key: isR2Key ? record.avatar_url : null,
      role: record.role,
      is_active: record.is_active,
      is_verified: record.is_verified,
      daily_goal_minutes: record.daily_goal_minutes ?? 15,
      provider: record.provider,
      has_password: record.has_password,
      created_at: record.created_at,
      updated_at: record.updated_at,
      stats: record.stats,
    };
  }

  async getProfile(userId: string): Promise<UserProfileResponse> {
    const profile = await this.usersRepo.getUserProfileWithStats(userId);
    if (!profile) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }
    return this.toProfileResponse(profile);
  }

  async createAvatarUploadUrl(
    userId: string,
    dto: RequestAvatarUploadDto,
  ): Promise<{ uploadUrl: string; storageKey: string }> {
    if (!this.storageService) {
      throw new BadRequestException(
        'Dịch vụ lưu trữ tệp tin chưa được cấu hình',
      );
    }

    const user = await this.usersRepo.findUserById(userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    const safeName = this.sanitizeFileName(dto.fileName);
    const storageKey = `avatars/${userId}/${Date.now()}-${safeName}`;
    const uploadUrl = await this.storageService.getSignedUrlForUpload(
      storageKey,
      dto.mimeType,
      900,
    );

    return { uploadUrl, storageKey };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfileResponse> {
    if (
      dto.name === undefined &&
      dto.avatarStorageKey === undefined &&
      dto.dailyGoalMinutes === undefined
    ) {
      throw new BadRequestException('Vui lòng cung cấp thông tin cần cập nhật');
    }

    const existing = await this.usersRepo.findUserById(userId);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name.trim();
    }

    if (dto.dailyGoalMinutes !== undefined) {
      updateData.daily_goal_minutes = dto.dailyGoalMinutes;
    }

    let previousAvatarKeyToDelete: string | null = null;

    if (dto.avatarStorageKey !== undefined) {
      const storageKey = dto.avatarStorageKey.trim();
      const expectedPrefix = `avatars/${userId}/`;
      if (!storageKey.startsWith(expectedPrefix)) {
        throw new ForbiddenException(
          'Không có quyền sử dụng đường dẫn ảnh đại diện này',
        );
      }

      if (!this.storageService) {
        throw new BadRequestException(
          'Dịch vụ lưu trữ tệp tin chưa được cấu hình',
        );
      }

      const head = await this.storageService.headObject(storageKey);
      if (!head.exists) {
        throw new BadRequestException(
          'Tệp ảnh chưa được tải lên hệ thống lưu trữ hoặc đã bị gián đoạn',
        );
      }

      if (head.contentLength && head.contentLength > AVATAR_MAX_SIZE_BYTES) {
        await this.storageService.deleteObject(storageKey).catch(() => {});
        throw new BadRequestException(
          'Dung lượng ảnh đại diện thực tế vượt quá giới hạn 5MB cho phép',
        );
      }

      if (
        existing.avatar_url &&
        existing.avatar_url.startsWith('avatars/') &&
        existing.avatar_url !== storageKey
      ) {
        previousAvatarKeyToDelete = existing.avatar_url;
      }

      updateData.avatar_url = storageKey;
    }

    await this.usersRepo.updateUser(userId, updateData);

    if (previousAvatarKeyToDelete && this.storageService) {
      void this.storageService
        .deleteObject(previousAvatarKeyToDelete)
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Không thể xóa avatar cũ [${previousAvatarKeyToDelete}]: ${msg}`,
          );
        });
    }

    return this.getProfile(userId);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersRepo.findUserById(userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    if (user.password_hash) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Vui lòng nhập mật khẩu hiện tại');
      }

      const isCurrentValid = await bcrypt.compare(
        dto.currentPassword,
        user.password_hash,
      );
      if (!isCurrentValid) {
        throw new BadRequestException('Mật khẩu hiện tại không chính xác');
      }

      if (dto.currentPassword === dto.newPassword) {
        throw new BadRequestException(
          'Mật khẩu mới không được trùng với mật khẩu hiện tại',
        );
      }
    }

    const hashedNewPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.usersRepo.updateUser(userId, {
      password_hash: hashedNewPassword,
    });

    return {
      message: user.password_hash
        ? 'Đổi mật khẩu thành công.'
        : 'Thiết lập mật khẩu đăng nhập thành công.',
    };
  }

  async deleteAccount(
    userId: string,
    dto: DeleteAccountDto,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.usersRepo.findUserById(userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    if (user.password_hash) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Vui lòng nhập mật khẩu hiện tại để xác nhận xóa tài khoản',
        );
      }
      const isPasswordValid = await bcrypt.compare(
        dto.currentPassword,
        user.password_hash,
      );
      if (!isPasswordValid) {
        throw new BadRequestException('Mật khẩu xác nhận không chính xác');
      }
    } else {
      const normalizedConfirm = dto.confirmEmail?.trim().toLowerCase();
      if (!normalizedConfirm || normalizedConfirm !== user.email.toLowerCase()) {
        throw new BadRequestException(
          'Vui lòng nhập chính xác địa chỉ email của bạn để xác nhận xóa tài khoản',
        );
      }
    }

    const storageKeysToDelete =
      await this.usersRepo.collectUserStorageKeys(userId);

    await this.usersRepo.deleteUserById(userId);

    if (this.storageService && storageKeysToDelete.length > 0) {
      const storage = this.storageService;
      void Promise.allSettled(
        storageKeysToDelete.map((key) => storage.deleteObject(key)),
      ).catch(() => {});
    }

    return {
      success: true,
      message: 'Tài khoản và toàn bộ dữ liệu liên quan đã được xóa vĩnh viễn.',
    };
  }
}
