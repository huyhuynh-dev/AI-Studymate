import { Injectable } from '@nestjs/common';
import { GoogleService } from './google.service.js';

@Injectable()
export class AuthService {
    constructor(private googleService: GoogleService) { }

    async googleAuth(): Promise<{ url: string }> {
        return this.googleService.getOAuth2ClientUrl();
    }

    async getAuthClientData(code: string): Promise<{ email: string; refreshToken: string; accessToken: string }> {
        return this.googleService.getAuthClientData(code);
    }
}
