import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Badge, Button, Card, Divider } from "@/components/ui";
import { User } from "@/types";
import { formatDate } from "@/utils/storage";
import colors from "@/constants/colors";

function MenuItem({
  icon,
  label,
  onPress,
  danger = false,
  badge,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  badge?: number;
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
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          fontFamily: "Inter_500Medium",
          color: danger ? c.destructive : c.foreground,
        }}
      >
        {label}
      </Text>
      {badge !== undefined && badge > 0 && (
        <View style={{ backgroundColor: "#EF4444", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
          <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>{badge}</Text>
        </View>
      )}
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
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => { await logout(); } },
    ]);
  }

  async function handleApprove(u: User) {
    await approveUser(u.id);
    await loadAdminData();
    Alert.alert("Approved", `${u.name} has been approved.`);
  }

  async function handleReject(u: User) {
    Alert.alert("Reject Tailor", `Reject ${u.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          await rejectUser(u.id);
          await loadAdminData();
        },
      },
    ]);
  }

  const topPad = Platform.OS === "web" ? 67 : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        paddingTop: insets.top + topPad + 20,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 100,
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Card */}
      <Card style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: c.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: c.primaryForeground }}>
              {user?.name?.[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: c.foreground }}>
                {user?.name}
              </Text>
              <Badge
                label={user?.role === "admin" ? "Admin" : "Tailor"}
                variant={user?.role === "admin" ? "default" : "secondary"}
              />
            </View>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 2 }}>
              {user?.email}
            </Text>
            {user?.shopName && (
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                {user.shopName}
              </Text>
            )}
          </View>
        </View>
      </Card>

      {/* Admin Section */}
      {isAdmin && (
        <Card style={{ marginBottom: 20 }}>
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
              {/* Pending approvals */}
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Pending Approvals ({pendingUsers.length})
              </Text>
              {pendingUsers.length === 0 ? (
                <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground, paddingVertical: 8 }}>
                  No pending registrations
                </Text>
              ) : (
                pendingUsers.map((u) => (
                  <View key={u.id} style={{ backgroundColor: c.muted, borderRadius: colors.radius, padding: 14, gap: 10 }}>
                    <View>
                      <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>{u.name}</Text>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>{u.shopName}</Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>{u.mobile} · {u.city}, {u.state}</Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 2 }}>Registered {formatDate(u.createdAt)}</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Button label="Approve" onPress={() => handleApprove(u)} variant="primary" size="sm" style={{ flex: 1 }} />
                      <Button label="Reject" onPress={() => handleReject(u)} variant="destructive" size="sm" style={{ flex: 1 }} />
                    </View>
                  </View>
                ))
              )}

              <Divider />

              {/* All Tailors */}
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                All Tailors ({allTailors.length})
              </Text>
              {allTailors.map((u) => (
                <View key={u.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: c.foreground }}>{u.name}</Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>{u.shopName}</Text>
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

      {/* Menu */}
      <Card style={{ marginBottom: 20, gap: 0 }}>
        <MenuItem icon="person" label="Profile" onPress={() => {}} />
        <Divider />
        <MenuItem icon="notifications" label="Notifications" onPress={() => {}} />
        <Divider />
        <MenuItem icon="help" label="Help & Support" onPress={() => {}} />
        <Divider />
        <MenuItem icon="logout" label="Sign Out" onPress={handleLogout} danger />
      </Card>

      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground, textAlign: "center" }}>
        Tailor Book v1.0.0
      </Text>
    </ScrollView>
  );
}
