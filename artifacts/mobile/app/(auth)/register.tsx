import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Button, Input } from "@/components/ui";
import { Speciality, PreferredLanguage } from "@/types";
import {
  runValidation,
  validateConfirmPassword,
  validateEmail,
  validateMobile,
  validateOtp,
  validatePassword,
  validateRequired,
} from "@/utils/validation";
import {
  api,
  clearOtpPending,
  getOtpPending,
  setOtpPending,
} from "@/utils/api";
import {
  i18n,
  SUPPORTED_LANGUAGES,
  useTranslation,
} from "@/utils/i18n";
import { requestAndGetCoords } from "@/utils/location";
import { reverseGeocode } from "@/utils/geocode";
import colors from "@/constants/colors";

type Step = "form" | "otp" | "success";

const SPECIALITY_OPTIONS: { value: Speciality; icon: string; key: "male" | "female" | "unisex" }[] = [
  { value: "male", icon: "man", key: "male" },
  { value: "female", icon: "woman", key: "female" },
  { value: "unisex", icon: "people", key: "unisex" },
];

export default function RegisterScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { register } = useAuth();
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [addressDetected, setAddressDetected] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const shopAddressRef = useRef<TextInput>(null);

  const [form, setForm] = useState<{
    name: string;
    email: string;
    mobile: string;
    password: string;
    confirmPassword: string;
    speciality: Speciality;
    shopName: string;
    shopAddress: string;
    city: string;
    state: string;
    preferredLanguage: PreferredLanguage;
    latitude: number | null;
    longitude: number | null;
  }>({
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    speciality: "unisex",
    shopName: "",
    shopAddress: "",
    city: "",
    state: "",
    preferredLanguage: "en",
    latitude: null,
    longitude: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Restore any in-flight OTP + form data from a previous session so a
  // reload / app backgrounding doesn't lose progress.
  useEffect(() => {
    (async () => {
      const pending = await getOtpPending();
      if (!pending) return;
      if (Date.now() > pending.expiresAt) {
        await clearOtpPending();
        return;
      }
      setForm((f) => ({
        ...f,
        name: pending.formData.name ?? f.name,
        email: pending.formData.email ?? f.email,
        mobile: pending.formData.mobile ?? f.mobile,
        speciality: (pending.formData.speciality as Speciality) ?? f.speciality,
        shopName: pending.formData.shopName ?? f.shopName,
        shopAddress: pending.formData.shopAddress ?? f.shopAddress,
        city: pending.formData.city ?? f.city,
        state: pending.formData.state ?? f.state,
        preferredLanguage: (pending.formData.preferredLanguage as PreferredLanguage) ?? f.preferredLanguage,
      }));
      setOtpExpiresAt(pending.expiresAt);
      // Start with a clean OTP input so any value from a prior session
      // doesn't carry over.
      setEnteredOtp("");
      setOtpError("");
      setStep("otp");
    })();
  }, []);

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
      {
        field: "confirmPassword",
        error: validateConfirmPassword(form.password, form.confirmPassword),
      },
    ]);
  }

  function snapshotFormData() {
    return {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      mobile: form.mobile.trim(),
      speciality: form.speciality,
      shopName: form.shopName.trim(),
      shopAddress: form.shopAddress.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      preferredLanguage: form.preferredLanguage,
    };
  }

  /**
   * Fired when the user taps the explicit "Use my location" button. We
   * ask for GPS permission, read the coordinates, then reverse-geocode
   * via OpenStreetMap Nominatim (no API key, no IP-based guess) to fill
   * the address, city, and state automatically.
   *
   * The button can be tapped again to re-detect if the user has moved
   * to a new address or the first attempt failed.
   */
  async function handleFetchLocation() {
    setFetchingAddress(true);
    try {
      const coords = await requestAndGetCoords();
      if (!coords) return;
      const result = await reverseGeocode(coords.latitude, coords.longitude);
      if (result) {
        setForm((f) => ({
          ...f,
          shopAddress:
            [result.houseNumber, result.road, result.neighbourhood]
              .filter(Boolean)
              .join(", ") || f.shopAddress,
          city: result.city || f.city,
          state: result.state || f.state,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }));
        setAddressDetected(true);
      } else {
        // Permission was granted but the network lookup failed — still
        // remember we tried so we don't keep re-asking. Save the raw
        // coords so the user can refine the address manually.
        setForm((f) => ({
          ...f,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }));
      }
    } finally {
      setFetchingAddress(false);
    }
  }

  async function handleSendOtp() {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();
      const mobile = form.mobile.trim();
      // Pre-check: don't waste the user's time sending an OTP if the
      // account already exists with this email or mobile. Server still
      // re-checks at /register as the source of truth.
      try {
        const check = await api.auth.checkAvailability({ email, mobile });
        if (!check.available) {
          setLoading(false);
          const fieldErrors: Record<string, string> = {};
          for (const f of check.conflicts ?? []) {
            fieldErrors[f] =
              f === "email"
                ? "An account with this email already exists"
                : "An account with this mobile already exists";
          }
          setErrors(fieldErrors);
          Alert.alert(
            "Already registered",
            check.message ?? "An account with these details already exists",
            [
              { text: "Log in", onPress: () => router.replace("/login") },
              { text: "Use a different email", style: "cancel" },
            ],
          );
          return;
        }
      } catch (checkErr) {
        // Check endpoint unavailable — fall through, server will still
        // reject at /register if the account already exists.
        console.warn("[register] availability check failed:", checkErr);
      }
      await api.auth.sendOtp(email);
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min — matches server
      setOtpExpiresAt(expiresAt);
      await setOtpPending({
        email,
        otp: "", // server holds the OTP; we only cache expiry + form
        expiresAt,
        formData: snapshotFormData() as any,
      });
      // Reset any previously entered OTP in case the user is re-entering
      // this step from the form.
      setEnteredOtp("");
      setOtpError("");
      setStep("otp");
      // Email is sent by the server via SMTP. The user must check their
      // inbox for the 6-digit code.
    } catch (err) {
      Alert.alert("Could Not Send OTP", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setResending(true);
    try {
      const email = form.email.trim().toLowerCase();
      await api.auth.sendOtp(email);
      const expiresAt = Date.now() + 10 * 60 * 1000;
      setOtpExpiresAt(expiresAt);
      await setOtpPending({
        email,
        otp: "",
        expiresAt,
        formData: snapshotFormData() as any,
      });
      Alert.alert("OTP Resent", `A new OTP was sent to ${email}.`);
      setEnteredOtp("");
      setOtpError("");
    } catch (err) {
      Alert.alert("Resend Failed", (err as Error).message);
    } finally {
      setResending(false);
    }
  }

  async function handleVerifyAndRegister() {
    const otpErr = validateOtp(enteredOtp.trim());
    if (otpErr) {
      setOtpError(otpErr);
      return;
    }
    if (Date.now() > otpExpiresAt) {
      setOtpError("OTP has expired. Please request a new one.");
      return;
    }
    setOtpError("");
    setLoading(true);
    const email = form.email.trim().toLowerCase();

    let verifiedAt: string;
    try {
      const verify = await api.auth.verifyOtp(email, enteredOtp.trim());
      verifiedAt = verify.emailVerifiedAt;
    } catch (err) {
      setLoading(false);
      setOtpError((err as Error).message);
      return;
    }

    const result = await register({
      name: form.name.trim(),
      email,
      mobile: form.mobile.trim(),
      password: form.password,
      speciality: form.speciality,
      shopName: form.shopName.trim() || undefined,
      shopAddress: form.shopAddress.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      emailVerifiedAt: verifiedAt,
      preferredLanguage: form.preferredLanguage,
      latitude: form.latitude ?? undefined,
      longitude: form.longitude ?? undefined,
    });
    setLoading(false);
    if (!result.success) {
      Alert.alert("Registration Failed", result.error);
    } else {
      // Clear the pending OTP so the next reload starts from the form.
      await clearOtpPending();
      // Account is auto-approved — show success and offer to log in.
      setStep("success");
    }
  }

  function handleBackToLogin() {
    // Replace the register screen with the login screen so back button
    // doesn't return here.
    router.replace("/login");
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 12);

  // ── Success Step ────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={{
            flex: 1,
            paddingTop: topPad,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: 24,
            justifyContent: "center",
            alignItems: "center",
            gap: 18,
          }}
        >
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
            {t("register.success")}
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
            {t("register.successMessage")}
          </Text>

          <View
            style={{
              backgroundColor: c.card,
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: c.border,
              padding: 16,
              width: "100%",
              gap: 6,
              marginTop: 6,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_600SemiBold",
                color: c.mutedForeground,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Account
            </Text>
            <Text style={{ fontSize: 15, fontFamily: "Inter_500Medium", color: c.foreground }}>
              {form.name}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
              {form.email}
            </Text>
          </View>

          <Button
            label={t("auth.login")}
            onPress={handleBackToLogin}
            fullWidth
            size="lg"
            icon="login"
            style={{ marginTop: 6 }}
          />
        </View>
      </KeyboardAvoidingView>
    );
  }

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
            onPress={() => {
              // Clear the previously entered OTP so when the user re-enters
              // this step the field is empty and any old error is gone.
              setEnteredOtp("");
              setOtpError("");
              setStep("form");
            }}
            style={{ marginBottom: 28, flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <MaterialIcons name="arrow-back" size={20} color={c.foreground} />
            <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: c.foreground }}>
              {t("common.back")}
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

          <Text
            style={{
              fontSize: 24,
              fontFamily: "Inter_700Bold",
              color: c.foreground,
              marginBottom: 8,
            }}
          >
            {t("register.stepOtp")}
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: "Inter_400Regular",
              color: c.mutedForeground,
              marginBottom: 28,
              lineHeight: 20,
            }}
          >
            {t("register.otpPrompt", { email: form.email })}
          </Text>

          <Input
            label="OTP"
            placeholder="6-digit code"
            value={enteredOtp}
            onChangeText={(v) => {
              setEnteredOtp(v.replace(/\D/g, "").slice(0, 6));
              setOtpError("");
            }}
            keyboardType="number-pad"
            icon="pin"
            error={otpError}
          />

          <Button
            label={t("register.verify")}
            onPress={handleVerifyAndRegister}
            loading={loading}
            fullWidth
            size="lg"
            style={{ marginTop: 20 }}
          />

          <Pressable
            onPress={handleResendOtp}
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
              {resending ? "Sending..." : t("register.resendOtp")}
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
              {t("register.title")}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
              {t("register.stepForm")}
            </Text>
          </View>
        </View>

        <View style={{ gap: 14 }}>
          {/* Preferred Language — at the very top so the rest of the form
              can re-render in the chosen language as the user types. */}
          <View style={{ gap: 6 }}>
            <SectionLabel label={t("register.language")} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              {SUPPORTED_LANGUAGES.map((lng) => {
                const selected = form.preferredLanguage === lng;
                return (
                  <Pressable
                    key={lng}
                    onPress={() => {
                      setForm((f) => ({ ...f, preferredLanguage: lng as PreferredLanguage }));
                      // Switch the UI language immediately so all labels
                      // (including this section title) update.
                      try {
                        i18n.changeLanguage(lng);
                      } catch (err) {
                        console.warn("[register] changeLanguage failed:", err);
                      }
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: colors.radius,
                      borderWidth: 1.5,
                      borderColor: selected ? c.primary : c.border,
                      backgroundColor: selected ? c.primary + "12" : c.card,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: selected ? "Inter_600SemiBold" : "Inter_500Medium",
                        color: selected ? c.primary : c.mutedForeground,
                      }}
                    >
                      {t(`languages.${lng}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Personal Info */}
          <SectionLabel label={t("common.name") + " *"} />

          <Input
            label=""
            placeholder={t("register.name")}
            value={form.name}
            onChangeText={(v) => set("name", v)}
            icon="person"
            error={errors.name}
          />
          <Input
            label=""
            placeholder={t("register.email")}
            value={form.email}
            onChangeText={(v) => set("email", v)}
            icon="email"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <Input
            label=""
            placeholder={t("register.mobile")}
            value={form.mobile}
            onChangeText={(v) => set("mobile", v.replace(/\D/g, "").slice(0, 15))}
            icon="phone"
            keyboardType="phone-pad"
            error={errors.mobile}
          />
          <Input
            label=""
            placeholder={t("register.password")}
            value={form.password}
            onChangeText={(v) => set("password", v)}
            icon="lock"
            secureTextEntry
            error={errors.password}
          />
          <Input
            label=""
            placeholder={t("register.confirmPassword")}
            value={form.confirmPassword}
            onChangeText={(v) => set("confirmPassword", v)}
            icon="lock-outline"
            secureTextEntry
            error={errors.confirmPassword}
          />

          {/* Speciality */}
          <View style={{ gap: 6, marginTop: 4 }}>
            <SectionLabel label={t("register.speciality") + " *"} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              {SPECIALITY_OPTIONS.map((opt) => {
                const selected = form.speciality === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setForm((f) => ({ ...f, speciality: opt.value }))}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
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
                      size={24}
                      color={selected ? c.primary : c.mutedForeground}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular",
                        color: selected ? c.primary : c.mutedForeground,
                      }}
                    >
                      {t(`register.specialities.${opt.key}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Shop Info (Optional) */}
          <SectionLabel label={t("profile.shopName")} style={{ marginTop: 8 }} />

          <Input
            label=""
            placeholder={t("register.shopName")}
            value={form.shopName}
            onChangeText={(v) => set("shopName", v)}
            icon="storefront"
          />
          <View>
            <Input
              label=""
              placeholder={t("register.shopAddress")}
              value={form.shopAddress}
              onChangeText={(v) => set("shopAddress", v)}
              ref={shopAddressRef}
              icon="location-on"
              multiline
            />
            <Pressable
              onPress={handleFetchLocation}
              disabled={fetchingAddress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 8,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: addressDetected ? c.primary + "10" : c.muted,
                borderWidth: 1,
                borderColor: addressDetected ? c.primary : c.border,
              }}
            >
              {fetchingAddress ? (
                <ActivityIndicator size="small" color={c.primary} />
              ) : (
                <MaterialIcons
                  name={addressDetected ? "refresh" : "my-location"}
                  size={16}
                  color={addressDetected ? c.primary : c.foreground}
                />
              )}
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_600SemiBold",
                  color: addressDetected ? c.primary : c.foreground,
                }}
              >
                {fetchingAddress
                  ? t("register.fetchingLocation")
                  : addressDetected
                    ? t("register.refetchLocation")
                    : t("register.useMyLocation")}
              </Text>
              {addressDetected && !fetchingAddress ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: "#D1FAE5",
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                    marginLeft: 4,
                  }}
                >
                  <MaterialIcons name="check-circle" size={11} color="#059669" />
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: "Inter_600SemiBold",
                      color: "#059669",
                    }}
                  >
                    GPS
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Input
              label=""
              placeholder={t("register.city")}
              value={form.city}
              onChangeText={(v) => set("city", v)}
              containerStyle={{ flex: 1 }}
            />
            <Input
              label=""
              placeholder={t("register.state")}
              value={form.state}
              onChangeText={(v) => set("state", v)}
              containerStyle={{ flex: 1 }}
            />
          </View>

          {/* Use my location — removed. Address now auto-fills on focus. */}

          <Button
            label={t("common.next")}
            onPress={handleSendOtp}
            loading={loading}
            fullWidth
            size="lg"
            style={{ marginTop: 8 }}
            icon="send"
          />

          <View
            style={{
              padding: 14,
              backgroundColor: "#EFF6FF",
              borderRadius: colors.radius,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <MaterialIcons name="info" size={16} color="#1E40AF" style={{ marginTop: 1 }} />
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                fontFamily: "Inter_400Regular",
                color: "#1E40AF",
              }}
            >
              We'll send a 6-digit code to verify your email. Once verified you can log in immediately.
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
