import {
    ConflictException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    UnauthorizedException,
    Logger,
    NotFoundException,
    HttpException,
    HttpStatus
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
        const normalizedEmail = email.trim().toLowerCase();
        const cooldownKey = `otp_cooldown:${normalizedEmail}`;
        const redisKey = `otp:${normalizedEmail}`;

        try {
            // 1. Kiểm tra Cooldown theo email trong Redis (chống spam liên tục dù đổi IP qua proxy)
            const isCooldown = await this.redisService.get(cooldownKey);
            if (isCooldown) {
                throw new HttpException(
                    'Bạn đang thao tác quá nhanh. Vui lòng chờ 60 giây trước khi yêu cầu mã OTP mới.',
                    HttpStatus.TOO_MANY_REQUESTS,
                );
            }

            const user: User | null = await this.usersService.findUserByEmail(normalizedEmail);

            // 2. Chống User Enumeration: Nếu email không tồn tại trong hệ thống,
            // vẫn set cooldown để kẻ tấn công không thể phân biệt và trả về cùng thông điệp chung.
            if (!user) {
                await this.redisService.set(cooldownKey, '1', 60);
                return {
                    message: 'Nếu email tồn tại trong hệ thống, mã OTP xác thực sẽ được gửi đến hộp thư của bạn.',
                };
            }

            // 3. User hợp lệ: Set cooldown 60s, sinh OTP, lưu Redis và gửi email
            await this.redisService.set(cooldownKey, '1', 60);

            const otp: number = this.createOTP();
            const hashOTP: string = await this.hashOTP(otp);
            await this.saveOTPIntoRedis(hashOTP, normalizedEmail, 120); // 120 seconds = 2 minutes

            try {
                await this.mailService.sendOtpMail(normalizedEmail, otp.toString(), 120);
            } catch (mailError) {
                // Nếu gửi mail thất bại, thu hồi cooldown và OTP để người dùng có thể gửi lại
                await this.redisService.del(cooldownKey);
                await this.redisService.del(redisKey);
                this.logger.error(`Lỗi khi gửi email OTP cho ${normalizedEmail}: ${String(mailError)}`);
                throw new InternalServerErrorException('Không thể gửi mã OTP qua email, vui lòng thử lại sau');
            }

            return {
                message: 'Nếu email tồn tại trong hệ thống, mã OTP xác thực sẽ được gửi đến hộp thư của bạn.',
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            this.logger.error(`Lỗi khi tạo OTP cho email ${normalizedEmail}: ${String(error)}`);
            throw new InternalServerErrorException('Đã xảy ra lỗi khi tạo mã OTP');
        }
    }

    async verifyOTP(email: string, otp: string): Promise<{ reset_token: string }> {
        const normalizedEmail = email.trim().toLowerCase();
        try {
            const redisKey = `otp:${normalizedEmail}`;
            const storedHash: string | null = await this.redisService.get(redisKey);

            if (!storedHash) {
                throw new NotFoundException('OTP không tồn tại hoặc đã hết hạn');
            }

            const isOTPValid = await bcrypt.compare(otp, storedHash);

            if (!isOTPValid) {
                throw new ForbiddenException('OTP không hợp lệ');
            }


            await this.redisService.del(redisKey);

            const payload = {
                sub: normalizedEmail,
                purpose: 'PASSWORD_RESET',
            }
            const reset_token = await this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow<string>('JWT_RESET_SECRET'),
                expiresIn: '3m'
            });

            return { reset_token };
        }
        catch (error) {
            this.logger.error(`Lỗi khi xác minh OTP cho email ${normalizedEmail}: ${String(error)}`);
            throw error;
        }
    }

    // ─── Utilities ──────────────────────────────────────────

    async saveOTPIntoRedis(otpHash: string, email: string, expireInSeconds: number): Promise<void> {
        const redisKey = `otp:${email.trim().toLowerCase()}`;
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
