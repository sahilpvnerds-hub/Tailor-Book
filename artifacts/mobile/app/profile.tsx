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
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Button, Card, Input } from "@/components/ui";
import { pickAvatarImage } from "@/components/AvatarPicker";
import colors from "@/constants/colors";

type Field = "name" | "email" | "mobile" | "shopName" | "shopAddress" | "city" | "state";

export default function ProfileScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateProfile, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<Field, string>>({
    name: user?.name ?? "",
    email: user?.email ?? "",
    mobile: user?.mobile ?? "",
    shopName: user?.shopName ?? "",
    shopAddress: user?.shopAddress ?? "",
    city: user?.city ?? "",
    state: user?.state ?? "",
  });

  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.background,
        }}
      >
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
          Not signed in
        </Text>
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

  async function handlePickAvatar() {
    const uri = await pickAvatarImage();
    if (!uri) return;
    const res = await updateProfile({ avatarUri: uri });
    if (!res.success) {
      Alert.alert("Could not save photo", res.error ?? "Unknown error");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

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
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function saveEdit() {
    if (!form.name.trim() || !form.email.trim() || !form.mobile.trim()) {
      Alert.alert("Missing details", "Name, email and mobile are required.");
      return;
    }
    setSaving(true);
    const res = await updateProfile({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      mobile: form.mobile.trim(),
      shopName: form.shopName.trim(),
      shopAddress: form.shopAddress.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
    });
    setSaving(false);
    if (!res.success) {
      Alert.alert("Could not save", res.error ?? "Unknown error");
      return;
    }
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  type Row = {
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
    field?: Field;
    value: string;
  };

  const rows: Row[] = [
    { icon: "person", label: "Full Name", field: "name", value: form.name },
    { icon: "email", label: "Email", field: "email", value: form.email },
    { icon: "phone", label: "Mobile", field: "mobile", value: form.mobile },
    { icon: "badge", label: "Role", value: user.role === "admin" ? "Admin" : "Tailor" },
    { icon: "storefront", label: "Shop Name", field: "shopName", value: form.shopName },
    { icon: "location-on", label: "Address", field: "shopAddress", value: form.shopAddress },
    { icon: "location-city", label: "City", field: "city", value: form.city },
    { icon: "map", label: "State", field: "state", value: form.state },
  ];

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
          paddingBottom: 24,
          backgroundColor: c.primary,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              borderRadius: 10,
              padding: 8,
            }}
          >
            <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <Text
            style={{
              flex: 1,
              fontSize: 18,
              fontFamily: "Inter_600SemiBold",
              color: "#FFFFFF",
            }}
          >
            Profile
          </Text>
          {!editing ? (
            <Pressable
              onPress={startEdit}
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 10,
                padding: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <MaterialIcons name="edit" size={18} color="#FFFFFF" />
            </Pressable>
          ) : (
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pressable
                onPress={cancelEdit}
                style={{
                  backgroundColor: "rgba(255,255,255,0.18)",
                  borderRadius: 10,
                  padding: 8,
                }}
              >
                <MaterialIcons name="close" size={18} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={saveEdit}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 10,
                  padding: 8,
                }}
              >
                <MaterialIcons name="check" size={18} color={c.primary} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Avatar */}
        <View style={{ alignItems: "center", gap: 10 }}>
          <Pressable onPress={handlePickAvatar}>
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
                <Text
                  style={{
                    fontSize: 32,
                    fontFamily: "Inter_700Bold",
                    color: "#FFFFFF",
                  }}
                >
                  {initials}
                </Text>
              )}
            </View>
          </Pressable>
          <Pressable onPress={handlePickAvatar} hitSlop={6}>
            <Text
              style={{
                fontSize: 13,
                fontFamily: "Inter_500Medium",
                color: "#FFFFFF",
                opacity: 0.9,
              }}
            >
              Tap to change photo
            </Text>
          </Pressable>
          <Text
            style={{
              fontSize: 20,
              fontFamily: "Inter_700Bold",
              color: "#FFFFFF",
              marginTop: 4,
            }}
          >
            {user.name}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Inter_400Regular",
              color: "rgba(255,255,255,0.8)",
            }}
          >
            {user.role === "admin" ? "Administrator" : user.shopName}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          gap: 16,
          paddingBottom: insets.bottom + 60,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
                  <MaterialIcons
                    name={row.icon}
                    size={16}
                    color={c.mutedForeground}
                  />
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
                      onChangeText={(v) =>
                        setForm((f) => ({ ...f, [row.field as Field]: v }))
                      }
                      placeholder={row.label}
                      containerStyle={{ marginTop: 0 }}
                    />
                  ) : (
                    <Text
                      style={{
                        fontSize: 15,
                        fontFamily: "Inter_500Medium",
                        color: c.foreground,
                      }}
                    >
                      {row.value || "—"}
                    </Text>
                  )}
                </View>
              </View>
              {idx < rows.length - 1 && (
                <View
                  style={{ height: 1, backgroundColor: c.border, marginLeft: 44 }}
                />
              )}
            </React.Fragment>
          ))}
        </Card>

        {editing && (
          <Button
            label="Save Changes"
            onPress={saveEdit}
            loading={saving}
            fullWidth
            size="lg"
          />
        )}

        {/* Sign Out */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: "#FEE2E2",
            borderRadius: colors.radius,
            paddingVertical: 14,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <MaterialIcons name="logout" size={18} color={c.destructive} />
          <Text
            style={{
              fontSize: 15,
              fontFamily: "Inter_600SemiBold",
              color: c.destructive,
            }}
          >
            Sign Out
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
