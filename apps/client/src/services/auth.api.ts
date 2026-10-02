import axios, { isAxiosError } from 'axios';

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ForgotPasswordCredentials {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface VerifyOtpCredentials {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  reset_token?: string;
  message?: string;
  error?: string;
}

export interface ResetPasswordCredentials {
  reset_token: string;
  new_password: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

function extractErrorMessage(error: unknown, defaultMessage: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: string; message?: string | string[] }
      | undefined;
    if (data?.error) return data.error;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
    return error.message || defaultMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return defaultMessage;
}

/**
 * Handle Google OAuth authentication flow.
 * Fetches the Google OAuth consent URL and redirects the browser.
 */
export const handleGoogleLogin = async (): Promise<void> => {
  try {
    const response = await axios.get<{ url: string }>('/api/auth/google');
    if (response.data?.url) {
      window.location.href = response.data.url;
      return;
    }
  } catch (error) {
    console.warn(
      'Failed to obtain Google OAuth URL via internal route, falling back to direct endpoint:',
      error
    );
  }

  // Fallback to direct backend endpoint
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  window.location.href = `${backendUrl}/auth/google-auth`;
};

/**
 * Handle standard email & password sign-in.
 * Sends credentials to the Next.js API route handler, which delegates to backend
 * and automatically sets HttpOnly Secure Cookies for access_token and refresh_token.
 */
export const handleEmailLogin = async (
  credentials: LoginCredentials
): Promise<AuthResponse> => {
  try {
    const response = await axios.post<AuthResponse>(
      '/api/auth/login',
      credentials,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: unknown) {
    return {
      success: false,
      error: extractErrorMessage(error, 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.'),
    };
  }
};

/**
 * Handle user registration (sign-up).
 * Sends registration data to Next.js API route handler, which registers the account
 * at the backend and sets HttpOnly Secure Cookies for the returned tokens.
 */
export const handleRegister = async (
  credentials: RegisterCredentials
): Promise<AuthResponse> => {
  try {
    const response = await axios.post<AuthResponse>(
      '/api/auth/register',
      credentials,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: unknown) {
    return {
      success: false,
      error: extractErrorMessage(error, 'Đăng ký không thành công. Vui lòng thử lại sau.'),
    };
  }
};

/**
 * Handle forgot password request.
 * Sends email to Next.js API route handler to trigger OTP generation and email delivery.
 */
export const handleForgotPassword = async (
  credentials: ForgotPasswordCredentials
): Promise<ForgotPasswordResponse> => {
  try {
    const response = await axios.post<ForgotPasswordResponse>(
      '/api/auth/forgot-password',
      credentials,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: unknown) {
    return {
      success: false,
      error: extractErrorMessage(
        error,
        'Không thể gửi mã xác nhận OTP. Vui lòng thử lại sau.'
      ),
    };
  }
};

/**
 * Handle OTP verification.
 * Sends email and 6-digit OTP code to verify and retrieve a 5-minute reset_token.
 */
export const handleVerifyOtp = async (
  credentials: VerifyOtpCredentials
): Promise<VerifyOtpResponse> => {
  try {
    const response = await axios.post<VerifyOtpResponse>(
      '/api/auth/verify-otp',
      credentials,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: unknown) {
    return {
      success: false,
      error: extractErrorMessage(error, 'Mã OTP không hợp lệ hoặc đã hết hạn.'),
    };
  }
};

/**
 * Handle resetting password.
 * Sends reset_token and new_password to complete password reset flow.
 */
export const handleResetPassword = async (
  credentials: ResetPasswordCredentials
): Promise<ResetPasswordResponse> => {
  try {
    const response = await axios.post<ResetPasswordResponse>(
      '/api/auth/reset-password',
      credentials,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: unknown) {
    return {
      success: false,
      error: extractErrorMessage(
        error,
        'Đặt lại mật khẩu thất bại. Vui lòng thử lại sau.'
      ),
    };
  }
};