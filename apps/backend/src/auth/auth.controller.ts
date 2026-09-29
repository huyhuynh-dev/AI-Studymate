import { Controller, Get, Redirect, Query } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

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
