import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthSessionService } from '../auth-session.service.js';
import { resolveJwtClaimsConfig } from '../utils/jwt-config.util.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authSessionService: AuthSessionService,
  ) {
    const claims = resolveJwtClaimsConfig(configService);
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      issuer: claims.issuer,
      audience: claims.accessAudience,
      algorithms: [claims.algorithm],
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    sid?: string;
    ver?: number;
  }) {
    await this.authSessionService.validateAccessTokenSession({
      userId: payload.sub,
      sessionId: payload.sid,
      tokenVersion: payload.ver,
    });

    return {
      userId: payload.sub,
      email: payload.email,
      sessionId: payload.sid,
    };
  }
}
