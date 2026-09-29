import {
    ConflictException,
    Injectable,
    InternalServerErrorException,
    UnauthorizedException,
} from '@nestjs/common';
import { GoogleService } from './google.service.js';
import { UsersService } from '../users/users.service.js';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { User } from '../generated/prisma/client.js';

@Injectable()
export class AuthService {
    constructor(
        private googleService: GoogleService,
        private jwtService: JwtService,
        private usersService: UsersService
    ) { }

    async signUpWithEmailAndPassword(registerDto: RegisterDto): Promise<{ access_token: string }> {
        const { name, email, password } = registerDto;

        const isUserExist: User | null = await this.usersService.findUserByEmail(email);

        if (isUserExist) {
            throw new ConflictException('User with this email already exists');
        }

        const password_hash: string = await this.hashPassword(password);

        let user: User | null;

        try {
            user = await this.usersService.createUser({ email, password_hash, name });
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

        const payload = { sub: user.id, email: user.email }

        return {
            access_token: await this.jwtService.signAsync(payload)
        };
    }

    async signInWithEmailAndPassword(loginDto: LoginDto): Promise<{ access_token: string }> {
        const { email, password } = loginDto;

        const user = await this.usersService.findUserByEmail(email);

        if (!user || !user.password_hash) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload = { sub: user.id, email: user.email };

        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }

    async createUserFromGoogleData(googleData: { email: string; name: string; avatar_url: string }): Promise<{ access_token: string }> {
        const { email, name, avatar_url } = googleData;

        let user: User | null = await this.usersService.findUserByEmail(email);

        if (!user) {
            user = await this.usersService.createUser({ email, name, avatar_url });

            if (!user) {
                throw new InternalServerErrorException('Failed to create user from Google data');
            }
        }

        const payload = { sub: user.id, email: user.email };

        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }

    async googleAuth(): Promise<{ url: string }> {
        return this.googleService.getOAuth2ClientUrl();
    }

    async getAuthClientData(code: string): Promise<{ email: string; name: string; avatar_url: string }> {
        return this.googleService.getAuthClientData(code);
    }

    async hashPassword(password: string): Promise<string> {
        const saltOrRounds = 10;
        const hash = await bcrypt.hash(password, saltOrRounds);
        return hash;
    }
}
