import React from "react";
import {
  Alert,
  Linking,
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
import { Card, Divider } from "@/components/ui";
import { useTranslation } from "@/utils/i18n";
import colors from "@/constants/colors";

function MenuItem({
  icon,
  label,
  subtitle,
  onPress,
  danger = false,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        gap: 14,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: danger ? "#FEE2E2" : c.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name={icon} size={18} color={danger ? c.destructive : c.foreground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontFamily: "Inter_500Medium",
            color: danger ? c.destructive : c.foreground,
          }}
        >
          {label}
        </Text>
        {subtitle && (
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 1 }}>
            {subtitle}
          </Text>
        )}
      </View>
      <MaterialIcons name="chevron-right" size={18} color={c.mutedForeground} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : 0;

  function handleLogout() {
    Alert.alert(t("more.signOut"), t("more.signOutConfirmDialog"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("more.signOut"),
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        paddingTop: insets.top + topPad + 20,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 110,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profile Card ── */}
      <Pressable
        onPress={() => router.push("/profile" as any)}
        style={({ pressed }) => ({
          backgroundColor: c.primary,
          borderRadius: colors.radius + 4,
          padding: 20,
          marginBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: "rgba(255,255,255,0.22)",
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.35)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
            {user?.name
              ?.split(" ")
              .map((w: string) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase() ?? "?"}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
            {user?.name}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
            {user?.shopName || t("profile.title")}
          </Text>
        </View>

        <MaterialIcons name="chevron-right" size={22} color="rgba(255,255,255,0.7)" />
      </Pressable>

      {/* Help & Support */}
      <Card style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground, marginBottom: 14 }}>
          {t("more.helpSupport")}
        </Text>
        <Pressable
          onPress={() => Linking.openURL("mailto:support@tailorbook.com")}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" }}>
            <MaterialIcons name="email" size={18} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>Support Email</Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
              support@tailorbook.com
            </Text>
          </View>
        </Pressable>
        <Divider />
        <Pressable
          onPress={() => Linking.openURL("tel:+919999999999")}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" }}>
            <MaterialIcons name="phone" size={18} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>Support Mobile</Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
              +91 9999999999
            </Text>
          </View>
        </Pressable>
      </Card>

      {/* Sign Out */}
      <Card style={{ marginBottom: 16 }}>
        <MenuItem
          icon="logout"
          label={t("more.signOut")}
          subtitle={t("more.signOutSubtitle")}
          onPress={handleLogout}
          danger
        />
      </Card>

      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground, textAlign: "center" }}>
        Stitchix v2.0.0
      </Text>
    </ScrollView>
  );
}
