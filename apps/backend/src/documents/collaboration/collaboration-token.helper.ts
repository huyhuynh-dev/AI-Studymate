import { createHmac, timingSafeEqual } from 'node:crypto';

const SUPERDOC_ROOM_REGEX = /^sd2\/v[^/]+\/(.+)$/;

export interface CollaborationTokenClaims {
  sub: string;
  documents: string[] | '*';
  readOnly?: boolean;
  exp: number;
}

export interface VerifiedCollaborationToken {
  sub: string;
  documents: string[] | '*';
  readOnly: boolean;
  exp: number;
}

function encodeBase64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeBase64UrlJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
}

function computeHmacSignature(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function resolveCollaborationSecret(): string {
  return (
    process.env.COLLABORATION_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    'studymate-superdoc-collab-dev-secret'
  );
}

/**
 * Trích xuất documentId từ roomName chuẩn SuperDoc v2 (`sd2/v<x>/<documentId>`).
 */
export function documentIdFromRoomName(roomName: string): string | null {
  const match = SUPERDOC_ROOM_REGEX.exec(roomName);
  return match?.[1] ?? null;
}

export function signCollaborationToken(
  secret: string,
  claims: CollaborationTokenClaims,
): string {
  const headerAndPayload = `${encodeBase64UrlJson({ alg: 'HS256', typ: 'JWT' })}.${encodeBase64UrlJson(claims)}`;
  const sig = computeHmacSignature(secret, headerAndPayload);
  return `${headerAndPayload}.${sig}`;
}

export function verifyCollaborationToken(
  secret: string,
  token: string,
  nowMs = Date.now(),
): VerifiedCollaborationToken | null {
  if (typeof token !== 'string' || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerPart, bodyPart, signaturePart] = parts;
  const expectedSig = Buffer.from(
    computeHmacSignature(secret, `${headerPart}.${bodyPart}`),
    'utf8',
  );
  const actualSig = Buffer.from(signaturePart, 'utf8');
  if (
    expectedSig.length !== actualSig.length ||
    !timingSafeEqual(expectedSig, actualSig)
  ) {
    return null;
  }

  try {
    const header = decodeBase64UrlJson<{ alg?: unknown }>(headerPart);
    if (header?.alg !== 'HS256') return null;

    const claims = decodeBase64UrlJson<Partial<CollaborationTokenClaims>>(bodyPart);
    if (
      typeof claims?.sub !== 'string' ||
      !claims.sub ||
      typeof claims.exp !== 'number' ||
      claims.exp * 1000 <= nowMs
    ) {
      return null;
    }

    const validDocs =
      claims.documents === '*' ||
      (Array.isArray(claims.documents) &&
        claims.documents.every((id) => typeof id === 'string' && id.length > 0));
    if (!validDocs || !claims.documents) {
      return null;
    }

    return {
      sub: claims.sub,
      documents: claims.documents,
      readOnly: claims.readOnly === true,
      exp: claims.exp,
    };
  } catch {
    return null;
  }
}

export function authorizeCollaborationAccess(
  secret: string,
  params: { token: string; documentName: string; nowMs?: number },
): { userId: string; documentId: string; readOnly: boolean } | null {
  const documentId = documentIdFromRoomName(params.documentName);
  if (!documentId) return null;

  const claims = verifyCollaborationToken(secret, params.token, params.nowMs);
  if (!claims) return null;

  if (claims.documents !== '*' && !claims.documents.includes(documentId)) {
    return null;
  }

  return {
    userId: claims.sub,
    documentId,
    readOnly: claims.readOnly,
  };
}
