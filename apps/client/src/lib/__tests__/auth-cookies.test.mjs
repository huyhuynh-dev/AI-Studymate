import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeCookieMaxAge, decodeJwtExp } from '../auth-cookies.ts';

function makeJwtWithPayload(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.dummy-signature`;
}

describe('auth-cookies', () => {
  it('decodeJwtExp đọc chính xác trường exp từ JWT hợp lệ', () => {
    const exp = 1_800_000_000;
    const token = makeJwtWithPayload({ sub: 'u1', exp });
    assert.equal(decodeJwtExp(token), exp);
  });

  it('decodeJwtExp trả về null với token không hợp lệ hoặc thiếu exp', () => {
    assert.equal(decodeJwtExp('invalid-token'), null);
    assert.equal(decodeJwtExp(makeJwtWithPayload({ sub: 'u1' })), null);
  });

  it('computeCookieMaxAge giữ nguyên chính xác thời hạn 30 ngày / 7 ngày từ exp JWT', () => {
    const nowMs = 1_700_000_000_000;
    const thirtyDaysSec = 60 * 60 * 24 * 30;
    const sevenDaysSec = 60 * 60 * 24 * 7;

    const rememberToken = makeJwtWithPayload({ exp: 1_700_000_000 + thirtyDaysSec });
    const standardToken = makeJwtWithPayload({ exp: 1_700_000_000 + sevenDaysSec });
    const expiredToken = makeJwtWithPayload({ exp: 1_700_000_000 - 10 });

    assert.equal(computeCookieMaxAge(rememberToken, sevenDaysSec, nowMs), thirtyDaysSec);
    assert.equal(computeCookieMaxAge(standardToken, thirtyDaysSec, nowMs), sevenDaysSec);
    assert.equal(computeCookieMaxAge(expiredToken, sevenDaysSec, nowMs), 0);
    assert.equal(computeCookieMaxAge('malformed', sevenDaysSec, nowMs), sevenDaysSec);
  });
});
