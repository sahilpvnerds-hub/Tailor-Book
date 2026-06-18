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
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Badge, Button, Card, Divider, Input } from "@/components/ui";
import { formatDate } from "@/utils/storage";
import colors from "@/constants/colors";
import { User } from "@/types";

export default function AdminScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, getPendingUsers, approveUser, rejectUser, getAllTailors } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [allTailors, setAllTailors] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "admin";
  const topPad = Platform.OS === "web" ? 67 : 0;

  async function loadAdminData() {
    try {
      const [pending, tailors] = await Promise.all([getPendingUsers(), getAllTailors()]);
      setPendingUsers(pending);
      setAllTailors(tailors);
    } catch (err: any) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    } else {
      // If a non-admin somehow gets here, redirect to home
      router.replace("/(tabs)");
    }
  }, [isAdmin]);

  async function onRefresh() {
    setRefreshing(true);
    await loadAdminData();
    setRefreshing(false);
  }

  async function handleApprove(u: User) {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await approveUser(u.id);
      await loadAdminData();
      Alert.alert("Approved", `${u.name} has been approved successfully.`);
    } catch (err: any) {
      Alert.alert("Approval Failed", err?.message ?? "Could not approve tailor.");
    }
  }

  async function handleReject(u: User) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Reject Tailor", `Are you sure you want to reject ${u.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            await rejectUser(u.id);
            await loadAdminData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Rejected", `${u.name} has been rejected.`);
          } catch (err: any) {
            Alert.alert("Rejection Failed", err?.message ?? "Could not reject tailor.");
          }
        },
      },
    ]);
  }

  if (!isAdmin) {
    return null;
  }

  const query = searchQuery.trim().toLowerCase();

  const filteredPending = pendingUsers.filter((u) => {
    if (!query) return true;
    return (
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.mobile.toLowerCase().includes(query) ||
      (u.shopName && u.shopName.toLowerCase().includes(query))
    );
  });

  const filteredAllTailors = allTailors.filter((u) => {
    if (!query) return true;
    return (
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.mobile.toLowerCase().includes(query) ||
      (u.shopName && u.shopName.toLowerCase().includes(query))
    );
  });

  const activeTailors = filteredAllTailors.filter((t) => t.role === "tailor" && t.status === "approved");
  const rejectedTailors = filteredAllTailors.filter((t) => t.role === "tailor" && t.status === "rejected");

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
      {/* ── Header ── */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 24, fontFamily: "Inter_700Bold", color: c.foreground }}>
          Admin Panel
        </Text>
        <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 4 }}>
          Manage tailor approvals and system users
        </Text>
      </View>

      {/* ── Search Bar ── */}
      <Input
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search by name, shop, email, mobile..."
        icon="search"
        containerStyle={{ marginBottom: 20 }}
        rightElement={
          searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <MaterialIcons name="close" size={18} color={c.mutedForeground} />
            </Pressable>
          ) : undefined
        }
      />

      {/* ── Stats Row ── */}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
        <Card style={{ flex: 1, padding: 16, alignItems: "center", gap: 6 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#E0F2FE", alignItems: "center", justifyContent: "center" }}>
            <MaterialIcons name="people" size={20} color="#0284C7" />
          </View>
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: c.foreground }}>
            {activeTailors.length}
          </Text>
          <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
            Active Tailors
          </Text>
        </Card>

        <Card style={{ flex: 1, padding: 16, alignItems: "center", gap: 6 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: pendingUsers.length > 0 ? "#FEF3C7" : c.muted, alignItems: "center", justifyContent: "center" }}>
            <MaterialIcons name="gavel" size={20} color={pendingUsers.length > 0 ? "#D97706" : c.mutedForeground} />
          </View>
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: pendingUsers.length > 0 ? "#D97706" : c.foreground }}>
            {pendingUsers.length}
          </Text>
          <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
            Pending Approvals
          </Text>
        </Card>
      </View>

      {/* ── Pending Approvals Section ── */}
      <Card style={{ marginBottom: 16, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.foreground, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Pending Approvals ({filteredPending.length})
          </Text>
          {filteredPending.length > 0 && (
            <View style={{ backgroundColor: "#F59E0B", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>ACTION REQUIRED</Text>
            </View>
          )}
        </View>

        {filteredPending.length === 0 ? (
          <View style={{ paddingVertical: 12, alignItems: "center" }}>
            <MaterialIcons name="check-circle-outline" size={32} color="#10B981" style={{ marginBottom: 6 }} />
            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.mutedForeground, textAlign: "center" }}>
              {query ? "No matching pending approvals" : "All registrations are approved!"}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {filteredPending.map((u, idx) => (
              <React.Fragment key={u.id}>
                {idx > 0 && <Divider style={{ marginVertical: 4 }} />}
                <View style={{ backgroundColor: c.muted + "40", borderRadius: colors.radius, padding: 14, gap: 12, borderWidth: 1, borderColor: c.border }}>
                  <View style={{ gap: 3 }}>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                      {u.name}
                    </Text>
                    {u.shopName && (
                      <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
                        🏪 {u.shopName}
                      </Text>
                    )}
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                      📞 {u.mobile} · 📧 {u.email}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                      Registered: {formatDate(u.createdAt)}
                    </Text>
                    {u.speciality && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.primary }}>
                          Speciality: {u.speciality.charAt(0).toUpperCase() + u.speciality.slice(1)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Button
                      label="Reject"
                      onPress={() => handleReject(u)}
                      variant="destructive"
                      size="sm"
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Approve"
                      onPress={() => handleApprove(u)}
                      variant="primary"
                      size="sm"
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        )}
      </Card>

      {/* ── Active Tailors Section ── */}
      <Card style={{ marginBottom: 16, gap: 14 }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.foreground, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Active Tailors ({activeTailors.length})
        </Text>

        {activeTailors.length === 0 ? (
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, textAlign: "center", paddingVertical: 12 }}>
            No active tailors found.
          </Text>
        ) : (
          <View style={{ gap: 12 }}>
            {activeTailors.map((u, idx) => (
              <React.Fragment key={u.id}>
                {idx > 0 && <Divider />}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                      {u.name}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                      {u.mobile} · {u.email}
                    </Text>
                    {u.shopName ? (
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                        {u.shopName} {u.city ? `· ${u.city}` : ""}
                      </Text>
                    ) : null}
                  </View>
                  <Badge label="Approved" variant="success" />
                </View>
              </React.Fragment>
            ))}
          </View>
        )}
      </Card>

      {/* ── Rejected Tailors (if any) ── */}
      {rejectedTailors.length > 0 && (
        <Card style={{ marginBottom: 16, gap: 14 }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.foreground, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Rejected / Inactive ({rejectedTailors.length})
          </Text>
          <View style={{ gap: 12 }}>
            {rejectedTailors.map((u, idx) => (
              <React.Fragment key={u.id}>
                {idx > 0 && <Divider />}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                      {u.name}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                      {u.mobile}
                    </Text>
                  </View>
                  <Badge label="Rejected" variant="destructive" />
                </View>
              </React.Fragment>
            ))}
          </View>
        </Card>
      )}
    </ScrollView>
  );
}
