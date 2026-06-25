import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { StatusPill } from "@/components/admin/StatusPill";
import {
  api,
  getToken,
  type AdminUserWithStats,
} from "@/utils/api";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Suspended" },
];

/**
 * All-tailors data table. Sticky-style header, hover/press rows, status filter
 * chips at the top. Click anywhere on a row to open the tailor detail.
 */
export default function AdminTailorsScreen() {
  const c = useColors();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const rows = await api.admin.listUsers(token, {
        status: status === "all" ? undefined : status,
        q: search.trim() || undefined,
        withStats: true,
      });
      setUsers(rows);
    } catch {
      // empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const decide = useCallback(async (user: AdminUserWithStats, action: "approve" | "suspend" | "delete") => {
    setBusyId(user.id);
    try {
      const token = await getToken();
      if (!token) return;
      if (action === "approve") await api.admin.approveUser(token, user.id);
      else if (action === "suspend") await api.admin.suspendUser(token, user.id);
      else await api.admin.deleteUser(token, user.id);
      await load();
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const counts = {
    all: users.length,
    approved: users.filter((u) => u.status === "approved").length,
    pending: users.filter((u) => u.status === "pending").length,
    rejected: users.filter((u) => u.status === "rejected").length,
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Search + filter bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingVertical: 14,
          gap: 12,
          backgroundColor: c.background,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            backgroundColor: c.card,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            height: 40,
            flex: 1,
            maxWidth: 380,
          }}
        >
          <MaterialIcons name="search" size={18} color={c.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, email or mobile"
            placeholderTextColor={c.mutedForeground}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 13,
              color: c.foreground,
              padding: 0,
            }}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <MaterialIcons name="close" size={18} color={c.mutedForeground} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {STATUS_TABS.map((tab) => {
            const active = tab.value === status;
            const count = counts[tab.value];
            return (
              <Pressable
                key={tab.value}
                onPress={() => setStatus(tab.value)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: active
                    ? c.primary
                    : pressed
                    ? c.secondary
                    : c.card,
                  borderWidth: 1,
                  borderColor: active ? c.primary : c.border,
                  gap: 6,
                })}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: active ? c.primaryForeground : c.mutedForeground,
                  }}
                >
                  {tab.label}
                </Text>
                <View
                  style={{
                    minWidth: 20,
                    height: 18,
                    paddingHorizontal: 5,
                    borderRadius: 9,
                    backgroundColor: active ? c.primaryForeground : c.muted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: active ? c.primary : c.mutedForeground,
                    }}
                  >
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : users.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: c.muted,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <MaterialIcons name="store" size={28} color={c.mutedForeground} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>
            No tailors match your filters
          </Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: c.mutedForeground }}>
            Try clearing the search or switching status tabs
          </Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
          contentContainerStyle={{ padding: 24, gap: 0 }}
        >
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
            {/* Header row */}
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
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1.8 }]}>EMAIL</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1.2 }]}>MOBILE</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1 }]}>SHOP</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1, textAlign: "right" }]}>REVENUE</Text>
              <Text style={[styles.th, { color: c.mutedForeground, width: 110, textAlign: "right" }]}>STATUS</Text>
              <Text style={[styles.th, { color: c.mutedForeground, width: 40 }]}></Text>
            </View>

            {users.map((u) => (
              <Pressable
                key={u.id}
                onPress={() => router.push(`/admin/tailors/${u.id}` as any)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                  backgroundColor: pressed ? c.secondary : c.card,
                  borderTopWidth: 1,
                  borderTopColor: c.border,
                  gap: 12,
                  opacity: busyId === u.id ? 0.6 : 1,
                })}
              >
                <View style={{ flex: 2.5, flexDirection: "row", alignItems: "center", gap: 10 }}>
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
                      {u.stats?.customers ?? 0} customers · {u.stats?.orders ?? 0} orders
                    </Text>
                  </View>
                </View>

                <Text style={[styles.td, { color: c.foreground, flex: 1.8 }]} numberOfLines={1}>{u.email}</Text>
                <Text style={[styles.td, { color: c.foreground, flex: 1.2 }]} numberOfLines={1}>{u.mobile}</Text>
                <Text style={[styles.td, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{u.shopName ?? "—"}</Text>
                <Text style={[styles.td, { color: c.foreground, flex: 1, textAlign: "right", fontWeight: "700" }]}>
                  {formatCurrency(u.stats?.revenue ?? 0)}
                </Text>

                <View style={{ width: 110, alignItems: "flex-end" }}>
                  <StatusPill status={u.status} />
                </View>

                <View style={{ width: 40, alignItems: "flex-end" }}>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      const actions =
                        u.status === "pending"
                          ? ["Approve", "Reject"]
                          : u.status === "rejected"
                          ? ["Unsuspend", "Delete"]
                          : ["Suspend", "Delete"];
                      Alert.alert(u.name, "Choose an action", [
                        ...actions.map((a) => ({
                          text: a,
                          style: (a === "Delete" || a === "Reject" ? "destructive" : "default") as any,
                          onPress: () => {
                            if (a === "Approve") decide(u, "approve");
                            else if (a === "Reject" || a === "Suspend") decide(u, "suspend");
                            else if (a === "Unsuspend") decide(u, "approve");
                            else if (a === "Delete") decide(u, "delete");
                          },
                        })),
                        { text: "Cancel", style: "cancel" },
                      ]);
                    }}
                    hitSlop={8}
                    style={({ pressed }) => ({
                      padding: 6,
                      borderRadius: 6,
                      backgroundColor: pressed ? c.muted : "transparent",
                    })}
                  >
                    <MaterialIcons name="more-vert" size={18} color={c.mutedForeground} />
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
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

function formatCurrency(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return `₹${value}`;
}