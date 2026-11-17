import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersController } from './users.controller.js';
import type { UsersService } from './users.service.js';

describe('UsersController', () => {
  let controller: UsersController;
  let serviceMock: {
    getProfile: ReturnType<typeof vi.fn>;
    updateProfile: ReturnType<typeof vi.fn>;
    createAvatarUploadUrl: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
    deleteAccount: ReturnType<typeof vi.fn>;
  };

  const userId = '11111111-1111-4111-8111-111111111111';
  const authReq = { user: { userId, email: 'test@example.com' } } as unknown as Request;

  beforeEach(() => {
    serviceMock = {
      getProfile: vi.fn().mockResolvedValue({ id: userId }),
      updateProfile: vi.fn().mockResolvedValue({ id: userId, name: 'Updated' }),
      createAvatarUploadUrl: vi
        .fn()
        .mockResolvedValue({ uploadUrl: 'https://put', storageKey: 'avatars/1/a.png' }),
      changePassword: vi.fn().mockResolvedValue({ message: 'OK' }),
      deleteAccount: vi.fn().mockResolvedValue({ success: true, message: 'Deleted' }),
    };

    controller = new UsersController(serviceMock as unknown as UsersService);
  });

  it('nên ném UnauthorizedException nếu thiếu req.user', async () => {
    await expect(controller.getMe({} as Request)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('nên ủy quyền đúng userId cho getMe, updateMe, requestAvatarUploadUrl, changePassword và deleteMe', async () => {
    await controller.getMe(authReq);
    expect(serviceMock.getProfile).toHaveBeenCalledWith(userId);

    await controller.updateMe(authReq, { name: 'Updated' });
    expect(serviceMock.updateProfile).toHaveBeenCalledWith(userId, {
      name: 'Updated',
    });

    await controller.requestAvatarUploadUrl(authReq, {
      fileName: 'a.png',
      mimeType: 'image/png',
      fileSize: 1024,
    });
    expect(serviceMock.createAvatarUploadUrl).toHaveBeenCalledWith(userId, {
      fileName: 'a.png',
      mimeType: 'image/png',
      fileSize: 1024,
    });

    await controller.changePassword(authReq, { newPassword: 'NewPass123' });
    expect(serviceMock.changePassword).toHaveBeenCalledWith(userId, {
      newPassword: 'NewPass123',
    });

    await controller.deleteMe(authReq, { confirmEmail: 'test@example.com' });
    expect(serviceMock.deleteAccount).toHaveBeenCalledWith(userId, {
      confirmEmail: 'test@example.com',
    });
  });
});
