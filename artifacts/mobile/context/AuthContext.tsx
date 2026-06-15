import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import type { ApiUser } from "@workspace/api-client";
import { api as apiMethods } from "@workspace/api-client";

// Note: the API client is configured in app/_layout.tsx via setupApi().
// Do NOT call configureApi() here at module level — it must be a single
// initialization to avoid clobbering the token getter at re-render time.

interface AuthContextType {
  user: ApiUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (emailOrMobile: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    name: string;
    email: string;
    mobile: string;
    password: string;
    shopName?: string;
    shopAddress?: string;
    city?: string;
    state?: string;
  }) => Promise<{ success: boolean; error?: string; id?: string }>;
  logout: () => Promise<void>;
  updateProfile: (
    data: Partial<Pick<ApiUser, "name" | "email" | "mobile" | "shopName" | "shopAddress" | "city" | "state" | "avatarUri">>
  ) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  // Admin operations
  listUsers: () => Promise<ApiUser[]>;
  getAllTailors: () => Promise<ApiUser[]>;
  getPendingUsers: () => Promise<ApiUser[]>;
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  updateUser: (userId: string, data: Record<string, unknown>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    try {
      const token = await AsyncStorage.getItem("tailorbook_token");
      if (token) {
        const currentUser = await apiMethods().me();
        setUser(currentUser);
      }
      // If no token or user fetch succeeds, mark as initialized.
      setIsInitialized(true);
    } catch (error) {
      // Token may be invalid/expired — clear it and proceed unauthenticated.
      await AsyncStorage.removeItem("tailorbook_token");
      setUser(null);
      setIsInitialized(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(emailOrMobile: string, password: string) {
    try {
      const response = await apiMethods().login(emailOrMobile, password);
      const { token } = response;
      await AsyncStorage.setItem("tailorbook_token", token);
      const currentUser = await apiMethods().me();
      setUser(currentUser);
      return { success: true };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Login failed. Please try again.";
      return { success: false, error: message };
    }
  }

  async function register(data: {
    name: string;
    email: string;
    mobile: string;
    password: string;
    shopName?: string;
    shopAddress?: string;
    city?: string;
    state?: string;
  }) {
    try {
      const response = await apiMethods().register(data);
      return { success: true, id: response.id };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Registration failed. Please try again.";
      return { success: false, error: message };
    }
  }

  async function logout() {
    try {
      await apiMethods().logout();
    } catch {
      // Proceed with local cleanup even if the API call fails.
    } finally {
      await AsyncStorage.removeItem("tailorbook_token");
      setUser(null);
    }
  }

  async function updateProfile(
    data: Partial<Pick<ApiUser, "name" | "email" | "mobile" | "shopName" | "shopAddress" | "city" | "state" | "avatarUri">>
  ) {
    try {
      const updated = await apiMethods().updateMe(data);
      setUser(updated);
      return { success: true };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update profile. Please try again.";
      return { success: false, error: message };
    }
  }

  async function refreshUser() {
    try {
      const currentUser = await apiMethods().me();
      setUser(currentUser);
    } catch {
      // If the token is invalid, clear local state.
      await AsyncStorage.removeItem("tailorbook_token");
      setUser(null);
    }
  }

  // Admin operations

  async function listUsers() {
    return apiMethods().listUsers();
  }

  async function getAllTailors() {
    return apiMethods().listUsers();
  }

  async function getPendingUsers() {
    return apiMethods().listPendingUsers();
  }

  async function approveUser(userId: string) {
    await apiMethods().approveUser(userId);
  }

  async function rejectUser(userId: string) {
    await apiMethods().rejectUser(userId);
  }

  async function updateUser(userId: string, data: Record<string, unknown>) {
    await apiMethods().updateUser(userId, data);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isInitialized,
        login,
        register,
        logout,
        updateProfile,
        refreshUser,
        listUsers,
        getAllTailors,
        getPendingUsers,
        approveUser,
        rejectUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
