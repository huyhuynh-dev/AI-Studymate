import {
    Injectable,
    Logger,
    OnModuleInit,
    UnauthorizedException,
    HttpException,
    ConflictException,
    ForbiddenException,
} from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { RedisService } from '../redis/redis.service.js';
import { randomBytes } from 'crypto';

const OAUTH_STATE_TTL_SECONDS = 600; // 10 phút

@Injectable()
export class GoogleService implements OnModuleInit {
    private readonly logger = new Logger(GoogleService.name);
    private readonly scopesAPI: string[];
    private readonly credentialsPath: string;
    private cachedCredentials: IGoogleAuthCredentials | null = null;
    private oauthClient: OAuth2Client | null = null;

    constructor(
        private configService: ConfigService,
        private readonly redisService: RedisService,
    ) {
        this.credentialsPath = path.join(
            process.cwd(),
            this.configService.get('GOOGLE_CREDENTIALS_PATH') ?? '',
        );
        this.scopesAPI = (this.configService.get<string>('GOOGLE_SCOPES_API') ?? 'email,profile').split(',');
    }

    // CQ-04: Đọc credentials async trong onModuleInit thay vì readFileSync blocking
    async onModuleInit(): Promise<void> {
        try {
            const content = await fs.promises.readFile(this.credentialsPath, 'utf-8');
            this.cachedCredentials = JSON.parse(content) as IGoogleAuthCredentials;
        } catch (error) {
            this.logger.error(`Failed to read Google credentials from: ${this.credentialsPath}`, error);
            throw new Error(`Google OAuth credentials file not found or invalid at: ${this.credentialsPath}`);
        }
    }

    private readCredentials(): IGoogleAuthCredentials {
        if (this.cachedCredentials) {
            return this.cachedCredentials;
        }
        // Fallback sync read nếu onModuleInit chưa chạy (hiếm gặp)
        try {
            const content: string = fs.readFileSync(this.credentialsPath, 'utf-8');
            this.cachedCredentials = JSON.parse(content);
            return this.cachedCredentials!;
        } catch (error) {
            this.logger.error(`Failed to read Google credentials from: ${this.credentialsPath}`, error);
            throw new Error(`Google OAuth credentials file not found or invalid at: ${this.credentialsPath}`);
        }
    }

    // CQ-03: Cache OAuth2Client instance — không tạo mới mỗi request
    getAuthClient(): OAuth2Client {
        if (!this.oauthClient) {
            const keys: IGoogleAuthCredentials = this.readCredentials();
            this.oauthClient = new OAuth2Client(
                keys.web.client_id,
                keys.web.client_secret,
                keys.web.redirect_uris[0],
            );
        }
        return this.oauthClient;
    }

    // SEC-03: Thêm state parameter ngẫu nhiên để chống CSRF
    async getOAuth2ClientUrl(): Promise<{ url: string }> {
        const authClient = this.getAuthClient();
        const state = randomBytes(32).toString('hex');
        await this.redisService.set(`oauth_state:${state}`, '1', OAUTH_STATE_TTL_SECONDS);

        const authorizeUrl = authClient.generateAuthUrl({
            access_type: 'offline',
            scope: this.scopesAPI,
            prompt: 'consent',
            include_granted_scopes: true,
            state,
        });
        return { url: authorizeUrl };
    }

    // SEC-03: Validate state parameter từ OAuth callback (single-use)
    async validateOAuthState(state: string | undefined): Promise<void> {
        if (!state) {
            throw new UnauthorizedException('Missing OAuth state parameter');
        }
        const isValid = await this.redisService.getAndDelete(`oauth_state:${state}`);
        if (!isValid) {
            throw new UnauthorizedException('Invalid or expired OAuth state');
        }
    }

    // CQ-09: Thêm try/catch đầy đủ, validate email không rỗng
    // SEC-04: Trả thêm email_verified để AuthService kiểm tra
    async getAuthClientData(
        code: string,
    ): Promise<{ email: string; name: string; avatar_url: string; email_verified: boolean }> {
        try {
            // Tạo instance mới cho mỗi request vì cần set user credentials riêng
            const keys = this.readCredentials();
            const requestClient = new OAuth2Client(
                keys.web.client_id,
                keys.web.client_secret,
                keys.web.redirect_uris[0],
            );

            const tokenData = await requestClient.getToken(code);
            const tokens = tokenData.tokens;
            requestClient.setCredentials(tokens);

            const googleAuth = google.oauth2({
                version: 'v2',
                auth: requestClient,
            } as any);

            const googleUserInfo = await googleAuth.userinfo.get();
            const email = googleUserInfo.data.email;
            const name = googleUserInfo.data.name;
            const avatar_url = googleUserInfo.data.picture ?? '';
            const email_verified = googleUserInfo.data.verified_email ?? false;

            if (!email) {
                throw new UnauthorizedException('Không thể lấy email từ Google');
            }

            return {
                email,
                name: name ?? 'Google User',
                avatar_url,
                email_verified,
            };
        } catch (error) {
            this.logger.error('Google OAuth getAuthClientData error', error instanceof Error ? error.stack : String(error));
            if (error instanceof HttpException) throw error;
            throw new UnauthorizedException('Xác thực Google thất bại');
        }
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
