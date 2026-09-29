import axios from 'axios';

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
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
  } catch (error: any) {
    const errorMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';

    return {
      success: false,
      error: errorMessage,
    };
  }
};