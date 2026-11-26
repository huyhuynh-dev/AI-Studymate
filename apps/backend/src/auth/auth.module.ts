import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GoogleService } from './google.service.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { UsersModule } from '../users/users.module.js';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy.js';
import { MailModule } from '../mail/mail.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { AuthSessionService } from './auth-session.service.js';
import { resolveJwtClaimsConfig } from './utils/jwt-config.util.js';
import { parseExpiresInSeconds } from './utils/token-duration.util.js';

@Module({
  imports: [
    UsersModule,
    MailModule,
    PassportModule,
    PrismaModule,
    RedisModule, // CQ-06: Import module thay vì khai báo provider trực tiếp để dùng chung 1 Redis connection
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const claims = resolveJwtClaimsConfig(configService);
        return {
          secret: configService.getOrThrow<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: parseExpiresInSeconds(
              configService.get<string>('JWT_EXPIRES_IN'),
              3600,
            ),
            issuer: claims.issuer,
            audience: claims.accessAudience,
            algorithm: claims.algorithm,
          },
        };
      },
    }),
  ],
  providers: [
    GoogleService,
    AuthService,
    AuthSessionService,
    JwtStrategy,
    RefreshTokenStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService, AuthSessionService],
})
export class AuthModule { }
