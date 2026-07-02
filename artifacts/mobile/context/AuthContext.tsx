import React, { createContext, useContext, useEffect, useState } from "react";
import {
  api,
  getCurrentUser,
  getToken,
  setCurrentUser,
  setToken,
} from "@/utils/api";
import { i18n, initI18n, type SupportedLanguage } from "@/utils/i18n";
import type { RegisterData, UpdateProfileData, User } from "@/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (emailOrMobile: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateOnboardingComplete: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
  /**
   * Request a password reset OTP for the given email.
   * Returns success even if email doesn't exist (for security).
   * delivered=true means email was sent via SMTP, delivered=false means only stored in DB.
   */
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string; delivered?: boolean }>;
  /**
   * Verify the reset password OTP sent to the user's email.
   */
  verifyResetOtp: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  /**
   * Reset password after OTP has been verified.
   */
  resetPassword: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  /**
   * Update the user's preferred language both locally (i18next) and on the
   * server (users.preferredLanguage). The next app launch will load in
   * this language.
   */
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  // On app launch, try to rehydrate the session from the stored token.
  // If the token is invalid or the server is unreachable, fall back to a
  // stored user (offline cache) and let API calls surface the auth error.
  // We also hydrate i18n from the cached user's preferred language so the
  // app starts in the right language on the very first render.
  async function init() {
    // Always boot i18n first so the first frame is localised.
    const cached = await getCurrentUser();
    const initialLang: SupportedLanguage = (cached?.preferredLanguage as SupportedLanguage) ?? "en";
    initI18n(initialLang);

    try {
      const token = await getToken();
      if (token) {
        try {
          const fresh = await api.auth.me(token);
          await setCurrentUser(fresh);
          setUser(fresh);
          if (fresh.preferredLanguage && fresh.preferredLanguage !== i18n.language) {
            await i18n.changeLanguage(fresh.preferredLanguage);
          }
          setIsLoading(false);
          return;
        } catch {
          // Token invalid or server down — clear the invalid token so
          // subsequent API calls don't keep sending a bad Bearer token
          // (which would cause 401 on every request).
          await setToken(null);
        }
      }
      if (cached) {
        setUser(cached);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function login(emailOrMobile: string, password: string) {
    const result = await api.auth.login(emailOrMobile, password);
    if (!result.ok) {
      return { success: false, error: result.error };
    }
    await setToken(result.token);
    await setCurrentUser(result.user);
    setUser(result.user);
    if (result.user.preferredLanguage) {
      await i18n.changeLanguage(result.user.preferredLanguage);
    }
    return { success: true, user: result.user };
  }

  async function register(data: RegisterData) {
    if (!data.emailVerifiedAt) {
      return {
        success: false,
        error: "Please verify your email OTP before registering.",
      };
    }
    try {
      await api.auth.register(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async function forgotPassword(email: string) {
    try {
      const result = await api.auth.forgotPassword(email);
      return { success: true, message: result.message, delivered: result.delivered };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async function verifyResetOtp(email: string, otp: string) {
    try {
      await api.auth.verifyResetOtp(email, otp);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async function resetPassword(email: string, newPassword: string) {
    try {
      const result = await api.auth.resetPassword(email, newPassword);
      return { success: true, message: result.message };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async function logout() {
    const token = await getToken();
    if (token) {
      try {
        await api.auth.logout();
      } catch {
        // ignore — server may be down
      }
    }
    await setToken(null);
    await setCurrentUser(null);
    setUser(null);
  }

  async function updateOnboardingComplete() {
    if (!user) return;
    const token = await getToken();
    if (!token) return;
    try {
      const updated = await api.auth.updateProfile(token, {
        onboardingComplete: true,
      });
      await setCurrentUser(updated);
      setUser(updated);
    } catch (e) {
      // Best-effort: also update local state
      const updatedUser: User = { ...user, onboardingComplete: true };
      await setCurrentUser(updatedUser);
      setUser(updatedUser);
    }
  }

  async function updateProfile(data: UpdateProfileData) {
    if (!user) return;
    const token = await getToken();
    if (!token) return;
    const updated = await api.auth.updateProfile(token, data);
    await setCurrentUser(updated);
    setUser(updated);
    if (updated.preferredLanguage && updated.preferredLanguage !== i18n.language) {
      await i18n.changeLanguage(updated.preferredLanguage);
    }
  }

  async function setLanguage(lang: SupportedLanguage) {
    // 1. Update i18n immediately so the UI switches instantly.
    await i18n.changeLanguage(lang);
    // 2. Persist the choice in the cached user object so the next launch
    //    boots in this language even when offline.
    if (user) {
      const updated: User = { ...user, preferredLanguage: lang };
      await setCurrentUser(updated);
      setUser(updated);
    }
    // 3. Try to push the change to the server (best-effort).
    const token = await getToken();
    if (token) {
      try {
        const updated = await api.auth.updateProfile(token, { preferredLanguage: lang });
        await setCurrentUser(updated);
        setUser(updated);
      } catch (err) {
        console.warn("[auth] Failed to persist language to server:", err);
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        updateOnboardingComplete,
        updateProfile,
        forgotPassword,
        verifyResetOtp,
        resetPassword,
        setLanguage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
