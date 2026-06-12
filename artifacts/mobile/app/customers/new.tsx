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
import { useData } from "@/context/DataContext";
import { Button, Input } from "@/components/ui";

export default function NewCustomerScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { addCustomer } = useData();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", email: "", address: "", notes: "" });
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSave() {
    const e: Partial<typeof form> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.mobile.trim()) e.mobile = "Mobile is required";
    if (form.mobile.length < 10) e.mobile = "Enter valid mobile";
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setLoading(true);
    const customer = await addCustomer({
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
    });
    setLoading(false);
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
          gap: 14,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ backgroundColor: c.muted, borderRadius: 10, padding: 8 }}>
          <MaterialIcons name="arrow-back" size={20} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: c.foreground }}>New Customer</Text>
        </View>
        <Button label="Save" onPress={handleSave} loading={loading} size="sm" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Input
          label="Customer Name *"
          placeholder="Full name"
          value={form.name}
          onChangeText={(v) => set("name", v)}
          icon="person"
          error={errors.name}
        />
        <Input
          label="Mobile Number *"
          placeholder="10-digit mobile"
          value={form.mobile}
          onChangeText={(v) => set("mobile", v)}
          icon="phone"
          keyboardType="phone-pad"
          error={errors.mobile}
        />
        <Input
          label="Email Address"
          placeholder="Optional"
          value={form.email}
          onChangeText={(v) => set("email", v)}
          icon="email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label="Address"
          placeholder="Shop / home address"
          value={form.address}
          onChangeText={(v) => set("address", v)}
          icon="location-on"
          multiline
        />
        <Input
          label="Notes"
          placeholder="Any special notes..."
          value={form.notes}
          onChangeText={(v) => set("notes", v)}
          icon="notes"
          multiline
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
