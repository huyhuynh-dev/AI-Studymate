import { Controller, Get, Redirect, Query, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('sign-up')
    async signUp(
        @Body() registerDto: RegisterDto,
    ): Promise<{ access_token: string }> {
        return this.authService.signUpWithEmailAndPassword(registerDto);
    }

    @Post('sign-in')
    async signIn(
        @Body() loginDto: LoginDto,
    ): Promise<{ access_token: string }> {
        return this.authService.signInWithEmailAndPassword(loginDto);
    }

    @Get('google-auth')
    @Redirect()
    async googleAuth(): Promise<{ url: string }> {
        return this.authService.googleAuth();
    }

    @Get('google-callback')
    @Redirect()
    async googleAuthCallback(@Query('code') code: string): Promise<{ url: string }> {
        const { email, refreshToken, accessToken } = await this.authService.getAuthClientData(code);
        // Implement additional sign-in logic here
        return { url: process.env.REDIRECT_TO_LOGIN ?? '' };
    }
}
