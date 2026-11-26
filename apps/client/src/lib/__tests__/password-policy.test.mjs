import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePasswordStrength,
  validatePasswordPolicy,
} from '../password-policy.ts';

describe('password-policy (client)', () => {
  it('cho phép mật khẩu có ký tự đặc biệt bất kỳ và passphrase >= 15 ký tự', () => {
    assert.equal(validatePasswordPolicy('Safe#Pass_2026'), null);
    assert.equal(validatePasswordPolicy('hoc tap hieu qua moi ngay'), null);
  });

  it('từ chối mật khẩu phổ biến hoặc chứa email/tên', () => {
    assert.ok(validatePasswordPolicy('password123'));
    assert.ok(
      validatePasswordPolicy('NguyenVanA123!', {
        email: 'user@example.com',
        name: 'Nguyen Van A',
      }),
    );
    assert.ok(
      validatePasswordPolicy('Student999!', {
        email: 'student@studymate.vn',
      }),
    );
  });

  it('evaluatePasswordStrength đánh giá chính xác mức độ mạnh', () => {
    assert.equal(evaluatePasswordStrength('').level, 'empty');
    assert.equal(evaluatePasswordStrength('password123').level, 'weak');
    assert.equal(evaluatePasswordStrength('StudyMate#2026!').level, 'strong');
  });
});
