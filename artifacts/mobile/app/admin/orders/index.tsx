import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { StatusPill } from "@/components/admin/StatusPill";
import { api, getToken } from "@/utils/api";
import type { Order } from "@/types";

type Filter = "all" | "pending" | "completed" | "cancelled";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * Read-only orders table. One row per order with customer, total, delivery
 * date and status. Filter chips at the top.
 */
export default function AdminOrdersScreen() {
  const c = useColors();
  const [list, setList] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const rows = await api.orders.get(token);
      setList(rows);
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

  const filtered = filter === "all" ? list : list.filter((o) => o.status === filter);
  const counts = {
    all: list.length,
    pending: list.filter((o) => o.status === "pending").length,
    completed: list.filter((o) => o.status === "completed").length,
    cancelled: list.filter((o) => o.status === "cancelled").length,
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Filter chips */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingVertical: 14,
          gap: 8,
          backgroundColor: c.background,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        {FILTERS.map((f) => {
          const active = f.value === filter;
          const count = counts[f.value];
          return (
            <Pressable
              key={f.value}
              onPress={() => setFilter(f.value)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: active ? c.primary : pressed ? c.secondary : c.card,
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
                {f.label}
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
      </View>

      {filtered.length === 0 ? (
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
            <MaterialIcons name="shopping-bag" size={28} color={c.mutedForeground} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>No orders</Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: c.mutedForeground }}>
            {filter === "all" ? "No orders on the platform yet" : "Try a different status filter"}
          </Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
          contentContainerStyle={{ padding: 24 }}
        >
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
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1.5 }]}>ORDER</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 2 }]}>CUSTOMER</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1 }]}>ITEMS</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1 }]}>DELIVERY</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1.2, textAlign: "right" }]}>TOTAL</Text>
              <Text style={[styles.th, { color: c.mutedForeground, width: 110, textAlign: "right" }]}>STATUS</Text>
            </View>

            {filtered.map((o) => (
              <View
                key={o.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: c.border,
                  gap: 12,
                }}
              >
                <Text style={[styles.td, { color: c.foreground, flex: 1.5, fontWeight: "700" }]} numberOfLines={1}>
                  {o.orderNumber}
                </Text>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.td, { color: c.foreground }]} numberOfLines={1}>
                    {o.customerName}
                  </Text>
                  <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 2 }} numberOfLines={1}>
                    {o.customerMobile}
                  </Text>
                </View>
                <Text style={[styles.td, { color: c.mutedForeground, flex: 1 }]} numberOfLines={1}>
                  {o.items?.length ?? 0}
                </Text>
                <Text style={[styles.td, { color: c.mutedForeground, flex: 1 }]} numberOfLines={1}>
                  {o.deliveryDate
                    ? new Date(o.deliveryDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "—"}
                </Text>
                <Text style={[styles.td, { color: c.foreground, flex: 1.2, textAlign: "right", fontWeight: "700" }]}>
                  ₹{Number(o.totalAmount).toLocaleString()}
                </Text>
                <View style={{ width: 110, alignItems: "flex-end" }}>
                  <StatusPill status={o.status} />
                </View>
              </View>
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