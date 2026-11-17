import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersRepoService } from '../repo/users-repo/users-repo.service.js';
import type { StorageService } from '../storage/storage.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let repoMock: {
    createUser: ReturnType<typeof vi.fn>;
    findUserByEmail: ReturnType<typeof vi.fn>;
    findUserById: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    getUserProfileWithStats: ReturnType<typeof vi.fn>;
    collectUserStorageKeys: ReturnType<typeof vi.fn>;
    deleteUserById: ReturnType<typeof vi.fn>;
  };
  let storageMock: {
    getSignedUrlForUpload: ReturnType<typeof vi.fn>;
    getSignedUrlForDownload: ReturnType<typeof vi.fn>;
    headObject: ReturnType<typeof vi.fn>;
    deleteObject: ReturnType<typeof vi.fn>;
  };

  const userId = '11111111-1111-4111-8111-111111111111';
  const now = new Date('2026-11-17T02:00:00.000Z');

  beforeEach(() => {
    repoMock = {
      createUser: vi.fn(),
      findUserByEmail: vi.fn(),
      findUserById: vi.fn(),
      updateUser: vi.fn().mockResolvedValue({ id: userId }),
      getUserProfileWithStats: vi.fn(),
      collectUserStorageKeys: vi.fn().mockResolvedValue([]),
      deleteUserById: vi.fn().mockResolvedValue({ id: userId }),
    };

    storageMock = {
      getSignedUrlForUpload: vi
        .fn()
        .mockResolvedValue('https://r2.example.com/put-signed'),
      getSignedUrlForDownload: vi
        .fn()
        .mockResolvedValue('https://r2.example.com/get-signed'),
      headObject: vi
        .fn()
        .mockResolvedValue({ exists: true, contentLength: 102400 }),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    };

    service = new UsersService(
      repoMock as unknown as UsersRepoService,
      storageMock as unknown as StorageService,
    );
  });

  describe('getProfile', () => {
    it('nên trả về hồ sơ kèm signed avatar URL cho R2 key và không lộ password_hash', async () => {
      repoMock.getUserProfileWithStats.mockResolvedValueOnce({
        id: userId,
        email: 'student@example.com',
        name: 'Sinh Viên Test',
        avatar_url: `avatars/${userId}/photo.png`,
        role: 'user',
        is_active: true,
        is_verified: true,
        provider: 'local',
        has_password: true,
        created_at: now,
        updated_at: now,
        stats: {
          subjects_count: 3,
          conversations_count: 7,
          documents_count: 12,
          flashcard_decks_count: 4,
          quizzes_count: 5,
        },
      });

      const profile = await service.getProfile(userId);

      expect(storageMock.getSignedUrlForDownload).toHaveBeenCalledWith(
        `avatars/${userId}/photo.png`,
        undefined,
        3600,
      );
      expect(profile.avatar_url).toBe('https://r2.example.com/get-signed');
      expect(profile.avatar_storage_key).toBe(`avatars/${userId}/photo.png`);
      expect(profile.has_password).toBe(true);
      expect(profile.stats.documents_count).toBe(12);
      expect('password_hash' in profile).toBe(false);
    });

    it('nên ném NotFoundException khi user không tồn tại', async () => {
      repoMock.getUserProfileWithStats.mockResolvedValueOnce(null);
      await expect(service.getProfile(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createAvatarUploadUrl & updateProfile', () => {
    it('nên tạo Pre-signed PUT URL theo prefix avatars/<userId>/', async () => {
      repoMock.findUserById.mockResolvedValueOnce({ id: userId });

      const result = await service.createAvatarUploadUrl(userId, {
        fileName: 'ảnh thẻ!.png',
        mimeType: 'image/png',
        fileSize: 20480,
      });

      expect(result.uploadUrl).toBe('https://r2.example.com/put-signed');
      expect(result.storageKey).toMatch(
        new RegExp(`^avatars/${userId}/\\d+-_nh_th__.png$`),
      );
    });

    it('nên chặn avatarStorageKey thuộc về user khác (cross-tenant guard)', async () => {
      repoMock.findUserById.mockResolvedValueOnce({
        id: userId,
        avatar_url: null,
      });

      await expect(
        service.updateProfile(userId, {
          avatarStorageKey: 'avatars/other-user-id/avatar.png',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('nên xác thực headObject trên R2, cập nhật avatar mới và xóa avatar cũ', async () => {
      const oldKey = `avatars/${userId}/old.png`;
      const newKey = `avatars/${userId}/new.png`;

      repoMock.findUserById.mockResolvedValueOnce({
        id: userId,
        avatar_url: oldKey,
      });
      repoMock.getUserProfileWithStats.mockResolvedValueOnce({
        id: userId,
        email: 'student@example.com',
        name: 'Tên Mới',
        avatar_url: newKey,
        role: 'user',
        is_active: true,
        is_verified: true,
        provider: 'local',
        has_password: true,
        created_at: now,
        updated_at: now,
        stats: {
          subjects_count: 1,
          conversations_count: 1,
          documents_count: 1,
          flashcard_decks_count: 0,
          quizzes_count: 0,
        },
      });

      const updated = await service.updateProfile(userId, {
        name: 'Tên Mới',
        avatarStorageKey: newKey,
      });

      expect(storageMock.headObject).toHaveBeenCalledWith(newKey);
      expect(repoMock.updateUser).toHaveBeenCalledWith(userId, {
        name: 'Tên Mới',
        avatar_url: newKey,
      });
      expect(storageMock.deleteObject).toHaveBeenCalledWith(oldKey);
      expect(updated.avatar_storage_key).toBe(newKey);
    });
  });

  describe('changePassword', () => {
    it('nên từ chối nếu mật khẩu hiện tại không chính xác', async () => {
      const currentHash = await bcrypt.hash('OldPass123', 10);
      repoMock.findUserById.mockResolvedValueOnce({
        id: userId,
        password_hash: currentHash,
      });

      await expect(
        service.changePassword(userId, {
          currentPassword: 'WrongPass999',
          newPassword: 'NewPass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('nên cho phép tài khoản Google OAuth chưa có password thiết lập mật khẩu lần đầu', async () => {
      repoMock.findUserById.mockResolvedValueOnce({
        id: userId,
        password_hash: null,
      });

      const res = await service.changePassword(userId, {
        newPassword: 'GoogleUser123',
      });

      expect(res.message).toContain('Thiết lập mật khẩu');
      expect(repoMock.updateUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          password_hash: expect.any(String),
        }),
      );
    });
  });

  describe('deleteAccount', () => {
    it('nên yêu cầu đúng mật khẩu cho tài khoản local và dọn R2 sau khi xóa', async () => {
      const hash = await bcrypt.hash('MyPass123', 10);
      repoMock.findUserById.mockResolvedValueOnce({
        id: userId,
        email: 'local@example.com',
        password_hash: hash,
      });
      repoMock.collectUserStorageKeys.mockResolvedValueOnce([
        `avatars/${userId}/a.png`,
        'users/doc.pdf',
      ]);

      await expect(
        service.deleteAccount(userId, { currentPassword: 'Wrong' }),
      ).rejects.toThrow(BadRequestException);

      repoMock.findUserById.mockResolvedValueOnce({
        id: userId,
        email: 'local@example.com',
        password_hash: hash,
      });

      const result = await service.deleteAccount(userId, {
        currentPassword: 'MyPass123',
      });

      expect(result.success).toBe(true);
      expect(repoMock.deleteUserById).toHaveBeenCalledWith(userId);
      expect(storageMock.deleteObject).toHaveBeenCalledTimes(2);
    });

    it('nên yêu cầu khớp email xác nhận cho tài khoản Google OAuth không có password', async () => {
      repoMock.findUserById.mockResolvedValueOnce({
        id: userId,
        email: 'oauth@example.com',
        password_hash: null,
      });

      await expect(
        service.deleteAccount(userId, { confirmEmail: 'wrong@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
