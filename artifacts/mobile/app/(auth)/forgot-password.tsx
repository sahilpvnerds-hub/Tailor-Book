import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Button, Input } from "@/components/ui";
import { validateConfirmPassword, validateEmail, validateOtp, validatePassword } from "@/utils/validation";
import { useTranslation } from "@/utils/i18n";

type Step = "email" | "otp" | "newPassword" | "success";

export default function ForgotPasswordScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { forgotPassword, verifyResetOtp, resetPassword } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const emailFromQuery = params.email ? decodeURIComponent(params.email) : "";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(emailFromQuery);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const topPad = Platform.OS === "web" ? 67 : 0;

  // ── Step 1: Send Reset Code ────────────────────────────────────────────────
  async function handleSendCode() {
    const e: Record<string, string> = {};
    const trimmedEmail = email.trim().toLowerCase();
    const emailErr = validateEmail(trimmedEmail);
    if (emailErr) e.email = emailErr;
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const result = await forgotPassword(trimmedEmail);
      setStep("otp");

      // Check if email was actually delivered via SMTP
      if (!result.delivered) {
        setTimeout(() => {
          Alert.alert(
            "Email Delivery Failed",
            "The password reset code could not be sent to your email. This typically happens when:\n\n• Your email provider is blocking our emails\n• Our SMTP server is down\n• Your email address may be incorrect\n\nPlease try a different email address or contact support.",
            [{ text: "OK" }]
          );
        }, 1000);
      }
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Verify OTP ─────────────────────────────────────────────────────
  async function handleVerifyCode() {
    const e: Record<string, string> = {};
    const otpErr = validateOtp(otp.trim());
    if (otpErr) e.otp = otpErr;
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const result = await verifyResetOtp(email.trim().toLowerCase(), otp.trim());
      if (result.success) {
        setStep("newPassword");
      }
    } catch (err) {
      const msg = (err as Error).message;
      if (/Too many attempts/i.test(msg)) {
        setErrors({ otp: t("forgotPassword.tooManyAttempts") });
      } else if (/No active|expired/i.test(msg)) {
        setErrors({ otp: t("forgotPassword.codeExpired") });
      } else {
        setErrors({ otp: t("forgotPassword.invalidCode") });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setResending(true);
    setErrors({});
    try {
      await forgotPassword(email.trim().toLowerCase());
      Alert.alert(
        "Code Resent",
        `A new reset code has been sent to ${email.trim().toLowerCase()}.`
      );
      setOtp("");
    } catch (err) {
      Alert.alert("Resend Failed", (err as Error).message);
    } finally {
      setResending(false);
    }
  }

  // ── Step 3: Set New Password ───────────────────────────────────────────────
  async function handleResetPassword() {
    const e: Record<string, string> = {};
    const pwErr = validatePassword(newPassword);
    if (pwErr) e.newPassword = pwErr;

    const cpErr = validateConfirmPassword(newPassword, confirmPassword);
    if (cpErr) e.confirmPassword = cpErr;
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const result = await resetPassword(
        email.trim().toLowerCase(),
        newPassword
      );
      if (result.success) {
        setStep("success");
      }
    } catch (err) {
      Alert.alert("Reset Failed", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Success ────────────────────────────────────────────────────────────────
  function handleBackToLogin() {
    router.replace("/login");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Render helpers
  // ═══════════════════════════════════════════════════════════════════════════

  const renderEmailStep = () => (
    <>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          backgroundColor: c.primary + "18",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <MaterialIcons name="lock-reset" size={36} color={c.primary} />
      </View>

      <Text
        style={{
          fontSize: 24,
          fontFamily: "Inter_700Bold",
          color: c.foreground,
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        {t("forgotPassword.title")}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontFamily: "Inter_400Regular",
          color: c.mutedForeground,
          marginBottom: 28,
          lineHeight: 20,
          textAlign: "center",
        }}
      >
        {t("forgotPassword.emailPrompt")}
      </Text>

      <Input
        label="Email"
        placeholder={t("forgotPassword.emailPlaceholder")}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setErrors((e) => ({ ...e, email: undefined }));
        }}
        icon="email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoFocus
        error={errors.email}
      />

      <Button
        label={loading ? t("forgotPassword.sending") : t("forgotPassword.sendCode")}
        onPress={handleSendCode}
        loading={loading}
        fullWidth
        size="lg"
        style={{ marginTop: 20 }}
        icon="send"
      />
    </>
  );

  const renderOtpStep = () => (
    <>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          backgroundColor: c.primary + "18",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <MaterialIcons name="pin" size={36} color={c.primary} />
      </View>

      <Text
        style={{
          fontSize: 24,
          fontFamily: "Inter_700Bold",
          color: c.foreground,
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        {t("forgotPassword.stepOtp")}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontFamily: "Inter_400Regular",
          color: c.mutedForeground,
          marginBottom: 28,
          lineHeight: 20,
          textAlign: "center",
        }}
      >
        {t("forgotPassword.otpPrompt", { email })}
      </Text>

      <Input
        label="Reset Code"
        placeholder={t("forgotPassword.otpPlaceholder")}
        value={otp}
        onChangeText={(v) => {
          setOtp(v.replace(/\D/g, "").slice(0, 6));
          setErrors((e) => ({ ...e, otp: undefined }));
        }}
        keyboardType="number-pad"
        icon="pin"
        autoFocus
        error={errors.otp}
      />

      <Button
        label={loading ? t("forgotPassword.verifying") : t("forgotPassword.verifyCode")}
        onPress={handleVerifyCode}
        loading={loading}
        fullWidth
        size="lg"
        style={{ marginTop: 20 }}
      />

      <Pressable
        onPress={handleResendCode}
        disabled={resending}
        style={{ marginTop: 16, alignItems: "center" }}
      >
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Inter_500Medium",
            color: resending ? c.mutedForeground : c.primary,
          }}
        >
          {resending ? t("forgotPassword.resending") : t("forgotPassword.resendCode")}
        </Text>
      </Pressable>
    </>
  );

  const renderNewPasswordStep = () => (
    <>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          backgroundColor: c.primary + "18",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <MaterialIcons name="vpn-key" size={36} color={c.primary} />
      </View>

      <Text
        style={{
          fontSize: 24,
          fontFamily: "Inter_700Bold",
          color: c.foreground,
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        {t("forgotPassword.stepNewPassword")}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontFamily: "Inter_400Regular",
          color: c.mutedForeground,
          marginBottom: 28,
          lineHeight: 20,
          textAlign: "center",
        }}
      >
        {t("forgotPassword.newPasswordPrompt")}
      </Text>

      <Input
        label={t("forgotPassword.newPassword")}
        placeholder="••••••••"
        value={newPassword}
        onChangeText={(v) => {
          setNewPassword(v);
          setErrors((e) => ({ ...e, newPassword: undefined }));
        }}
        icon="lock"
        secureTextEntry={!showPassword}
        autoFocus
        error={errors.newPassword}
        rightElement={
          <Pressable onPress={() => setShowPassword(!showPassword)} style={{ paddingHorizontal: 4 }}>
            <MaterialIcons
              name={showPassword ? "visibility-off" : "visibility"}
              size={18}
              color={c.mutedForeground}
            />
          </Pressable>
        }
      />

      <Input
        label={t("forgotPassword.confirmPassword")}
        placeholder="••••••••"
        value={confirmPassword}
        onChangeText={(v) => {
          setConfirmPassword(v);
          setErrors((e) => ({ ...e, confirmPassword: undefined }));
        }}
        icon="lock-outline"
        secureTextEntry={!showConfirmPassword}
        error={errors.confirmPassword}
        rightElement={
          <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ paddingHorizontal: 4 }}>
            <MaterialIcons
              name={showConfirmPassword ? "visibility-off" : "visibility"}
              size={18}
              color={c.mutedForeground}
            />
          </Pressable>
        }
      />

      <Button
        label={loading ? t("forgotPassword.resetting") : t("forgotPassword.resetPassword")}
        onPress={handleResetPassword}
        loading={loading}
        fullWidth
        size="lg"
        style={{ marginTop: 20 }}
        icon="check"
      />
    </>
  );

  const renderSuccessStep = () => (
    <View style={{ alignItems: "center", gap: 18, paddingTop: 40 }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 32,
          backgroundColor: "#D1FAE5",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name="check-circle" size={64} color="#059669" />
      </View>

      <Text
        style={{
          fontSize: 26,
          fontFamily: "Inter_700Bold",
          color: c.foreground,
          textAlign: "center",
        }}
      >
        {t("forgotPassword.success")}
      </Text>
      <Text
        style={{
          fontSize: 15,
          fontFamily: "Inter_400Regular",
          color: c.mutedForeground,
          textAlign: "center",
          lineHeight: 22,
          paddingHorizontal: 16,
        }}
      >
        {t("forgotPassword.successMessage")}
      </Text>

      <Button
        label={t("forgotPassword.backToLogin")}
        onPress={handleBackToLogin}
        fullWidth
        size="lg"
        icon="login"
        style={{ marginTop: 24, width: "100%" }}
      />
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Main render — single back button in the wrapper only
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: topPad + 40,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === "success" ? (
          renderSuccessStep()
        ) : (
          <>
            {/* Single back button — handles all step transitions */}
            <Pressable
              onPress={() => {
                if (step === "email") {
                  router.replace("/login");
                } else if (step === "otp") {
                  setStep("email");
                  setErrors({});
                  setOtp("");
                } else if (step === "newPassword") {
                  setStep("otp");
                  setErrors({});
                  setNewPassword("");
                  setConfirmPassword("");
                }
              }}
              style={{ marginBottom: 28, flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <MaterialIcons name="arrow-back" size={20} color={c.foreground} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: c.foreground }}>
                {t("common.back")}
              </Text>
            </Pressable>

            {step === "email" && renderEmailStep()}
            {step === "otp" && renderOtpStep()}
            {step === "newPassword" && renderNewPasswordStep()}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
