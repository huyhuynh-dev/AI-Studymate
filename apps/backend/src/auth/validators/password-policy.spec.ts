import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertPasswordNotContainingUserInfo,
  validateAppPasswordStrength,
} from './password-policy.js';

describe('password-policy', () => {
  it('chấp nhận mật khẩu đủ chuẩn (8-128 ký tự, bất kỳ ký tự đặc biệt nào hoặc passphrase >= 15 ký tự)', () => {
    expect(validateAppPasswordStrength('MyPass123').valid).toBe(true);
    expect(validateAppPasswordStrength('My#Secret_2026!').valid).toBe(true);
    expect(validateAppPasswordStrength('correct horse battery staple').valid).toBe(
      true,
    );
  });

  it('từ chối mật khẩu quá ngắn, quá dài, yếu/phổ biến hoặc lặp 1 ký tự', () => {
    expect(validateAppPasswordStrength('Abc123').valid).toBe(false);
    expect(validateAppPasswordStrength('A'.repeat(129)).valid).toBe(false);
    expect(validateAppPasswordStrength('password123').valid).toBe(false);
    expect(validateAppPasswordStrength('12345678').valid).toBe(false);
    expect(validateAppPasswordStrength('aaaaaaaa').valid).toBe(false);
    expect(validateAppPasswordStrength('abcdefgh').valid).toBe(false);
  });

  it('từ chối mật khẩu chứa email hoặc tên người dùng', () => {
    expect(() =>
      assertPasswordNotContainingUserInfo('Student123!', {
        email: 'student@studymate.vn',
        name: 'Nguyễn Văn A',
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      assertPasswordNotContainingUserInfo('SafePass#2026', {
        email: 'student@studymate.vn',
        name: 'Nguyễn Văn A',
      }),
    ).not.toThrow();
  });
});
