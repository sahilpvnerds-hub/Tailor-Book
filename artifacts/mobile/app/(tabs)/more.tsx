import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Badge, Button, Card, Divider } from "@/components/ui";
import { formatDate } from "@/utils/storage";
import colors from "@/constants/colors";
import { User } from "@/types";

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
  const { user, logout, getPendingUsers, approveUser, rejectUser, getAllTailors } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [allTailors, setAllTailors] = useState<User[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = user?.role === "admin";
  const topPad = Platform.OS === "web" ? 67 : 0;

  async function loadAdminData() {
    const [pending, tailors] = await Promise.all([getPendingUsers(), getAllTailors()]);
    setPendingUsers(pending);
    setAllTailors(tailors);
  }

  useEffect(() => {
    if (isAdmin) loadAdminData();
  }, [isAdmin]);

  async function onRefresh() {
    setRefreshing(true);
    if (isAdmin) await loadAdminData();
    setRefreshing(false);
  }

  function handleLogout() {
    Alert.alert("Sign Out", "This will clear all your data from this device.", [
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

  async function handleApprove(u: User) {
    await approveUser(u.id);
    await loadAdminData();
    Alert.alert("Approved", `${u.name} can now log in.`);
  }

  async function handleReject(u: User) {
    Alert.alert("Reject Tailor", `Reject ${u.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => { await rejectUser(u.id); await loadAdminData(); },
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
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
        {/* Avatar */}
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

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
            {user?.name}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
            {user?.shopName || (user?.role === "admin" ? "Administrator" : "Tailor")}
          </Text>
          {user?.speciality && (
            <View
              style={{
                alignSelf: "flex-start",
                marginTop: 5,
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#FFFFFF", textTransform: "capitalize" }}>
                {user.speciality}
              </Text>
            </View>
          )}
        </View>

        <MaterialIcons name="chevron-right" size={22} color="rgba(255,255,255,0.7)" />
      </Pressable>

      {/* Admin Panel */}
      {isAdmin && (
        <Card style={{ marginBottom: 16 }}>
          <Pressable
            onPress={() => setShowAdmin(!showAdmin)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <MaterialIcons name="admin-panel-settings" size={22} color={c.primary} />
              <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                Admin Panel
              </Text>
              {pendingUsers.length > 0 && (
                <View style={{ backgroundColor: "#EF4444", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>{pendingUsers.length}</Text>
                </View>
              )}
            </View>
            <MaterialIcons name={showAdmin ? "expand-less" : "expand-more"} size={22} color={c.mutedForeground} />
          </Pressable>

          {showAdmin && (
            <View style={{ marginTop: 16, gap: 16 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Pending Approvals ({pendingUsers.length})
              </Text>
              {pendingUsers.length === 0 ? (
                <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                  No pending registrations
                </Text>
              ) : (
                pendingUsers.map((u) => (
                  <View key={u.id} style={{ backgroundColor: c.muted, borderRadius: colors.radius, padding: 14, gap: 10 }}>
                    <View>
                      <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>{u.name}</Text>
                      {u.shopName && <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>{u.shopName}</Text>}
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                        {u.mobile} · Registered {formatDate(u.createdAt)}
                      </Text>
                      {u.speciality && (
                        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.primary }}>
                          Speciality: {u.speciality}
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Button label="Approve" onPress={() => handleApprove(u)} variant="primary" size="sm" style={{ flex: 1 }} />
                      <Button label="Reject" onPress={() => handleReject(u)} variant="destructive" size="sm" style={{ flex: 1 }} />
                    </View>
                  </View>
                ))
              )}

              <Divider />
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                All Tailors ({allTailors.length})
              </Text>
              {allTailors.map((u) => (
                <View key={u.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: c.foreground }}>{u.name}</Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>{u.mobile}</Text>
                  </View>
                  <Badge
                    label={u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                    variant={u.status === "approved" ? "success" : u.status === "rejected" ? "destructive" : "warning"}
                  />
                </View>
              ))}
            </View>
          )}
        </Card>
      )}

      {/* Help & Support */}
      <Card style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground, marginBottom: 14 }}>
          Help & Support
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
        <MenuItem icon="logout" label="Sign Out" subtitle="Clears all local data" onPress={handleLogout} danger />
      </Card>

      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground, textAlign: "center" }}>
        Tailor Book v2.0.0
      </Text>
    </ScrollView>
  );
}
