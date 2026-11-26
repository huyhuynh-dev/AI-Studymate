import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyCsrfRequest } from '../csrf-guard.ts';

function makeRequest(url, method, headers = {}) {
  return new Request(url, {
    method,
    headers,
  });
}

describe('csrf-guard', () => {
  it('cho phép các phương thức GET thông thường khi checkSafeMethods không bật', () => {
    const req = makeRequest('http://localhost:3000/api/proxy/subjects', 'GET', {
      host: 'localhost:3000',
      'sec-fetch-site': 'cross-site',
    });
    assert.equal(verifyCsrfRequest(req), null);
  });

  it('chặn request mutation hoặc refresh có Sec-Fetch-Site: cross-site', () => {
    const postReq = makeRequest('http://localhost:3000/api/auth/logout', 'POST', {
      host: 'localhost:3000',
      'sec-fetch-site': 'cross-site',
      origin: 'https://evil.example',
    });
    const postRes = verifyCsrfRequest(postReq);
    assert.ok(postRes);
    assert.equal(postRes.status, 403);

    const refreshReq = makeRequest('http://localhost:3000/api/auth/refresh', 'GET', {
      host: 'localhost:3000',
      'sec-fetch-site': 'cross-site',
    });
    const refreshRes = verifyCsrfRequest(refreshReq, { checkSafeMethods: true });
    assert.ok(refreshRes);
    assert.equal(refreshRes.status, 403);
  });

  it('chặn Origin null hoặc Origin/Referer khác nguồn, cho phép cùng nguồn', () => {
    const nullOriginReq = makeRequest('http://localhost:3000/api/proxy/users/me', 'PATCH', {
      host: 'localhost:3000',
      origin: 'null',
    });
    assert.equal(verifyCsrfRequest(nullOriginReq)?.status, 403);

    const badRefererReq = makeRequest('http://localhost:3000/api/proxy/users/me', 'PATCH', {
      host: 'localhost:3000',
      referer: 'https://attacker.com/phish',
    });
    assert.equal(verifyCsrfRequest(badRefererReq)?.status, 403);

    const validSameOriginReq = makeRequest('http://localhost:3000/api/proxy/users/me', 'PATCH', {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'sec-fetch-site': 'same-origin',
    });
    assert.equal(verifyCsrfRequest(validSameOriginReq), null);
  });
});
