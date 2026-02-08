import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth";

// Form data types
export interface LoginFormData {
  email: string;
  password: string;
  turnstileToken?: string;
}

export interface SignupFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  turnstileToken?: string;
}

export const useAuth = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login function using Better Auth
  const login = async (data: LoginFormData): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });

      if (result.error) {
        setError(result.error.message || "Login error");
        return false;
      }

      // Redirect after successful login
      router.push("/explore");
      router.refresh();
      return true;
    } catch (err) {
      console.error("Login error:", err);
      setError("Error connecting to server");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Signup function using Better Auth
  const signup = async (data: SignupFormData): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
        callbackURL: `${window.location.origin}/explore`,
      });

      if (result.error) {
        setError(result.error.message || "Registration error");
        return false;
      }

      // Redirect to email verification page
      router.push(`/auth/verify?email=${encodeURIComponent(data.email)}`);
      return true;
    } catch (err) {
      console.error("Signup error:", err);
      setError("Error connecting to server");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function using Better Auth
  const logout = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await authClient.signOut();

      // Redirect after successful logout
      router.push("/auth/login");
      router.refresh();
      return true;
    } catch (err) {
      console.error("Logout error:", err);
      setError("Error connecting to server");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Request password reset using Better Auth
  const requestPasswordReset = async (
    email: string,
    _turnstileToken?: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (result.error) {
        setError(result.error.message || "Error requesting password reset");
        return false;
      }

      return true;
    } catch (err) {
      console.error("Password reset request error:", err);
      setError("Error connecting to server");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Reset password using Better Auth
  const resetPassword = async (
    _code: string,
    password: string,
    _confirmPassword: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get token from URL (Better Auth passes it as a query param)
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");

      if (!token) {
        setError("Invalid or expired reset link");
        return false;
      }

      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        setError(result.error.message || "Error resetting password");
        return false;
      }

      // Redirect after successful reset
      router.push("/auth/login?resetSuccess=true");
      return true;
    } catch (err) {
      console.error("Password reset error:", err);
      setError("Error connecting to server");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Verify email using token from URL
  const verify = useCallback(async (data: { code?: string }): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get token from URL (Better Auth passes it as a query param)
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");

      if (!token && !data.code) {
        setError("Verification token not found");
        return false;
      }

      const result = await authClient.verifyEmail({
        query: {
          token: token || data.code || "",
        },
      });

      if (result.error) {
        setError(result.error.message || "Email verification error");
        return false;
      }

      // Redirect after successful verification
      router.push("/explore");
      router.refresh();
      return true;
    } catch (err) {
      console.error("Email verification error:", err);
      setError("Error connecting to server");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Resend verification email
  const resendVerificationEmail = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/explore`,
      });

      if (result.error) {
        setError(result.error.message || "Error sending verification email");
        return false;
      }

      return true;
    } catch (err) {
      console.error("Resend verification error:", err);
      setError("Error connecting to server");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    login,
    signup,
    logout,
    requestPasswordReset,
    resetPassword,
    verify,
    resendVerificationEmail,
    isLoading,
    error,
  };
};
