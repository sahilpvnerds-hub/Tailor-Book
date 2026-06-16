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
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { Button, Input } from "@/components/ui";
import { Gender } from "@/types";
import { validateMobile, validateRequired, runValidation } from "@/utils/validation";
import colors from "@/constants/colors";

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: "male", label: "Male", icon: "man" },
  { value: "female", label: "Female", icon: "woman" },
  { value: "unisex", label: "Unisex", icon: "people" },
];

export default function NewCustomerScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { addCustomer } = useData();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSave() {
    const errs = runValidation([
      { field: "name", error: validateRequired(name, "Full name") },
      { field: "mobile", error: validateMobile(mobile) },
    ]);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    const customer = await addCustomer({ name: name.trim(), mobile: mobile.trim(), gender });
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/customers/${customer.id}` as any);
  }

  const topPad = Platform.OS === "web" ? 67 : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + topPad + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: c.card,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ backgroundColor: c.muted, borderRadius: 10, padding: 8 }}
        >
          <MaterialIcons name="arrow-back" size={20} color={c.foreground} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
          New Customer
        </Text>
        <Button label="Save" onPress={handleSave} loading={loading} size="sm" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 50 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Input
          label="Full Name *"
          placeholder="Enter customer's full name"
          value={name}
          onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: undefined as any })); }}
          icon="person"
          error={errors.name}
          autoFocus
        />

        <Input
          label="Mobile Number * (10 digits)"
          placeholder="Enter 10-digit mobile"
          value={mobile}
          onChangeText={(v) => {
            setMobile(v.replace(/\D/g, "").slice(0, 10));
            setErrors((e) => ({ ...e, mobile: undefined as any }));
          }}
          icon="phone"
          keyboardType="phone-pad"
          error={errors.mobile}
        />

        {/* Gender */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Gender *
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {GENDER_OPTIONS.map((opt) => {
              const selected = gender === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setGender(opt.value)}
                  style={{
                    flex: 1,
                    padding: 14,
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
