import {
    ConflictException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    UnauthorizedException,
    Logger,
    NotFoundException,
    HttpException,
    HttpStatus,
    BadRequestException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleService } from './google.service.js';
import { UsersService } from '../users/users.service.js';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { User } from '../generated/prisma/client.js';
import { createHash, randomBytes, randomInt } from 'crypto';
import { RedisService } from '../redis/redis.service.js';
import { MailService } from '../mail/mail.service.js';

const GOOGLE_AUTH_CODE_TTL_SECONDS = 60;
const SIGN_UP_RESPONSE_MESSAGE = 'Vui lòng kiểm tra hộp thư để xác thực email.';
const EMAIL_VERIFICATION_RESPONSE_MESSAGE = 'Nếu email hợp lệ, mã OTP sẽ được gửi đến hộp thư.';

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
                expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d') as any,
            }),
        ]);

        return { access_token, refresh_token };
    }

    private async updateRefreshTokenHash(userId: string, refreshToken: string): Promise<void> {
        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
        await this.usersService.updateUser(userId, { refresh_token: hashedRefreshToken });
    }

    // ─── Email/Password Auth ────────────────────────────────

    async signUpWithEmailAndPassword(registerDto: RegisterDto): Promise<{ message: string }> {
        const { name, email, password } = registerDto;

        const isUserExist: User | null = await this.usersService.findUserByEmail(email);

        if (isUserExist) {
            return { message: SIGN_UP_RESPONSE_MESSAGE };
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
                return { message: SIGN_UP_RESPONSE_MESSAGE };
            }

            throw error;
        }

        if (!user) {
            throw new InternalServerErrorException('Sign up failed');
        }

        // const tokens = await this.generateTokens(user.id, user.email);
        // await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

        return { message: SIGN_UP_RESPONSE_MESSAGE };
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

        if (!user.is_verified) {
            throw new ForbiddenException('Email is not verified');
        }

        const tokens = await this.generateTokens(user.id, user.email);
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

        return tokens;
    }

    // ─── Google OAuth ───────────────────────────────────────

    async createUserFromGoogleData(googleData: { email: string; name: string; avatar_url: string; email_verified: boolean }): Promise<TokenPair> {
        const user = await this.getOrCreateGoogleUser(googleData);

        const tokens = await this.generateTokens(user.id, user.email);
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

        return tokens;
    }

    async createGoogleAuthCode(googleData: { email: string; name: string; avatar_url: string; email_verified?: boolean }): Promise<string> {
        const user = await this.getOrCreateGoogleUser({ ...googleData, email_verified: googleData.email_verified ?? true });
        const authCode = randomBytes(32).toString('hex');

        await this.redisService.set(
            this.getGoogleAuthCodeKey(authCode),
            user.id,
            GOOGLE_AUTH_CODE_TTL_SECONDS,
        );

        return authCode;
    }

    async exchangeGoogleAuthCode(authCode: string): Promise<TokenPair> {
        const userId = await this.redisService.getAndDelete(this.getGoogleAuthCodeKey(authCode));

        if (!userId) {
            throw new UnauthorizedException('Invalid or expired auth code');
        }

        const user = await this.usersService.findUserById(userId);

        if (!user) {
            throw new UnauthorizedException('Invalid or expired auth code');
        }

        const tokens = await this.generateTokens(user.id, user.email);
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

        return tokens;
    }

    // SEC-04: Kiểm tra email_verified và xử lý account linking an toàn
    private async getOrCreateGoogleUser(googleData: { email: string; name: string; avatar_url: string; email_verified: boolean }): Promise<User> {
        const { email, name, avatar_url, email_verified } = googleData;

        // Không chấp nhận Google account với email chưa xác thực
        if (!email_verified) {
            throw new ForbiddenException('Google email chưa được xác thực');
        }

        let user: User | null = await this.usersService.findUserByEmail(email);

        if (user) {
            // Nếu user đã tồn tại với provider khác (local email/password), yêu cầu link account rõ ràng
            if (user.provider && user.provider !== 'google') {
                throw new ConflictException(
                    'Tài khoản đã tồn tại với phương thức đăng nhập khác. Vui lòng đăng nhập và liên kết Google.',
                );
            }
        } else {
            // Tạo user mới từ Google, set is_verified = true vì Google đã xác thực email
            user = await this.usersService.createUser({ email, name, avatar_url, provider: 'google', is_verified: true });

            if (!user) {
                throw new InternalServerErrorException('Failed to create user from Google data');
            }
        }

        return user;
    }

    private getGoogleAuthCodeKey(authCode: string): string {
        return `auth:google-code:${authCode}`;
    }

    async googleAuth(): Promise<{ url: string }> {
        return this.googleService.getOAuth2ClientUrl();
    }

    // Delegate state validation sang GoogleService
    async validateGoogleOAuthState(state: string): Promise<void> {
        return this.googleService.validateOAuthState(state);
    }

    async getAuthClientData(code: string): Promise<{ email: string; name: string; avatar_url: string; email_verified: boolean }> {
        return this.googleService.getAuthClientData(code);
    }





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

    async requestEmailVerificationOtp(email: string): Promise<{ message: string }> {
        const normalizedEmail = email.trim().toLowerCase();
        const cooldownKey = `email_verify_cooldown:${normalizedEmail}`;
        const otpKey = this.getOtpKey(normalizedEmail, 'email-verification-otp');

        try {
            // SEC-08: Cooldown per email — chống spam kể cả khi đổi IP
            const isCooldown = await this.redisService.get(cooldownKey);
            if (isCooldown) {
                throw new HttpException(
                    'Vui lòng chờ 60 giây trước khi yêu cầu mã OTP mới.',
                    HttpStatus.TOO_MANY_REQUESTS,
                );
            }

            // Set cooldown trước khi check user để chống enumeration + spam
            await this.redisService.set(cooldownKey, '1', 60);

            const user = await this.usersService.findUserByEmail(normalizedEmail);

            if (!user || user.is_verified) {
                return { message: EMAIL_VERIFICATION_RESPONSE_MESSAGE };
            }

            const otp = this.generateOtp();
            await this.storeOtp(normalizedEmail, otp, 300, 'email-verification-otp');

            try {
                await this.sendOtpEmail(normalizedEmail, otp, 300);
            } catch (mailError) {
                await this.redisService.del(otpKey);
                await this.redisService.del(cooldownKey);
                this.logger.error(`Failed to send email verification OTP to ${normalizedEmail}: ${String(mailError)}`);
                throw new InternalServerErrorException('Failed to send email verification OTP');
            }

            return { message: EMAIL_VERIFICATION_RESPONSE_MESSAGE };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }

            this.logger.error(`Failed to create email verification OTP for ${normalizedEmail}: ${String(error)}`);
            throw new InternalServerErrorException('Failed to create email verification OTP');
        }
    }


    async verifyEmailOtp(email: string, otp: string): Promise<{ verified: boolean }> {
        const normalizedEmail = email.trim().toLowerCase();
        const otpKey = this.getOtpKey(normalizedEmail, 'email-verification-otp');
        const attemptKey = `email_verify_attempts:${normalizedEmail}`;

        try {
            const user = await this.usersService.findUserByEmail(normalizedEmail);

            if (!user) {
                throw new BadRequestException('Email verification OTP is invalid or expired');
            }

            if (user.is_verified) {
                return { verified: true };
            }

            const storedOtpHash = await this.redisService.get(otpKey);

            if (!storedOtpHash) {
                throw new BadRequestException('Email verification OTP is invalid or expired');
            }

            // CQ-01+SEC-06: Dùng atomic INCR để tránh race condition, gộp verify + attempt counting
            await this.verifyOtpWithAttemptLimit(storedOtpHash, otp, attemptKey, otpKey);

            // OTP đúng — xác thực user và dọn dẹp Redis
            await this.usersService.updateUser(user.id, { is_verified: true });
            await this.redisService.del(otpKey);
            await this.redisService.del(attemptKey);

            return { verified: true };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }

            this.logger.error(`Failed to verify email OTP for ${normalizedEmail}: ${String(error)}`);
            throw new InternalServerErrorException('Failed to verify email OTP');
        }
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

            // 3. User hợp lệ: Set cooldown 60s, reset attempt counter, sinh OTP, lưu Redis và gửi email
            await this.redisService.set(cooldownKey, '1', 60);
            await this.redisService.del(`otp_attempts:${normalizedEmail}`);

            const otp = this.generateOtp();
            await this.storeOtp(normalizedEmail, otp, 120);

            try {
                await this.sendOtpEmail(normalizedEmail, otp, 120);
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
        const redisKey = `otp:${normalizedEmail}`;
        const attemptKey = `otp_attempts:${normalizedEmail}`;

        try {
            const storedHash: string | null = await this.redisService.get(redisKey);

            if (!storedHash) {
                throw new NotFoundException('OTP không tồn tại hoặc đã hết hạn');
            }

            // CQ-01+SEC-06: Dùng method thống nhất với atomic INCR, tránh race condition và duplicate code
            await this.verifyOtpWithAttemptLimit(storedHash, otp, attemptKey, redisKey);

            // OTP chính xác -> Dọn dẹp OTP và số lần thử trong Redis
            await this.redisService.del(redisKey);
            await this.redisService.del(attemptKey);

            // Lấy thông tin user để định danh bằng User ID
            const user = await this.usersService.findUserByEmail(normalizedEmail);
            if (!user) {
                throw new NotFoundException('Không tìm thấy thông tin người dùng trong hệ thống');
            }

            // Cấp Opaque Token (chuỗi ngẫu nhiên 32 bytes) và lưu vào Redis:
            // Key: reset_token:<token> -> Value: user.id
            // TTL: 5 phút (300 giây)
            const reset_token = randomBytes(32).toString('hex');
            const resetTokenKey = `reset_token:${reset_token}`;
            await this.redisService.set(resetTokenKey, user.id, 300);

            return { reset_token };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            this.logger.error(`Lỗi khi xác minh OTP cho email ${normalizedEmail}: ${String(error)}`);
            throw new InternalServerErrorException('Đã xảy ra lỗi khi xác minh mã OTP');
        }
    }

    async resetPassword(resetToken: string, newPassword: string): Promise<{ message: string }> {
        const cleanToken = resetToken.trim();
        const resetTokenKey = `reset_token:${cleanToken}`;

        try {
            // 1. Kiểm tra Opaque Token trong Redis
            const userId = await this.redisService.get(resetTokenKey);
            if (!userId) {
                throw new BadRequestException('Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
            }

            // 2. Kiểm tra xem User có tồn tại trong hệ thống không
            const user = await this.usersService.findUserById(userId);
            if (!user) {
                await this.redisService.del(resetTokenKey);
                throw new NotFoundException('Người dùng không tồn tại trong hệ thống.');
            }

            // 3. Hash mật khẩu mới và cập nhật Database (thu hồi luôn phiên đăng nhập cũ)
            const password_hash = await this.hashPassword(newPassword);
            await this.usersService.updateUser(userId, {
                password_hash,
                refresh_token: null, // Đăng xuất khỏi mọi phiên đăng nhập cũ
            });

            // 4. Xóa ngay Token khỏi Redis để đảm bảo tính chất Single-use
            await this.redisService.del(resetTokenKey);

            return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.' };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            this.logger.error(`Lỗi khi đặt lại mật khẩu: ${String(error)}`);
            throw new InternalServerErrorException('Đã xảy ra lỗi khi đặt lại mật khẩu.');
        }
    }

    // ─── Utilities ──────────────────────────────────────────

    private generateOtp(): number {
        return randomInt(100000, 1000000);
    }

    private async storeOtp(
        email: string,
        otp: number,
        expireInSeconds: number,
        keyPrefix = 'otp',
    ): Promise<void> {
        const otpHash = this.hashOTP(otp);
        const redisKey = this.getOtpKey(email, keyPrefix);
        await this.redisService.set(redisKey, otpHash, expireInSeconds);
    }

    private getOtpKey(email: string, keyPrefix: string): string {
        return `${keyPrefix}:${email.trim().toLowerCase()}`;
    }

    private async sendOtpEmail(email: string, otp: number, expireInSeconds: number): Promise<void> {
        const result = await this.mailService.sendOtpMail(email, otp.toString(), expireInSeconds);
        if (!result.success) {
            throw new InternalServerErrorException('Không thể gửi email OTP');
        }
    }

    // SEC-06+CQ-01: Method thống nhất dùng atomic INCR — tránh race condition và duplicate GET logic
    private async verifyOtpWithAttemptLimit(
        storedHash: string,
        inputOtp: string,
        attemptKey: string,
        otpKey: string,
        maxAttempts = 3,
    ): Promise<void> {
        const hashedInput = this.hashOTP(inputOtp);

        if (hashedInput === storedHash) {
            return; // OTP đúng, không cần tăng attempt counter
        }

        // OTP sai → increment atomically (INCR là lệnh atomic trong Redis)
        const attempts = await this.redisService.incr(attemptKey);
        if (attempts === 1) {
            // Lần đầu increment, set TTL cho key
            await this.redisService.expire(attemptKey, 120);
        }

        if (attempts >= maxAttempts) {
            await this.redisService.del(otpKey);
            await this.redisService.del(attemptKey);
            throw new ForbiddenException('Bạn đã nhập sai OTP quá 3 lần. Vui lòng yêu cầu mã OTP mới.');
        }

        throw new ForbiddenException(`Mã OTP không chính xác. Bạn còn ${maxAttempts - attempts} lần thử.`);
    }

    private async hashPassword(password: string): Promise<string> {
        const saltOrRounds = 10;
        const hash = await bcrypt.hash(password, saltOrRounds);
        return hash;
    }

    private hashOTP(num: number | string): string {
        return createHash('sha256').update(num.toString()).digest('hex');
    }

}

