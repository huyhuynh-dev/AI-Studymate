import axios from "axios"

const BASE_URL = "http://localhost:3001";

export const handleGoogleLogin = async (): Promise<void> => {

    window.location.href = `${BASE_URL}/auth/google-auth`;
}

export const handleEmailLogin = async (email: string, password: string): Promise<void> => {
    const response = await axios.post(`${BASE_URL}/auth/sign-in`, {
        email,
        password
    });
    window.location.href = response.data;
}