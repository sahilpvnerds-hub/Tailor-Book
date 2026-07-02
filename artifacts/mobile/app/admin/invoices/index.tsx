import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import type { Invoice } from "@/types";

type Filter = "all" | "pending" | "completed" | "cancelled";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "completed", label: "Paid" },
  { value: "pending", label: "Unpaid" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * Read-only invoices table. Header strip with revenue / outstanding totals
 * (computed client-side from the loaded rows), status filter chips, then a
 * data table of all invoices.
 */
export default function AdminInvoicesScreen() {
  const c = useColors();
  const [list, setList] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const rows = await api.invoices.get(token);
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
    completed: list.filter((o) => o.status === "completed").length,
    pending: list.filter((o) => o.status === "pending").length,
    cancelled: list.filter((o) => o.status === "cancelled").length,
  };

  const totals = useMemo(() => {
    let revenue = 0;
    let outstanding = 0;
    for (const inv of list) {
      if (inv.status === "completed") {
        revenue += Number(inv.total);
      } else if (inv.status === "pending") {
        revenue += Number(inv.paidAmount ?? 0);
        outstanding += Math.max(0, Number(inv.total) - Number(inv.paidAmount ?? 0));
      }
    }
    return { revenue, outstanding };
  }, [list]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Summary strip */}
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          paddingHorizontal: 24,
          paddingTop: 18,
        }}
      >
        <SummaryBlock
          label="Total revenue (paid)"
          value={`₹${totals.revenue.toLocaleString()}`}
          accent={c.success}
          icon="trending-up"
        />
        <SummaryBlock
          label="Outstanding (unpaid)"
          value={`₹${totals.outstanding.toLocaleString()}`}
          accent={c.warning}
          icon="schedule"
        />
      </View>

      {/* Filter chips */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 14,
          gap: 8,
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
            <MaterialIcons name="receipt-long" size={28} color={c.mutedForeground} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>No invoices</Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: c.mutedForeground }}>
            {filter === "all" ? "No invoices on the platform yet" : "Try a different status filter"}
          </Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
          contentContainerStyle={{ padding: 24, paddingTop: 0 }}
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
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1.5 }]}>INVOICE</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 2 }]}>CUSTOMER</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1.2 }]}>ISSUED</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1.2 }]}>DUE</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1.2, textAlign: "right" }]}>TOTAL</Text>
              <Text style={[styles.th, { color: c.mutedForeground, width: 110, textAlign: "right" }]}>STATUS</Text>
            </View>

            {filtered.map((inv) => (
              <View
                key={inv.id}
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
                  {inv.invoiceNumber}
                </Text>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.td, { color: c.foreground }]} numberOfLines={1}>
                    {inv.customerName}
                  </Text>
                  <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 2 }} numberOfLines={1}>
                    {inv.customerMobile}
                  </Text>
                </View>
                <Text style={[styles.td, { color: c.mutedForeground, flex: 1.2 }]} numberOfLines={1}>
                  {new Date(inv.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}
                </Text>
                <Text style={[styles.td, { color: c.mutedForeground, flex: 1.2 }]} numberOfLines={1}>
                  —
                </Text>
                <Text style={[styles.td, { color: c.foreground, flex: 1.2, textAlign: "right", fontWeight: "700" }]}>
                  ₹{Number(inv.total).toLocaleString()}
                </Text>
                <View style={{ width: 110, alignItems: "flex-end" }}>
                  <StatusPill status={inv.status} />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function SummaryBlock({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.border,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: accent + "1A",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name={icon} size={20} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 10,
            color: c.mutedForeground,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          {label}
        </Text>
        <Text style={{ fontSize: 18, fontWeight: "800", color: c.foreground, marginTop: 2 }}>
          {value}
        </Text>
      </View>
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