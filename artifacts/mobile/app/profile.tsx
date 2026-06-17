import React, { useEffect, useState } from "react";
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
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Button, Card, Input } from "@/components/ui";
import colors from "@/constants/colors";
import { Speciality } from "@/types";

type Field = "name" | "email" | "mobile" | "shopName" | "shopAddress" | "city" | "state";

// ── Validation helpers ─────────────────────────────────────────────────────
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
function isValidMobile(mobile: string): boolean {
  return /^\+?[\d\s\-]{7,15}$/.test(mobile.trim());
}

// ── Screen ─────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // speciality — local state used while editing
  const [speciality, setSpeciality] = useState<Speciality | "">(user?.speciality ?? "");
  // displaySpeciality — what is shown in VIEW mode; updated immediately on save
  // so the UI never lags behind the async context propagation
  const [displaySpeciality, setDisplaySpeciality] = useState<Speciality | "">(user?.speciality ?? "");
  const [form, setForm] = useState<Record<Field, string>>({
    name: user?.name ?? "",
    email: user?.email ?? "",
    mobile: user?.mobile ?? "",
    shopName: user?.shopName ?? "",
    shopAddress: user?.shopAddress ?? "",
    city: user?.city ?? "",
    state: user?.state ?? "",
  });

  // Re-sync form whenever user object is updated from server/cache
  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name ?? "",
      email: user.email ?? "",
      mobile: user.mobile ?? "",
      shopName: user.shopName ?? "",
      shopAddress: user.shopAddress ?? "",
      city: user.city ?? "",
      state: user.state ?? "",
    });
    setSpeciality(user.speciality ?? "");
    setDisplaySpeciality(user.speciality ?? "");
  }, [user?.id, user?.name, user?.email, user?.mobile, user?.shopName, user?.shopAddress, user?.city, user?.state, user?.speciality]);

  if (!user) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>Not signed in</Text>
      </View>
    );
  }

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const topPad = Platform.OS === "web" ? 67 : 0;

  function startEdit() {
    setForm({
      name: user!.name ?? "",
      email: user!.email ?? "",
      mobile: user!.mobile ?? "",
      shopName: user!.shopName ?? "",
      shopAddress: user!.shopAddress ?? "",
      city: user!.city ?? "",
      state: user!.state ?? "",
    });
    setSpeciality(user!.speciality ?? "");
    setSaveSuccess(false);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveSuccess(false);
  }

  async function saveEdit() {
    // ── Validation ─────────────────────────────────────────────────────
    if (!form.name.trim()) {
      Alert.alert("Validation Error", "Name is required.");
      return;
    }
    if (!form.email.trim() || !isValidEmail(form.email)) {
      Alert.alert("Validation Error", "Please enter a valid email address.");
      return;
    }
    if (!form.mobile.trim() || !isValidMobile(form.mobile)) {
      Alert.alert("Validation Error", "Please enter a valid mobile number.");
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        mobile: form.mobile.trim(),
        shopName: form.shopName.trim(),
        shopAddress: form.shopAddress.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        speciality: speciality || undefined,
      });
      const savedSpeciality = speciality;
      setSaveSuccess(true);
      // Immediately reflect the saved speciality in VIEW mode — don't wait
      // for the async AuthContext → useEffect chain to propagate
      setDisplaySpeciality(savedSpeciality);
      setEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Auto-hide success banner
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      Alert.alert(
        "Update Failed",
        err?.message ?? "Could not save your profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  type Row = {
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
    field?: Field;
    value: string;
    keyboardType?: "default" | "email-address" | "phone-pad";
    autoCapitalize?: "none" | "sentences";
  };

  const rows: Row[] = [
    { icon: "person", label: "Full Name *", field: "name", value: form.name },
    { icon: "email", label: "Email *", field: "email", value: form.email, keyboardType: "email-address", autoCapitalize: "none" },
    { icon: "phone", label: "Mobile *", field: "mobile", value: form.mobile, keyboardType: "phone-pad" },
    { icon: "badge", label: "Role", value: user.role === "admin" ? "Admin" : "Tailor" },
    { icon: "storefront", label: "Shop Name", field: "shopName", value: form.shopName },
    { icon: "location-on", label: "Address", field: "shopAddress", value: form.shopAddress },
    { icon: "location-city", label: "City", field: "city", value: form.city },
    { icon: "map", label: "State", field: "state", value: form.state },
  ];

  const SPECIALITIES: { label: string; value: Speciality }[] = [
    { label: "Male", value: "male" },
    { label: "Female", value: "female" },
    { label: "Unisex", value: "unisex" },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ── Header ── */}
      <View
        style={{
          paddingTop: insets.top + topPad + 16,
          paddingHorizontal: 20,
          paddingBottom: 24,
          backgroundColor: c.primary,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 8 }}
          >
            <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" }}>
            Profile
          </Text>
          {!editing ? (
            <Pressable
              onPress={startEdit}
              style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 8, flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <MaterialIcons name="edit" size={18} color="#FFFFFF" />
            </Pressable>
          ) : (
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pressable
                onPress={cancelEdit}
                style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 10, padding: 8 }}
              >
                <MaterialIcons name="close" size={18} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={saveEdit}
                style={{ backgroundColor: "#FFFFFF", borderRadius: 10, padding: 8 }}
              >
                <MaterialIcons name="check" size={18} color={c.primary} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Avatar */}
        <View style={{ alignItems: "center", gap: 10 }}>
          <View pointerEvents="none">
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: "rgba(255,255,255,0.2)",
                borderWidth: 2,
                borderColor: "rgba(255,255,255,0.35)",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {user.avatarUri ? (
                <Image
                  source={{ uri: user.avatarUri }}
                  style={{ width: 88, height: 88, borderRadius: 44 }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ fontSize: 32, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
                  {initials}
                </Text>
              )}
            </View>
          </View>
          <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFFFFF", marginTop: 4 }}>
            {user.name}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" }}>
            {user.role === "admin" ? "Administrator" : user.shopName ?? "Tailor"}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Success banner ── */}
        {saveSuccess && (
          <View
            style={{
              backgroundColor: "#D1FAE5",
              borderRadius: colors.radius,
              padding: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: "#6EE7B7",
            }}
          >
            <MaterialIcons name="check-circle" size={18} color="#059669" />
            <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#059669" }}>
              Profile updated successfully!
            </Text>
          </View>
        )}

        {/* ── Main fields card ── */}
        <Card style={{ gap: 4 }}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Inter_600SemiBold",
              color: c.mutedForeground,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            General Details
          </Text>
          {rows.map((row, idx) => (
            <React.Fragment key={row.label}>
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  alignItems: editing && row.field ? "flex-start" : "center",
                  paddingVertical: 10,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: c.muted,
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: editing && row.field ? 6 : 0,
                  }}
                >
                  <MaterialIcons name={row.icon} size={16} color={c.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Inter_500Medium",
                      color: c.mutedForeground,
                      marginBottom: editing && row.field ? 4 : 2,
                    }}
                  >
                    {row.label}
                  </Text>
                  {editing && row.field ? (
                    <Input
                      value={form[row.field]}
                      onChangeText={(v) => setForm((f) => ({ ...f, [row.field as Field]: v }))}
                      placeholder={row.label.replace(" *", "")}
                      containerStyle={{ marginTop: 0 }}
                      keyboardType={row.keyboardType ?? "default"}
                      autoCapitalize={row.autoCapitalize ?? "sentences"}
                    />
                  ) : (
                    <Text style={{ fontSize: 15, fontFamily: "Inter_500Medium", color: c.foreground }}>
                      {row.value || "—"}
                    </Text>
                  )}
                </View>
              </View>
              {idx < rows.length - 1 && (
                <View style={{ height: 1, backgroundColor: c.border, marginLeft: 44 }} />
              )}
            </React.Fragment>
          ))}
        </Card>

        {/* ── Speciality (tailor only) ── */}
        {user.role === "tailor" && (
          <Card style={{ gap: 10 }}>
            {/* Section header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_600SemiBold",
                  color: c.mutedForeground,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Speciality
              </Text>
              {!editing && displaySpeciality && (
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                  Tap ✏️ Edit to change
                </Text>
              )}
            </View>

            {/* VIEW mode — large highlighted badge for the active speciality */}
            {!editing && (
              <>
                {displaySpeciality ? (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {SPECIALITIES.map((s) => {
                      const active = displaySpeciality === s.value;
                      const bgMap: Record<string, string> = {
                        male: "#DBEAFE",
                        female: "#FCE7F3",
                        unisex: "#D1FAE5",
                      };
                      const fgMap: Record<string, string> = {
                        male: "#1D4ED8",
                        female: "#9D174D",
                        unisex: "#065F46",
                      };
                      const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
                        male: "male",
                        female: "female",
                        unisex: "people",
                      };
                      return (
                        <View
                          key={s.value}
                          style={{
                            flex: 1,
                            paddingVertical: 12,
                            borderRadius: colors.radius,
                            backgroundColor: active ? bgMap[s.value] : c.muted,
                            alignItems: "center",
                            borderWidth: active ? 1.5 : 1,
                            borderColor: active ? fgMap[s.value] + "60" : c.border,
                            gap: 4,
                          }}
                        >
                          <MaterialIcons
                            name={iconMap[s.value]}
                            size={20}
                            color={active ? fgMap[s.value] : c.mutedForeground}
                          />
                          <Text
                            style={{
                              fontSize: 13,
                              fontFamily: active ? "Inter_700Bold" : "Inter_400Regular",
                              color: active ? fgMap[s.value] : c.mutedForeground,
                            }}
                          >
                            {s.label}
                          </Text>
                          {active && (
                            <View
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: fgMap[s.value],
                                marginTop: 2,
                              }}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View
                    style={{
                      padding: 14,
                      backgroundColor: c.muted,
                      borderRadius: colors.radius,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      borderWidth: 1,
                      borderColor: c.border,
                      borderStyle: "dashed",
                    }}
                  >
                    <MaterialIcons name="info-outline" size={16} color={c.mutedForeground} />
                    <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                      No speciality set. Tap Edit to add one.
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* EDIT mode — all 3 chips, pre-selected value highlighted with checkmark */}
            {editing && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {SPECIALITIES.map((s) => {
                  const isSelected = speciality === s.value;
                  const colorMap: Record<string, string> = {
                    male: "#2563EB",
                    female: "#DB2777",
                    unisex: "#059669",
                  };
                  const accent = colorMap[s.value];
                  return (
                    <Pressable
                      key={s.value}
                      onPress={() => setSpeciality(s.value)}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: colors.radius,
                        backgroundColor: isSelected ? accent + "15" : c.muted,
                        alignItems: "center",
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? accent : c.border,
                        gap: 4,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      {isSelected && (
                        <MaterialIcons name="check-circle" size={16} color={accent} style={{ position: "absolute", top: 6, right: 6 } as any} />
                      )}
                      <MaterialIcons
                        name={s.value === "male" ? "male" : s.value === "female" ? "female" : "people"}
                        size={22}
                        color={isSelected ? accent : c.mutedForeground}
                      />
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: isSelected ? "Inter_700Bold" : "Inter_500Medium",
                          color: isSelected ? accent : c.mutedForeground,
                        }}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>
        )}


        {/* ── Save button ── */}
        {editing && (
          <Button
            label="Save Changes"
            onPress={saveEdit}
            loading={saving}
            fullWidth
            size="lg"
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
