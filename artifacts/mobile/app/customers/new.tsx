import React, { useState } from "react";
import {
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
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { Button, Input } from "@/components/ui";
import { validateMobile, validateRequired, runValidation } from "@/utils/validation";

export default function NewCustomerScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { addCustomer } = useData();
  const params = useLocalSearchParams<{ q?: string; returnTo?: string }>();
  const [loading, setLoading] = useState(false);
  // If the home-page or order-page search sent a query, prefill either
  // the name or mobile field based on whether the query looks like digits.
  const prefill = typeof params.q === "string" ? params.q : "";
  const prefillIsMobile = /^\+?[\d\s\-()]+$/.test(prefill);
  const [name, setName] = useState(prefillIsMobile ? "" : prefill);
  const [mobile, setMobile] = useState(prefillIsMobile ? prefill : "");
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
    const customer = await addCustomer({ name: name.trim(), mobile: mobile.trim(), gender: "unisex" });
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // If the user came from the order page, route back to the order page
    // with the newly-created customer pre-selected, so the order entry
    // flow continues seamlessly. Otherwise go to the customer detail page
    // (the original /customers tab flow).
    if (params.returnTo === "order") {
      router.replace({ pathname: "/orders/new", params: { customerId: customer.id } } as any);
    } else {
      router.replace(`/customers/${customer.id}` as any);
    }
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
          onChangeText={(v) => { setName(v.slice(0, 80)); setErrors((e) => ({ ...e, name: undefined as any })); }}
          icon="person"
          error={errors.name}
          autoFocus
          maxLength={80}
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
          maxLength={10}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
