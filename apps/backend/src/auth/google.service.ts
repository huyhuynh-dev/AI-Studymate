import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GoogleService {
    private readonly logger = new Logger(GoogleService.name);
    private readonly scopesAPI: string[];
    private readonly credentialsPath: string;
    private cachedCredentials: IGoogleAuthCredentials | null = null;

    constructor(private configService: ConfigService) {
        this.credentialsPath = path.join(
            process.cwd(),
            this.configService.get('GOOGLE_CREDENTIALS_PATH') ?? '',
        );
        this.scopesAPI = (this.configService.get<string>('GOOGLE_SCOPES_API') ?? 'email,profile').split(',');
    }

    private readCredentials(): IGoogleAuthCredentials {
        if (this.cachedCredentials) {
            return this.cachedCredentials;
        }

        try {
            const content: string = fs.readFileSync(this.credentialsPath, 'utf-8');
            this.cachedCredentials = JSON.parse(content);
            return this.cachedCredentials!;
        } catch (error) {
            this.logger.error(`Failed to read Google credentials from: ${this.credentialsPath}`, error);
            throw new Error(`Google OAuth credentials file not found or invalid at: ${this.credentialsPath}`);
        }
    }

    async getOAuth2ClientUrl(): Promise<{ url: string }> {
        const authClient = this.getAuthClient();
        return this.getAuthUrl(authClient);
    }

    getAuthClient(): OAuth2Client {
        const keys: IGoogleAuthCredentials = this.readCredentials();
        const authClient = new OAuth2Client(
            keys.web.client_id,
            keys.web.client_secret,
            keys.web.redirect_uris[0],
        );
        return authClient;
    }

    getAuthUrl(authClient: OAuth2Client): { url: string } {
        const authorizeUrl = authClient.generateAuthUrl({
            access_type: 'offline',
            scope: this.scopesAPI,
            prompt: 'consent',
            include_granted_scopes: true,
        });
        return { url: authorizeUrl };
    }

    async getAuthClientData(
        code: string,
    ): Promise<{ email: string; name: string; avatar_url: string }> {
        const authClient = this.getAuthClient();
        const tokenData = await authClient.getToken(code);
        const tokens = tokenData.tokens;

        authClient.setCredentials(tokens);

        const googleAuth = google.oauth2({
            version: 'v2',
            auth: authClient,
        } as any);

        const googleUserInfo = await googleAuth.userinfo.get();
        const email = googleUserInfo.data.email ?? '';
        const name = googleUserInfo.data.name ?? '';
        const avatar_url = googleUserInfo.data.picture ?? '';

        return { email, name, avatar_url };
    }
}

export interface IGoogleAuthCredentials {
    web: {
        client_id: string;
        client_secret: string;
        redirect_uris: string[];
        auth_uri: string;
        token_uri: string;
        auth_provider_x509_cert_url: string;
        javascript_origins: string[];
    };
}
