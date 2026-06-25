import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { api, getToken, type AdminUserWithStats } from "@/utils/api";

/**
 * Pending approvals queue. Denser table layout — one row per pending tailor
 * with inline Approve / Reject buttons. Faster for admins with 10+ pending.
 */
export default function PendingApprovalsScreen() {
  const c = useColors();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const rows = await api.admin.listUsers(token, { status: "pending" });
      setUsers(rows);
    } catch {
      // empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const decide = useCallback(
    async (user: AdminUserWithStats, action: "approve" | "reject") => {
      setBusyId(user.id);
      try {
        const token = await getToken();
        if (!token) return;
        if (action === "approve") await api.admin.approveUser(token, user.id);
        else await api.admin.rejectUser(token, user.id);
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
      } catch (err) {
        Alert.alert("Error", (err as Error).message);
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 24, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
      }
    >
      {users.length === 0 ? (
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: "center",
            justifyContent: "center",
            padding: 60,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: c.success,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <MaterialIcons name="check" size={36} color={c.successForeground} />
          </View>
          <Text style={{ fontSize: 17, fontWeight: "700", color: c.foreground }}>
            All caught up!
          </Text>
          <Text style={{ marginTop: 6, fontSize: 13, color: c.mutedForeground, textAlign: "center" }}>
            No pending tailor registrations to review.{"\n"}New sign-ups will appear here.
          </Text>
        </View>
      ) : (
        <>
          {/* Summary bar */}
          <View
            style={{
              backgroundColor: c.warning,
              borderRadius: 12,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <MaterialIcons name="pending-actions" size={20} color={c.warningForeground} />
            <Text style={{ color: c.warningForeground, fontSize: 13, fontWeight: "600", flex: 1 }}>
              {users.length} new {users.length === 1 ? "tailor is" : "tailors are"} waiting for your review
            </Text>
          </View>

          {/* Table */}
          <View
            style={{
              backgroundColor: c.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: c.border,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 18,
                paddingVertical: 12,
                backgroundColor: c.muted,
                borderBottomWidth: 1,
                borderBottomColor: c.border,
              }}
            >
              <Text style={[styles.th, { color: c.mutedForeground, flex: 2.5 }]}>TAILOR</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1.5 }]}>MOBILE</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1.5 }]}>SHOP</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1.2 }]}>SPECIALITY</Text>
              <Text style={[styles.th, { color: c.mutedForeground, width: 180, textAlign: "right" }]}>ACTIONS</Text>
            </View>

            {users.map((u) => (
              <View
                key={u.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: c.border,
                  gap: 12,
                  opacity: busyId === u.id ? 0.5 : 1,
                }}
              >
                <Pressable
                  onPress={() => router.push(`/admin/tailors/${u.id}` as any)}
                  style={({ pressed }) => ({
                    flex: 2.5,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: c.secondary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: c.foreground }}>
                      {u.name?.charAt(0).toUpperCase() ?? "?"}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: c.foreground }} numberOfLines={1}>
                      {u.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 2 }} numberOfLines={1}>
                      {u.email}
                    </Text>
                  </View>
                </Pressable>

                <Text style={[styles.td, { color: c.foreground, flex: 1.5 }]} numberOfLines={1}>
                  {u.mobile}
                </Text>
                <Text style={[styles.td, { color: c.foreground, flex: 1.5 }]} numberOfLines={1}>
                  {u.shopName ?? "—"}
                </Text>
                <Text style={[styles.td, { color: c.mutedForeground, flex: 1.2, textTransform: "capitalize" }]} numberOfLines={1}>
                  {u.speciality ?? "—"}
                </Text>

                <View
                  style={{
                    width: 180,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    justifyContent: "flex-end",
                  }}
                >
                  <Pressable
                    onPress={() => decide(u, "reject")}
                    disabled={busyId === u.id}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 8,
                      backgroundColor: pressed ? c.muted : c.card,
                      borderWidth: 1,
                      borderColor: c.border,
                    })}
                  >
                    <MaterialIcons name="close" size={14} color={c.destructive} />
                    <Text style={{ marginLeft: 4, fontSize: 12, fontWeight: "700", color: c.destructive }}>
                      Reject
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => decide(u, "approve")}
                    disabled={busyId === u.id}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 8,
                      backgroundColor: pressed ? "rgba(5,150,105,0.85)" : c.success,
                    })}
                  >
                    <MaterialIcons name="check" size={14} color={c.successForeground} />
                    <Text style={{ marginLeft: 4, fontSize: 12, fontWeight: "700", color: c.successForeground }}>
                      Approve
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles: { th: any; td: any } = {
  th: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  td: {
    fontSize: 13,
  },
};
