import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UsersService, type UserProfileResponse } from './users.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { RequestAvatarUploadDto } from './dto/request-avatar-upload.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private getUserId(req: Request): string {
    const user = req.user as { userId?: string; sub?: string } | undefined;
    const userId = user?.userId || user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Người dùng chưa được xác thực');
    }
    return userId;
  }

  private getUserSessionId(req: Request): string | undefined {
    const user = req.user as { sessionId?: string } | undefined;
    return user?.sessionId;
  }

  @Get('me')
  async getMe(@Req() req: Request): Promise<UserProfileResponse> {
    return this.usersService.getProfile(this.getUserId(req));
  }

  @Patch('me')
  async updateMe(
    @Req() req: Request,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileResponse> {
    return this.usersService.updateProfile(this.getUserId(req), dto);
  }

  @Post('me/avatar-upload-url')
  async requestAvatarUploadUrl(
    @Req() req: Request,
    @Body() dto: RequestAvatarUploadDto,
  ): Promise<{ uploadUrl: string; storageKey: string }> {
    return this.usersService.createAvatarUploadUrl(this.getUserId(req), dto);
  }

  @Patch('me/password')
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.usersService.changePassword(
      this.getUserId(req),
      dto,
      this.getUserSessionId(req),
    );
  }

  @Delete('me')
  async deleteMe(
    @Req() req: Request,
    @Body() dto: DeleteAccountDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.usersService.deleteAccount(this.getUserId(req), dto);
  }
}
