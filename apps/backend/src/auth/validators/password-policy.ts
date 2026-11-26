import {
  BadRequestException,
} from '@nestjs/common';
import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSPHRASE_LENGTH_THRESHOLD = 15;

const COMMON_WEAK_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'password12',
  'password123',
  'password@123',
  'p@ssword1',
  'passw0rd',
  'qwerty123',
  'qwertyui',
  'abc12345',
  'abcd1234',
  'admin123',
  'admin@123',
  'welcome1',
  'welcome123',
  'letmein1',
  'letmein123',
  'iloveyou1',
  'aa123456',
  'a1234567',
  'studymate1',
  'studymate123',
  'test1234',
  '1q2w3e4r',
  '1qaz2wsx',
]);

export function validateAppPasswordStrength(
  password: unknown,
): { valid: boolean; reason?: string } {
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, reason: 'Mật khẩu không được để trống' };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      reason: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
    };
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      reason: `Mật khẩu không được vượt quá ${PASSWORD_MAX_LENGTH} ký tự`,
    };
  }

  const normalized = password.trim().toLowerCase();
  if (COMMON_WEAK_PASSWORDS.has(normalized)) {
    return {
      valid: false,
      reason: 'Mật khẩu quá phổ biến hoặc dễ đoán. Vui lòng chọn mật khẩu khác.',
    };
  }

  if (/^(.)\1+$/.test(password)) {
    return {
      valid: false,
      reason: 'Mật khẩu không được chỉ lặp lại một ký tự duy nhất.',
    };
  }

  // Cho phép passphrase dài >= 15 ký tự, hoặc >= 8 ký tự có cả chữ cái và chữ số (chấp nhận mọi ký tự đặc biệt)
  if (password.length < PASSPHRASE_LENGTH_THRESHOLD) {
    const hasLetter = /[A-Za-z]/.test(password);
    const hasDigit = /\d/.test(password);
    if (!hasLetter || !hasDigit) {
      return {
        valid: false,
        reason:
          'Mật khẩu phải bao gồm cả chữ cái và chữ số (hoặc là passphrase dài tối thiểu 15 ký tự).',
      };
    }
  }

  return { valid: true };
}

export function assertPasswordNotContainingUserInfo(
  password: string,
  context: { email?: string | null; name?: string | null },
): void {
  const lowerPassword = password.toLowerCase();

  if (context.email) {
    const normalizedEmail = context.email.trim().toLowerCase();
    if (normalizedEmail && lowerPassword.includes(normalizedEmail)) {
      throw new BadRequestException(
        'Mật khẩu không được chứa địa chỉ email của bạn.',
      );
    }

    const localPart = normalizedEmail.split('@')[0];
    if (localPart && localPart.length >= 4 && lowerPassword.includes(localPart)) {
      throw new BadRequestException(
        'Mật khẩu không được chứa phần tên trong địa chỉ email của bạn.',
      );
    }
  }

  if (context.name) {
    const normalizedName = context.name.trim().toLowerCase().replace(/\s+/g, '');
    if (normalizedName.length >= 4 && lowerPassword.includes(normalizedName)) {
      throw new BadRequestException(
        'Mật khẩu không được chứa tên tài khoản của bạn.',
      );
    }
  }
}

export function IsStrongAppPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongAppPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return validateAppPasswordStrength(value).valid;
        },
        defaultMessage(args: ValidationArguments) {
          return (
            validateAppPasswordStrength(args.value).reason ??
            'Mật khẩu không đáp ứng yêu cầu bảo mật.'
          );
        },
      },
    });
  };
}
