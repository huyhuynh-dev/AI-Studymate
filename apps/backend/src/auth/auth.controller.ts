import { Controller, Get, Redirect, Query, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from './decorators/public.decorator.js';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) { }

    @Public()
    @Post('sign-up')
    async signUp(
        @Body() registerDto: RegisterDto,
    ): Promise<{ access_token: string }> {
        return this.authService.signUpWithEmailAndPassword(registerDto);
    }

    @Public()
    @Post('sign-in')
    async signIn(
        @Body() loginDto: LoginDto,
    ): Promise<{ access_token: string }> {
        return this.authService.signInWithEmailAndPassword(loginDto);
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
        const { access_token } = await this.authService.createUserFromGoogleData({ email, name, avatar_url });

        const baseUrl = this.configService.get<string>('REDIRECT_TO_LOGIN') ?? 'http://localhost:3000';
        return { url: `${baseUrl}?token=${encodeURIComponent(access_token)}` };
    }
}
