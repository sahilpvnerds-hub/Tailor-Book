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
import colors from "@/constants/colors";

export default function RegisterScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    shopName: "",
    shopAddress: "",
    city: "",
    state: "",
  });
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate() {
    const e: Partial<typeof form> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.email.trim()) e.email = "Required";
    if (!form.mobile.trim()) e.mobile = "Required";
    if (form.mobile.length < 10) e.mobile = "Enter valid mobile number";
    if (!form.password.trim()) e.password = "Required";
    if (form.password.length < 6) e.password = "Min 6 characters";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    if (!form.shopName.trim()) e.shopName = "Required";
    if (!form.city.trim()) e.city = "Required";
    if (!form.state.trim()) e.state = "Required";
    return e;
  }

  async function handleRegister() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setLoading(true);
    const result = await register({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      mobile: form.mobile.trim(),
      password: form.password,
      shopName: form.shopName.trim(),
      shopAddress: form.shopAddress.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 12),
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 12 }}>
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
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Personal Information
          </Text>
          <Input label="Full Name" placeholder="Enter your full name" value={form.name} onChangeText={(v) => set("name", v)} icon="person" error={errors.name} />
          <Input label="Email Address" placeholder="Enter email" value={form.email} onChangeText={(v) => set("email", v)} icon="email" keyboardType="email-address" autoCapitalize="none" error={errors.email} />
          <Input label="Mobile Number" placeholder="Enter 10-digit mobile" value={form.mobile} onChangeText={(v) => set("mobile", v)} icon="phone" keyboardType="phone-pad" error={errors.mobile} />
          <Input label="Password" placeholder="Min 6 characters" value={form.password} onChangeText={(v) => set("password", v)} icon="lock" secureTextEntry error={errors.password} />
          <Input label="Confirm Password" placeholder="Re-enter password" value={form.confirmPassword} onChangeText={(v) => set("confirmPassword", v)} icon="lock-outline" secureTextEntry error={errors.confirmPassword} />

          {/* Shop Info */}
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 }}>
            Shop Information
          </Text>
          <Input label="Shop Name" placeholder="Enter shop name" value={form.shopName} onChangeText={(v) => set("shopName", v)} icon="storefront" error={errors.shopName} />
          <Input label="Shop Address" placeholder="Enter shop address" value={form.shopAddress} onChangeText={(v) => set("shopAddress", v)} icon="location-on" multiline />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Input label="City" placeholder="City" value={form.city} onChangeText={(v) => set("city", v)} containerStyle={{ flex: 1 }} error={errors.city} />
            <Input label="State" placeholder="State" value={form.state} onChangeText={(v) => set("state", v)} containerStyle={{ flex: 1 }} error={errors.state} />
          </View>

          <Button
            label="Submit Registration"
            onPress={handleRegister}
            loading={loading}
            fullWidth
            size="lg"
            style={{ marginTop: 8 }}
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
              Your account will be reviewed by admin before activation.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
