import React, { createContext, useContext, useEffect, useState } from "react";
import {
  api,
  getCurrentUser,
  getToken,
  setCurrentUser,
  setToken,
} from "@/utils/api";
import type { RegisterData, UpdateProfileData, User } from "@/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (emailOrMobile: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateOnboardingComplete: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  getPendingUsers: () => Promise<User[]>;
  getAllTailors: () => Promise<User[]>;
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
  async function init() {
    try {
      const token = await getToken();
      if (token) {
        try {
          const fresh = await api.auth.me(token);
          await setCurrentUser(fresh);
          setUser(fresh);
          setIsLoading(false);
          return;
        } catch {
          // Token invalid or server down — try cached user
        }
      }
      const cached = await getCurrentUser();
      setUser(cached);
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
    return { success: true };
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
  }

  async function approveUser(userId: string) {
    const token = await getToken();
    if (!token) throw new Error("Not authenticated");
    await api.auth.approveUser(token, userId);
  }

  async function rejectUser(userId: string) {
    const token = await getToken();
    if (!token) throw new Error("Not authenticated");
    await api.auth.rejectUser(token, userId);
  }

  async function getPendingUsers() {
    const token = await getToken();
    if (!token) return [];
    return api.auth.pendingUsers(token);
  }

  async function getAllTailors() {
    const token = await getToken();
    if (!token) return [];
    return api.auth.allTailors(token);
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
        approveUser,
        rejectUser,
        getPendingUsers,
        getAllTailors,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
