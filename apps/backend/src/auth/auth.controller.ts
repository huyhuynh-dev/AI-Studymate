import { Controller, Get, Redirect, Query, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, TokenPair } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from './decorators/public.decorator.js';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenGuard } from './guards/refresh-token.guard.js';
import { MailService } from '../mail/mail.service.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { RequestEmailVerificationDto } from './dto/request-email-verification.dto.js';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto.js';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ExchangeCodeDto } from './dto/exchange-code.dto.js';

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
    ): Promise<{ message: string }> {
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
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 3, ttl: 60000 } })
    @Post('request-email-verification')
    @HttpCode(HttpStatus.OK)
    async requestEmailVerification(
        @Body() requestEmailVerificationDto: RequestEmailVerificationDto,
    ): Promise<{ message: string }> {
        return this.authService.requestEmailVerificationOtp(requestEmailVerificationDto.email);
    }

    @Public()
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('verify-email')
    @HttpCode(HttpStatus.OK)
    async verifyEmail(@Body() verifyEmailOtpDto: VerifyEmailOtpDto): Promise<{ verified: boolean }> {
        return this.authService.verifyEmailOtp(
            verifyEmailOtpDto.email,
            verifyEmailOtpDto.otp,
        );
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
    async googleAuthCallback(
        @Query('code') code: string,
        @Query('state') state: string,
        @Query('error') error: string,
    ): Promise<{ url: string }> {
        const baseUrl = this.configService.get<string>('REDIRECT_TO_LOGIN') ?? 'http://localhost:3000';

        // SEC-07: Xử lý lỗi OAuth hoặc thiếu code param
        if (error || !code) {
            return { url: `${baseUrl}?error=oauth_failed` };
        }

        try {
            // SEC-03: Validate state parameter để chống CSRF
            await this.authService.validateGoogleOAuthState(state);

            const { email, name, avatar_url } = await this.authService.getAuthClientData(code);
            const authCode = await this.authService.createGoogleAuthCode({ email, name, avatar_url });

            return {
                url: `${baseUrl}?authCode=${encodeURIComponent(authCode)}`,
            };
        } catch {
            return { url: `${baseUrl}?error=oauth_failed` };
        }
    }


    @Public()
    @Post('exchange-code')
    @HttpCode(HttpStatus.OK)
    async exchangeCode(@Body() exchangeCodeDto: ExchangeCodeDto): Promise<TokenPair> {
        return this.authService.exchangeGoogleAuthCode(exchangeCodeDto.authCode);
    }

    // ─── Reset Password Flow ────────────────────────────────

    @Public()
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 3, ttl: 60000 } })
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() requestOtpDto: RequestOtpDto): Promise<{ message: string }> {
        return await this.authService.requestOTP(requestOtpDto.email);
    }

    @Public()
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('verify-otp')
    @HttpCode(HttpStatus.OK)
    async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto): Promise<{ reset_token: string }> {
        return await this.authService.verifyOTP(verifyOtpDto.email, verifyOtpDto.otp.toString());
    }

    @Public()
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
        return await this.authService.resetPassword(
            resetPasswordDto.reset_token,
            resetPasswordDto.new_password,
        );
    }
}
