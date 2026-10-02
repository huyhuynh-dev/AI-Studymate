import {
    ConflictException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    UnauthorizedException,
    Logger
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleService } from './google.service.js';
import { UsersService } from '../users/users.service.js';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { User } from '../generated/prisma/client.js';
import { randomInt } from 'crypto';
import { RedisService } from '../redis/redis.service.js';
import { MailService } from '../mail/mail.service.js';

export interface TokenPair {
    access_token: string;
    refresh_token: string;
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly googleService: GoogleService,
        private readonly jwtService: JwtService,
        private readonly usersService: UsersService,
        private readonly redisService: RedisService,
        private readonly mailService: MailService
    ) { }

    // ─── Token Generation ───────────────────────────────────

    private async generateTokens(userId: string, email: string): Promise<TokenPair> {
        const payload = { sub: userId, email };

        const [access_token, refresh_token] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow<string>('JWT_SECRET'),
                expiresIn: Number(this.configService.get<string>('JWT_EXPIRES_IN') ?? '3600'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
                expiresIn: '7d',
            }),
        ]);

        return { access_token, refresh_token };
    }

    private async updateRefreshTokenHash(userId: string, refreshToken: string): Promise<void> {
        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
        await this.usersService.updateUser(userId, { refresh_token: hashedRefreshToken });
    }

    // ─── Email/Password Auth ────────────────────────────────

    async signUpWithEmailAndPassword(registerDto: RegisterDto): Promise<TokenPair> {
        const { name, email, password } = registerDto;

        const isUserExist: User | null = await this.usersService.findUserByEmail(email);

        if (isUserExist) {
            throw new ConflictException('User with this email already exists');
        }

        const password_hash: string = await this.hashPassword(password);

        let user: User | null;

        try {
            user = await this.usersService.createUser({ email, password_hash, name, provider: 'local' });
        } catch (error: unknown) {
            const prismaError = error as {
                code?: unknown;
                meta?: { target?: unknown };
            };

            if (
                prismaError.code === 'P2002' &&
                Array.isArray(prismaError.meta?.target) &&
                prismaError.meta.target.includes('email')
            ) {
                throw new ConflictException('User with this email already exists');
            }

            throw error;
        }

        if (!user) {
            throw new InternalServerErrorException('Sign up failed');
        }

        const tokens = await this.generateTokens(user.id, user.email);
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

        return tokens;
    }

    async signInWithEmailAndPassword(loginDto: LoginDto): Promise<TokenPair> {
        const { email, password } = loginDto;

        const user = await this.usersService.findUserByEmail(email);

        if (!user || !user.password_hash) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const tokens = await this.generateTokens(user.id, user.email);
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

        return tokens;
    }

    // ─── Google OAuth ───────────────────────────────────────

    async createUserFromGoogleData(googleData: { email: string; name: string; avatar_url: string }): Promise<TokenPair> {
        const { email, name, avatar_url } = googleData;

        let user: User | null = await this.usersService.findUserByEmail(email);

        if (!user) {
            user = await this.usersService.createUser({ email, name, avatar_url, provider: 'google' });

            if (!user) {
                throw new InternalServerErrorException('Failed to create user from Google data');
            }
        }

        const tokens = await this.generateTokens(user.id, user.email);
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

        return tokens;
    }

    async googleAuth(): Promise<{ url: string }> {
        return this.googleService.getOAuth2ClientUrl();
    }

    async getAuthClientData(code: string): Promise<{ email: string; name: string; avatar_url: string }> {
        return this.googleService.getAuthClientData(code);
    }

    // ─── Token Refresh ──────────────────────────────────────



    async refreshTokens(userId: string, refreshToken: string): Promise<TokenPair> {
        const user = await this.usersService.findUserById(userId);

        if (!user || !user.refresh_token) {
            throw new ForbiddenException('Access denied');
        }

        const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refresh_token);

        if (!isRefreshTokenValid) {
            throw new ForbiddenException('Access denied');
        }

        const tokens = await this.generateTokens(user.id, user.email);
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

        return tokens;
    }

    // ─── Logout ─────────────────────────────────────────────

    async logout(userId: string): Promise<void> {
        await this.usersService.updateUser(userId, { refresh_token: null });
    }

    // --- Forgot Password---
    async requestOTP(email: string): Promise<{ message: string }> {
        try {
            const user: User | null = await this.usersService.findUserByEmail(email);

            if (!user) {
                throw new Error('Email không tồn tại trong hệ thống')
            };

            const otp: number = this.createOTP();
            const hashOTP: string = await this.hashOTP(otp);
            await this.saveOTPIntoRedis(hashOTP, email, 120); // 120 seconds = 2 minutes
            await this.mailService.sendOtpMail(email, otp.toString(), 120);

            return { message: 'OTP has been sent to your email' };

        }
        catch (error) {
            this.logger.error(`Lỗi khi tạo OTP cho email ${email}: ${error}`);
            throw error;
        }
    }

    // ─── Utilities ──────────────────────────────────────────

    async saveOTPIntoRedis(otpHash: string, email: string, expireInSeconds: number): Promise<void> {
        const redisKey = `otp:${email}`;
        await this.redisService.set(redisKey, otpHash, expireInSeconds);
    }

    async hashPassword(password: string): Promise<string> {
        const saltOrRounds = 10;
        const hash = await bcrypt.hash(password, saltOrRounds);
        return hash;
    }

    async hashOTP(num: number): Promise<string> {
        const saltOrRounds = 5;
        const hash = await bcrypt.hash(num.toString(), saltOrRounds);
        return hash;
    }

    createOTP() {
        return randomInt(100000, 1000000);
    }

}
