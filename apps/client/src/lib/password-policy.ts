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

export function validatePasswordPolicy(
  password: string,
  context?: { email?: string; name?: string },
): string | null {
  if (!password) {
    return 'Vui lòng nhập mật khẩu.';
  }

  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `Mật khẩu phải từ ${PASSWORD_MIN_LENGTH} đến ${PASSWORD_MAX_LENGTH} ký tự.`;
  }

  const normalized = password.trim().toLowerCase();
  if (COMMON_WEAK_PASSWORDS.has(normalized)) {
    return 'Mật khẩu quá phổ biến hoặc dễ đoán. Vui lòng chọn mật khẩu khác.';
  }

  if (/^(.)\1+$/.test(password)) {
    return 'Mật khẩu không được chỉ lặp lại một ký tự duy nhất.';
  }

  if (password.length < PASSPHRASE_LENGTH_THRESHOLD) {
    const hasLetter = /[A-Za-z]/.test(password);
    const hasDigit = /\d/.test(password);
    if (!hasLetter || !hasDigit) {
      return 'Mật khẩu phải có cả chữ cái và chữ số (hoặc là passphrase tối thiểu 15 ký tự).';
    }
  }

  if (context?.email) {
    const lowerPass = password.toLowerCase();
    const lowerEmail = context.email.trim().toLowerCase();
    if (lowerEmail && lowerPass.includes(lowerEmail)) {
      return 'Mật khẩu không được chứa địa chỉ email của bạn.';
    }
    const localPart = lowerEmail.split('@')[0];
    if (localPart && localPart.length >= 4 && lowerPass.includes(localPart)) {
      return 'Mật khẩu không được chứa phần tên trong địa chỉ email của bạn.';
    }
  }

  if (context?.name) {
    const lowerPass = password.toLowerCase();
    const compactName = context.name.trim().toLowerCase().replace(/\s+/g, '');
    if (compactName.length >= 4 && lowerPass.includes(compactName)) {
      return 'Mật khẩu không được chứa tên của bạn.';
    }
  }

  return null;
}

export function evaluatePasswordStrength(password: string): {
  text: string;
  level: 'empty' | 'weak' | 'medium' | 'strong';
} {
  if (!password) {
    return { text: 'Chưa nhập', level: 'empty' };
  }

  const policyError = validatePasswordPolicy(password);
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { text: `Yếu (tối thiểu ${PASSWORD_MIN_LENGTH} ký tự)`, level: 'weak' };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { text: `Lỗi (tối đa ${PASSWORD_MAX_LENGTH} ký tự)`, level: 'weak' };
  }
  if (policyError) {
    return { text: 'Yếu (dễ đoán hoặc thiếu thành phần)', level: 'weak' };
  }

  let score = 0;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9\s]/.test(password)) score++;
  if (password.length >= 12) score++;

  if (score >= 3 || password.length >= PASSPHRASE_LENGTH_THRESHOLD) {
    return { text: 'Mạnh', level: 'strong' };
  }
  if (score >= 1) {
    return { text: 'Trung bình', level: 'medium' };
  }
  return { text: 'Yếu', level: 'weak' };
}
