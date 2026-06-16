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
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Button, Input } from "@/components/ui";
import { Speciality } from "@/types";
import {
  runValidation,
  validateConfirmPassword,
  validateEmail,
  validateMobile,
  validatePassword,
  validateRequired,
} from "@/utils/validation";
import colors from "@/constants/colors";

type Step = "form" | "otp";

const SPECIALITY_OPTIONS: { value: Speciality; label: string; icon: string }[] = [
  { value: "male", label: "Male", icon: "man" },
  { value: "female", label: "Female", icon: "woman" },
  { value: "unisex", label: "Unisex", icon: "people" },
];

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function RegisterScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpError, setOtpError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    speciality: "unisex" as Speciality,
    shopName: "",
    shopAddress: "",
    city: "",
    state: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined as any }));
  }

  function validate() {
    return runValidation([
      { field: "name", error: validateRequired(form.name, "Full name") },
      { field: "email", error: validateEmail(form.email) },
      { field: "mobile", error: validateMobile(form.mobile) },
      { field: "password", error: validatePassword(form.password) },
      { field: "confirmPassword", error: validateConfirmPassword(form.password, form.confirmPassword) },
    ]);
  }

  function handleSendOtp() {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    const otp = generateOtp();
    setGeneratedOtp(otp);
    setStep("otp");
    // In production: send email. For demo, show alert.
    setTimeout(() => {
      Alert.alert(
        "OTP Sent (Demo)",
        `Your OTP is: ${otp}\n\nIn production this would be emailed to ${form.email}`,
        [{ text: "OK" }]
      );
    }, 300);
  }

  async function handleVerifyAndRegister() {
    if (enteredOtp.trim() !== generatedOtp) {
      setOtpError("Invalid OTP. Please check and try again.");
      return;
    }
    setOtpError("");
    setLoading(true);
    const result = await register({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      mobile: form.mobile.trim(),
      password: form.password,
      speciality: form.speciality,
      shopName: form.shopName.trim() || undefined,
      shopAddress: form.shopAddress.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
    });
    setLoading(false);
    if (!result.success) {
      Alert.alert("Registration Failed", result.error);
    } else {
      Alert.alert(
        "Registration Submitted",
        "Your account is pending admin approval. You will be notified once approved.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    }
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 12);

  // ── OTP Step ─────────────────────────────────────────────────────────────
  if (step === "otp") {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: topPad,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => setStep("form")}
            style={{ marginBottom: 28, flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <MaterialIcons name="arrow-back" size={20} color={c.foreground} />
            <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: c.foreground }}>
              Back
            </Text>
          </Pressable>

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
            <MaterialIcons name="mark-email-unread" size={36} color={c.primary} />
          </View>

          <Text style={{ fontSize: 24, fontFamily: "Inter_700Bold", color: c.foreground, marginBottom: 8 }}>
            Verify Email
          </Text>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginBottom: 28, lineHeight: 20 }}>
            We sent a 6-digit OTP to{"\n"}
            <Text style={{ fontFamily: "Inter_600SemiBold", color: c.foreground }}>{form.email}</Text>
          </Text>

          <Input
            label="Enter OTP"
            placeholder="6-digit code"
            value={enteredOtp}
            onChangeText={(v) => { setEnteredOtp(v.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
            keyboardType="number-pad"
            icon="pin"
            error={otpError}
          />

          <Button
            label="Verify & Complete Registration"
            onPress={handleVerifyAndRegister}
            loading={loading}
            fullWidth
            size="lg"
            style={{ marginTop: 20 }}
          />

          <Pressable
            onPress={() => {
              const otp = generateOtp();
              setGeneratedOtp(otp);
              Alert.alert("New OTP (Demo)", `Your new OTP is: ${otp}`);
            }}
            style={{ marginTop: 16, alignItems: "center" }}
          >
            <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: c.primary }}>
              Resend OTP
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Registration Form ────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: topPad,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 28, gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ padding: 8, backgroundColor: c.muted, borderRadius: 10 }}
          >
            <MaterialIcons name="arrow-back" size={20} color={c.foreground} />
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: c.foreground }}>
              Tailor Registration
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
              Create your tailor account
            </Text>
          </View>
        </View>

        <View style={{ gap: 14 }}>
          {/* Personal Info */}
          <SectionLabel label="Personal Information" />

          <Input
            label="Full Name *"
            placeholder="Enter your full name"
            value={form.name}
            onChangeText={(v) => set("name", v)}
            icon="person"
            error={errors.name}
          />
          <Input
            label="Email Address *"
            placeholder="Enter email"
            value={form.email}
            onChangeText={(v) => set("email", v)}
            icon="email"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <Input
            label="Mobile Number * (10 digits)"
            placeholder="Enter 10-digit mobile"
            value={form.mobile}
            onChangeText={(v) => set("mobile", v.replace(/\D/g, "").slice(0, 10))}
            icon="phone"
            keyboardType="phone-pad"
            error={errors.mobile}
          />
          <Input
            label="Password *"
            placeholder="Min 8 chars, upper, lower, number, special"
            value={form.password}
            onChangeText={(v) => set("password", v)}
            icon="lock"
            secureTextEntry
            error={errors.password}
          />
          <Input
            label="Confirm Password *"
            placeholder="Re-enter password"
            value={form.confirmPassword}
            onChangeText={(v) => set("confirmPassword", v)}
            icon="lock-outline"
            secureTextEntry
            error={errors.confirmPassword}
          />

          {/* Speciality */}
          <View style={{ gap: 6, marginTop: 4 }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Speciality *
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {SPECIALITY_OPTIONS.map((opt) => {
                const selected = form.speciality === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setForm((f) => ({ ...f, speciality: opt.value }))}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: colors.radius,
                      borderWidth: 1.5,
                      borderColor: selected ? c.primary : c.border,
                      backgroundColor: selected ? c.primary + "12" : c.card,
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <MaterialIcons
                      name={opt.icon as any}
                      size={22}
                      color={selected ? c.primary : c.mutedForeground}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular",
                        color: selected ? c.primary : c.mutedForeground,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Shop Info (Optional) */}
          <SectionLabel label="Shop Information (Optional)" style={{ marginTop: 8 }} />

          <Input
            label="Shop Name"
            placeholder="Enter shop name (optional)"
            value={form.shopName}
            onChangeText={(v) => set("shopName", v)}
            icon="storefront"
          />
          <Input
            label="Shop Address"
            placeholder="Enter shop address"
            value={form.shopAddress}
            onChangeText={(v) => set("shopAddress", v)}
            icon="location-on"
            multiline
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Input
              label="City"
              placeholder="City"
              value={form.city}
              onChangeText={(v) => set("city", v)}
              containerStyle={{ flex: 1 }}
            />
            <Input
              label="State"
              placeholder="State"
              value={form.state}
              onChangeText={(v) => set("state", v)}
              containerStyle={{ flex: 1 }}
            />
          </View>

          <Button
            label="Send OTP & Continue"
            onPress={handleSendOtp}
            fullWidth
            size="lg"
            style={{ marginTop: 8 }}
            icon="send"
          />

          <View
            style={{
              padding: 14,
              backgroundColor: "#FEF3C7",
              borderRadius: colors.radius,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <MaterialIcons name="info" size={16} color="#92400E" style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#92400E" }}>
              An OTP will be sent to verify your email. Your account will then be reviewed by admin before activation.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionLabel({ label, style }: { label: string; style?: any }) {
  const c = useColors();
  return (
    <Text
      style={[
        {
          fontSize: 13,
          fontFamily: "Inter_600SemiBold",
          color: c.mutedForeground,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
        style,
      ]}
    >
      {label}
    </Text>
  );
}
