import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { View, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function Index() {
  const { user, isLoading } = useAuth();
  const c = useColors();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;

  // Admins go straight to the desktop-style admin dashboard.
  if (user.role === "admin") {
    return <Redirect href={"/admin" as any} />;
  }

  // Show onboarding for tailors who haven't completed it
  if (user.role === "tailor" && !user.onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
