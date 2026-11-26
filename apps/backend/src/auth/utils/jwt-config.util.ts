import type { ConfigService } from '@nestjs/config';

export const DEFAULT_JWT_ISSUER = 'ai-studymate-api';
export const DEFAULT_JWT_ACCESS_AUDIENCE = 'ai-studymate-access';
export const DEFAULT_JWT_REFRESH_AUDIENCE = 'ai-studymate-refresh';
export const JWT_SIGNING_ALGORITHM = 'HS256' as const;

export interface JwtClaimsConfig {
  issuer: string;
  accessAudience: string;
  refreshAudience: string;
  algorithm: typeof JWT_SIGNING_ALGORITHM;
}

export function resolveJwtClaimsConfig(
  configService: ConfigService,
): JwtClaimsConfig {
  const issuer =
    configService.get<string>('JWT_ISSUER')?.trim() || DEFAULT_JWT_ISSUER;
  const accessAudience =
    configService.get<string>('JWT_ACCESS_AUDIENCE')?.trim() ||
    DEFAULT_JWT_ACCESS_AUDIENCE;
  const refreshAudience =
    configService.get<string>('JWT_REFRESH_AUDIENCE')?.trim() ||
    DEFAULT_JWT_REFRESH_AUDIENCE;

  return {
    issuer,
    accessAudience,
    refreshAudience,
    algorithm: JWT_SIGNING_ALGORITHM,
  };
}
