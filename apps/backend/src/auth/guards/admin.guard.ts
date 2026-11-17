import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { UsersService } from '../../users/users.service.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const reqUser = req.user as
      | { userId?: string; sub?: string; email?: string }
      | undefined;
    const userId = reqUser?.userId || reqUser?.sub;

    if (!userId) {
      throw new UnauthorizedException('Người dùng chưa được xác thực');
    }

    const user = await this.usersService.findUserById(userId);
    if (!user || !user.is_active) {
      throw new ForbiddenException(
        'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa',
      );
    }

    const adminEmailsRaw =
      this.configService.get<string>('ADMIN_EMAILS') ?? '';
    const adminEmails = new Set(
      adminEmailsRaw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );

    const isAdmin =
      user.role === 'admin' || adminEmails.has(user.email.toLowerCase());

    if (!isAdmin) {
      throw new ForbiddenException(
        'Chỉ quản trị viên mới có quyền truy cập chức năng này',
      );
    }

    return true;
  }
}
