import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Button, Input } from "@/components/ui";
import colors from "@/constants/colors";

export default function LoginScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [emailOrMobile, setEmailOrMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  async function handleLogin() {
    const newErrors: typeof errors = {};
    if (!emailOrMobile.trim()) newErrors.email = "Email or mobile is required";
    if (!password.trim()) newErrors.password = "Password is required";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setLoading(true);
    const result = await login(emailOrMobile.trim(), password);
    setLoading(false);
    if (!result.success) {
      Alert.alert("Login Failed", result.error ?? "Something went wrong");
    } else {
      router.replace("/(tabs)");
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={{ alignItems: "center", paddingTop: 40, paddingBottom: 36 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              backgroundColor: c.primary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              shadowColor: c.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Image
              source={require("@/assets/images/icon.png")}
              style={{ width: 52, height: 52, borderRadius: 12 }}
            />
          </View>
          <Text style={{ fontSize: 26, fontFamily: "Inter_700Bold", color: c.foreground }}>
            Tailor Book
          </Text>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 4 }}>
            Professional tailoring management
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: 14 }}>
          <Input
            label="Email or Mobile"
            placeholder="Enter email or mobile number"
            value={emailOrMobile}
            onChangeText={setEmailOrMobile}
            icon="alternate-email"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <Input
            label="Password"
            placeholder="Enter password"
            value={password}
            onChangeText={setPassword}
            icon="lock"
            secureTextEntry={!showPassword}
            error={errors.password}
            rightElement={
              <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.primary }}>
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </Pressable>
            }
          />

          <Button
            label="Sign In"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
            style={{ marginTop: 6 }}
          />
        </View>

        {/* Admin hint */}
        <View
          style={{
            marginTop: 20,
            padding: 14,
            backgroundColor: c.muted,
            borderRadius: colors.radius,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.mutedForeground, textAlign: "center" }}>
            Admin: admin@tailorbook.com / admin123
          </Text>
        </View>

        {/* Register link */}
        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 28, gap: 4 }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
            New tailor?
          </Text>
          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.primary }}>
              Register here
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
