import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  ensureAdminExists,
  generateId,
  getCurrentUser,
  getUsers,
  saveUsers,
  setCurrentUser,
} from "@/utils/storage";
import { Speciality, User, UserRole } from "@/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (emailOrMobile: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateOnboardingComplete: () => Promise<void>;
  updateProfile: (data: Partial<Pick<User, "name" | "email" | "mobile" | "shopName" | "shopAddress" | "city" | "state">>) => Promise<void>;
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  getPendingUsers: () => Promise<User[]>;
  getAllTailors: () => Promise<User[]>;
}

export interface RegisterData {
  name: string;
  email: string;
  mobile: string;
  password: string;
  speciality: Speciality;
  shopName?: string;
  shopAddress?: string;
  city?: string;
  state?: string;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { init(); }, []);

  async function init() {
    await ensureAdminExists();
    const current = await getCurrentUser();
    setUser(current);
    setIsLoading(false);
  }

  async function login(emailOrMobile: string, password: string) {
    const users = await getUsers();
    const found = users.find(
      (u) =>
        (u.email.toLowerCase() === emailOrMobile.toLowerCase() ||
          u.mobile === emailOrMobile) &&
        u.password === password
    );
    if (!found) return { success: false, error: "Invalid credentials" };
    if (found.status === "pending")
      return { success: false, error: "Your account is pending admin approval" };
    if (found.status === "rejected")
      return { success: false, error: "Your account has been rejected" };
    await setCurrentUser(found);
    setUser(found);
    return { success: true };
  }

  async function register(data: RegisterData) {
    const users = await getUsers();
    const exists = users.some(
      (u) =>
        u.email.toLowerCase() === data.email.toLowerCase() ||
        u.mobile === data.mobile
    );
    if (exists) return { success: false, error: "Email or mobile already registered" };

    const newUser: User = {
      id: generateId(),
      name: data.name,
      email: data.email,
      mobile: data.mobile,
      password: data.password,
      role: "tailor" as UserRole,
      speciality: data.speciality,
      shopName: data.shopName,
      shopAddress: data.shopAddress,
      city: data.city,
      state: data.state,
      status: "pending",
      onboardingComplete: false,
      createdAt: new Date().toISOString(),
    };
    await saveUsers([...users, newUser]);
    return { success: true };
  }

  async function logout() {
    const usersRaw = await AsyncStorage.getItem("@tailorbook/users");
    await AsyncStorage.clear();
    if (usersRaw) {
      await AsyncStorage.setItem("@tailorbook/users", usersRaw);
    }
    setUser(null);
  }

  async function updateOnboardingComplete() {
    if (!user) return;
    const users = await getUsers();
    const updated = users.map((u) =>
      u.id === user.id ? { ...u, onboardingComplete: true } : u
    );
    await saveUsers(updated);
    const updatedUser = { ...user, onboardingComplete: true };
    await setCurrentUser(updatedUser);
    setUser(updatedUser);
  }

  async function updateProfile(data: Partial<Pick<User, "name" | "email" | "mobile" | "shopName" | "shopAddress" | "city" | "state">>) {
    if (!user) return;
    const users = await getUsers();
    const updatedUser = { ...user, ...data };
    await saveUsers(users.map((u) => (u.id === user.id ? updatedUser : u)));
    await setCurrentUser(updatedUser);
    setUser(updatedUser);
  }

  async function approveUser(userId: string) {
    const users = await getUsers();
    await saveUsers(users.map((u) => (u.id === userId ? { ...u, status: "approved" as const } : u)));
  }

  async function rejectUser(userId: string) {
    const users = await getUsers();
    await saveUsers(users.map((u) => (u.id === userId ? { ...u, status: "rejected" as const } : u)));
  }

  async function getPendingUsers() {
    const users = await getUsers();
    return users.filter((u) => u.role === "tailor" && u.status === "pending");
  }

  async function getAllTailors() {
    const users = await getUsers();
    return users.filter((u) => u.role === "tailor");
  }

  return (
    <AuthContext.Provider value={{
      user, isLoading,
      login, register, logout,
      updateOnboardingComplete, updateProfile,
      approveUser, rejectUser,
      getPendingUsers, getAllTailors,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
