import { describe, expect, it } from 'vitest';
import {
  authorizeCollaborationAccess,
  documentIdFromRoomName,
  signCollaborationToken,
  verifyCollaborationToken,
} from './collaboration-token.helper.js';

describe('collaboration-token.helper', () => {
  const secret = 'test-collab-secret-key';

  it('trích xuất đúng documentId từ roomName SuperDoc v2', () => {
    expect(documentIdFromRoomName('sd2/v2/doc-123')).toBe('doc-123');
    expect(documentIdFromRoomName('sd2/v1/abc-xyz')).toBe('abc-xyz');
    expect(documentIdFromRoomName('invalid-room-name')).toBeNull();
  });

  it('ký, xác thực và phân quyền token đúng tài liệu và thời hạn', () => {
    const now = 1_700_000_000_000;
    const exp = Math.floor(now / 1000) + 300;
    const token = signCollaborationToken(secret, {
      sub: 'user-1',
      documents: ['doc-1'],
      readOnly: false,
      exp,
    });

    const verified = verifyCollaborationToken(secret, token, now);
    expect(verified).toEqual({
      sub: 'user-1',
      documents: ['doc-1'],
      readOnly: false,
      exp,
    });

    expect(
      authorizeCollaborationAccess(secret, {
        token,
        documentName: 'sd2/v2/doc-1',
        nowMs: now,
      }),
    ).toEqual({
      userId: 'user-1',
      documentId: 'doc-1',
      readOnly: false,
    });

    // Từ chối truy cập tài liệu khác
    expect(
      authorizeCollaborationAccess(secret, {
        token,
        documentName: 'sd2/v2/doc-other',
        nowMs: now,
      }),
    ).toBeNull();

    // Từ chối token bị chỉnh sửa chữ ký
    expect(verifyCollaborationToken(secret, `${token.slice(0, -2)}xx`, now)).toBeNull();

    // Từ chối token đã hết hạn
    expect(
      verifyCollaborationToken(secret, token, exp * 1000 + 1000),
    ).toBeNull();
  });
});
