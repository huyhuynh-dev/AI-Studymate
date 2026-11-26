import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { resolveJwtClaimsConfig } from '../utils/jwt-config.util.js';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly configService: ConfigService) {
    const claims = resolveJwtClaimsConfig(configService);
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
      issuer: claims.issuer,
      audience: claims.refreshAudience,
      algorithms: [claims.algorithm],
    });
  }

  validate(
    req: Request,
    payload: { sub: string; email: string; rem?: boolean; sid?: string },
  ) {
    const authHeader = req.get('Authorization') ?? '';
    const refreshToken = authHeader.replace('Bearer', '').trim();
    return {
      userId: payload.sub,
      email: payload.email,
      refreshToken,
      rememberMe: Boolean(payload.rem),
      sessionId: payload.sid,
    };
  }
}
