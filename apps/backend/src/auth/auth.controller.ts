import { Controller, Get, Redirect, Query, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, TokenPair } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from './decorators/public.decorator.js';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenGuard } from './guards/refresh-token.guard.js';
import { MailService } from '../mail/mail.service.js';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
        private readonly mailService: MailService,
    ) { }

    @Public()
    @Post('sign-up')
    async signUp(
        @Body() registerDto: RegisterDto,
    ): Promise<TokenPair> {
        return this.authService.signUpWithEmailAndPassword(registerDto);
    }

    @Public()
    @Post('sign-in')
    async signIn(
        @Body() loginDto: LoginDto,
    ): Promise<TokenPair> {
        return this.authService.signInWithEmailAndPassword(loginDto);
    }

    @Public()
    @UseGuards(RefreshTokenGuard)
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refreshTokens(@Req() req: Request): Promise<TokenPair> {
        const user = req.user as { userId: string; email: string; refreshToken: string };
        return this.authService.refreshTokens(user.userId, user.refreshToken);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(@Req() req: Request): Promise<{ message: string }> {
        const user = req.user as { userId: string; email: string };
        await this.authService.logout(user.userId);
        return { message: 'Logged out successfully' };
    }

    @Public()
    @Get('google-auth')
    @Redirect()
    async googleAuth(): Promise<{ url: string }> {
        return this.authService.googleAuth();
    }

    @Public()
    @Get('google-callback')
    @Redirect()
    async googleAuthCallback(@Query('code') code: string): Promise<{ url: string }> {
        const { email, name, avatar_url } = await this.authService.getAuthClientData(code);
        const { access_token, refresh_token } = await this.authService.createUserFromGoogleData({ email, name, avatar_url });

        const baseUrl = this.configService.get<string>('REDIRECT_TO_LOGIN') ?? 'http://localhost:3000';
        return {
            url: `${baseUrl}?token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}`,
        };
    }

    @Public()
    @Get('test-mail')
    async testMail(@Body() body: { to: string }): Promise<{ message: string }> {
        return await this.authService.requestOTP('hh0926261619@gmail.com');
    }

    // @Post('forgot-password')
    // async forgotPassword(email: string): Promise<void> {
    //     this.authService.
    // }
}
