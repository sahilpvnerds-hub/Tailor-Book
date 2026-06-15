import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
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
    const e: typeof errors = {};
    if (!emailOrMobile.trim()) e.email = "Email or mobile is required";
    if (!password.trim()) e.password = "Password is required";
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setErrors({});
    setLoading(true);
    const result = await login(emailOrMobile.trim(), password);
    setLoading(false);
    if (!result.success) {
      // Make network/server errors more user-friendly
      const raw = result.error ?? "Something went wrong";
      let friendly = raw;
      if (/Network request failed|fetch failed|NetworkError|reach http/i.test(raw)) {
        friendly =
          "Cannot reach the API server.\n\n" +
          "Make sure the backend is running on port 4000:\n" +
          "  cd artifacts/api-server && npm run dev\n\n" +
          "Original: " + raw;
      }
      Alert.alert("Login Failed", friendly);
    } else {
      router.replace("/(tabs)");
    }
  }

  const topPad = Platform.OS === "web" ? 67 : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top teal banner ──────────────────────── */}
        <View
          style={{
            backgroundColor: c.primary,
            paddingTop: insets.top + topPad + 40,
            paddingBottom: 44,
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Icon */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: "rgba(255,255,255,0.18)",
              borderWidth: 2,
              borderColor: "rgba(255,255,255,0.3)",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Image
              source={require("@/assets/images/icon.png")}
              style={{ width: 72, height: 72 }}
              resizeMode="cover"
            />
          </View>

          <View style={{ alignItems: "center", gap: 4 }}>
            <Text
              style={{
                fontSize: 28,
                fontFamily: "Inter_700Bold",
                color: "#FFFFFF",
                letterSpacing: -0.5,
              }}
            >
              Tailor Book
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontFamily: "Inter_400Regular",
                color: "rgba(255,255,255,0.72)",
              }}
            >
              Professional tailoring management
            </Text>
          </View>
        </View>

        {/* ── Form card ────────────────────────────── */}
        <View
          style={{
            flex: 1,
            backgroundColor: c.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            marginTop: -20,
            paddingHorizontal: 24,
            paddingTop: 28,
            paddingBottom: insets.bottom + 32,
            gap: 18,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontFamily: "Inter_700Bold",
              color: c.foreground,
            }}
          >
            Sign in to your account
          </Text>

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
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={{ paddingHorizontal: 4 }}
                >
                  <MaterialIcons
                    name={showPassword ? "visibility-off" : "visibility"}
                    size={18}
                    color={c.mutedForeground}
                  />
                </Pressable>
              }
            />
          </View>

          <Button
            label="Sign In"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
          />

          {/* Admin hint */}
          <View
            style={{
              padding: 14,
              backgroundColor: c.muted,
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: c.border,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <MaterialIcons
              name="admin-panel-settings"
              size={16}
              color={c.mutedForeground}
              style={{ marginTop: 1 }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                fontFamily: "Inter_400Regular",
                color: c.mutedForeground,
              }}
            >
              Admin demo: admin@tailorbook.com{"\n"}Password: admin123
            </Text>
          </View>

          {/* Register */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: "Inter_400Regular",
                color: c.mutedForeground,
              }}
            >
              New tailor?
            </Text>
            <Pressable onPress={() => router.push("/(auth)/register")}>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Inter_700Bold",
                  color: c.primary,
                }}
              >
                Register here
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
