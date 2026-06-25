import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import type { User } from "@/types";

/**
 * Guard the admin dashboard route group. Redirects:
 *  - not logged in            → /(auth)/login
 *  - logged in but not admin  → /
 * Returns `ready: true` once the user is confirmed to be an admin; render
 * a loader while `ready: false`.
 */
export function useAdminGuard(): { user: User | null; ready: boolean } {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }
    if (user.role !== "admin") {
      router.replace("/");
    }
  }, [user, isLoading, router]);

  return {
    user,
    ready: !isLoading && user?.role === "admin",
  };
}
