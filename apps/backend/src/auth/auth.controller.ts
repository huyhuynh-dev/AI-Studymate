import { Controller, Get, Redirect, Query, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, TokenPair } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from './decorators/public.decorator.js';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenGuard } from './guards/refresh-token.guard.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { RequestEmailVerificationDto } from './dto/request-email-verification.dto.js';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto.js';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ExchangeCodeDto } from './dto/exchange-code.dto.js';
import { LogoutDto } from './dto/logout.dto.js';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) { }

    private extractClientMetadata(req: Request): {
        userAgent?: string;
        ipAddress?: string;
    } {
        const userAgent = req.get('user-agent') ?? undefined;
        const forwardedFor = req.get('x-forwarded-for');
        const ipAddress = forwardedFor
            ? forwardedFor.split(',')[0]?.trim()
            : req.ip;
        return { userAgent, ipAddress };
    }

    @Public()
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('sign-up')
    async signUp(
        @Body() registerDto: RegisterDto,
    ): Promise<{ message: string }> {
        return this.authService.signUpWithEmailAndPassword(registerDto);
    }

    @Public()
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    @Post('sign-in')
    async signIn(
        @Body() loginDto: LoginDto,
        @Req() req: Request,
    ): Promise<TokenPair> {
        return this.authService.signInWithEmailAndPassword(
            loginDto,
            this.extractClientMetadata(req),
        );
    }

    @Public()
    @UseGuards(ThrottlerGuard, RefreshTokenGuard)
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @Get('refresh')
    @HttpCode(HttpStatus.OK)
    async refreshTokens(@Req() req: Request): Promise<TokenPair> {
        const user = req.user as {
            userId: string;
            email: string;
            refreshToken: string;
            rememberMe?: boolean;
            sessionId?: string;
        };
        return this.authService.refreshTokens(
            user.userId,
            user.refreshToken,
            Boolean(user.rememberMe),
            user.sessionId,
            this.extractClientMetadata(req),
        );
    }

    @Public()
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(
        @Req() req: Request,
        @Body() logoutDto?: LogoutDto,
    ): Promise<{ message: string; revoked: boolean }> {
        const authHeader = req.get('Authorization') ?? '';
        const accessToken = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7).trim()
            : undefined;
        const headerRefreshToken = req.get('x-refresh-token')?.trim();
        const refreshToken =
            logoutDto?.refreshToken?.trim() || headerRefreshToken || undefined;

        return this.authService.logoutByTokens({
            accessToken,
            refreshToken,
        });
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
        const rawBaseUrl =
            this.configService.get<string>('REDIRECT_TO_LOGIN') ??
            'http://localhost:3000';

        let clientOrigin = 'http://localhost:3000';
        let configuredRedirectPath: string | undefined;
        try {
            const parsed = new URL(rawBaseUrl);
            clientOrigin = parsed.origin;
            if (
                parsed.pathname &&
                parsed.pathname !== '/' &&
                !parsed.pathname.startsWith('/api/auth/google') &&
                !parsed.pathname.startsWith('/auth')
            ) {
                configuredRedirectPath = `${parsed.pathname}${parsed.search}`;
            }
        } catch {
            clientOrigin =
                rawBaseUrl.replace(/\/+$/, '') || 'http://localhost:3000';
        }

        // SEC-07: Xử lý lỗi OAuth hoặc thiếu code param
        if (error || !code) {
            return { url: `${clientOrigin}/auth/login?error=oauth_failed` };
        }

        try {
            // SEC-03 + PKCE: Validate state parameter và lấy codeVerifier từ Redis
            const { codeVerifier } =
                await this.authService.validateGoogleOAuthState(state);

            const { email, name, avatar_url, email_verified } =
                await this.authService.getAuthClientData(code, codeVerifier);
            const authCode = await this.authService.createGoogleAuthCode({
                email,
                name,
                avatar_url,
                email_verified,
            });

            // Đổi authCode phía server-side tại Next.js /api/auth/google để không lộ code lên URL client
            const callbackUrl = new URL('/api/auth/google', clientOrigin);
            callbackUrl.searchParams.set('authCode', authCode);
            if (configuredRedirectPath) {
                callbackUrl.searchParams.set('redirect', configuredRedirectPath);
            }

            return {
                url: callbackUrl.toString(),
            };
        } catch {
            return { url: `${clientOrigin}/auth/login?error=oauth_failed` };
        }
    }


    @Public()
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 15, ttl: 60000 } })
    @Post('exchange-code')
    @HttpCode(HttpStatus.OK)
    async exchangeCode(
        @Body() exchangeCodeDto: ExchangeCodeDto,
        @Req() req: Request,
    ): Promise<TokenPair> {
        return this.authService.exchangeGoogleAuthCode(
            exchangeCodeDto.authCode,
            exchangeCodeDto.rememberMe ?? true,
            this.extractClientMetadata(req),
        );
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
            resetPasswordDto.logoutAll ?? true,
        );
    }
}
