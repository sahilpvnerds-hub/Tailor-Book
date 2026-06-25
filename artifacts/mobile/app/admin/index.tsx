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
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { StatCard } from "@/components/admin/StatCard";
import { Sparkline } from "@/components/admin/Sparkline";
import { StatusPill } from "@/components/admin/StatusPill";
import {
  api,
  getToken,
  type AdminOverview,
  type AdminUserWithStats,
} from "@/utils/api";

/**
 * Admin overview screen — KPI dashboard. Layout:
 *   1. Hero KPI strip (4 stat cards with breakdown rows)
 *   2. Pending approvals callout
 *   3. Two-column charts
 *   4. Top tailors by revenue table
 */
export default function AdminOverviewScreen() {
  const c = useColors();
  const router = useRouter();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [tailors, setTailors] = useState<AdminUserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }
      const [overview, allUsers] = await Promise.all([
        api.admin.getOverview(token),
        api.admin.listUsers(token, { withStats: true }),
      ]);
      setData(overview);
      setTailors(allUsers);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
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

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: c.background }}>
        <MaterialIcons name="error-outline" size={48} color={c.destructive} />
        <Text style={{ marginTop: 12, fontSize: 14, color: c.foreground }}>{error ?? "No data"}</Text>
        <Pressable
          onPress={load}
          style={({ pressed }) => ({
            marginTop: 16,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: pressed ? c.secondary : c.primary,
          })}
        >
          <Text style={{ color: c.primaryForeground, fontWeight: "600" }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const days = 14;
  const ordersDaily = spark(data.orders.newThisMonth, days);
  const tailorsDaily = spark(data.tailors.newThisMonth, days);

  // Top 5 by revenue
  const top = [...tailors]
    .sort((a, b) => (b.stats?.revenue ?? 0) - (a.stats?.revenue ?? 0))
    .slice(0, 5);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 24, gap: 18 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
      }
    >
      {/* ── Hero KPI strip ──────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <StatCard
          label="Tailors"
          value={data.tailors.total}
          icon="store"
          accent={c.primary}
          breakdown={[
            ["Approved", data.tailors.approved],
            ["Pending", data.tailors.pending],
          ]}
        />
        <StatCard
          label="Customers"
          value={data.customers.total}
          icon="people"
          accent="#0EA5E9"
          sublabel={`${data.customers.newThisMonth} new this month`}
        />
        <StatCard
          label="Orders"
          value={data.orders.total}
          icon="shopping-bag"
          accent="#A855F7"
          breakdown={[
            ["Done", data.orders.delivered],
            ["Active", data.orders.inProgress],
          ]}
        />
        <StatCard
          label="Revenue (this month)"
          value={formatCurrency(data.invoices.revenueThisMonth)}
          icon="payments"
          accent="#059669"
          sublabel={`${formatCurrency(data.invoices.outstanding)} outstanding`}
        />
      </View>

      {/* ── Pending approval banner ─────────────────────────────────────── */}
      {data.tailors.pending > 0 ? (
        <Pressable
          onPress={() => router.push("/admin/tailors/pending" as any)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            padding: 18,
            borderRadius: 14,
            backgroundColor: c.warning,
            opacity: pressed ? 0.9 : 1,
            shadowColor: c.warning,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 10,
            elevation: 3,
          })}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: c.warningForeground,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 14,
            }}
          >
            <MaterialIcons name="pending-actions" size={22} color={c.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.warningForeground, fontWeight: "800", fontSize: 15 }}>
              {data.tailors.pending} tailor{data.tailors.pending === 1 ? "" : "s"} waiting for approval
            </Text>
            <Text style={{ color: c.warningForeground, fontSize: 12, marginTop: 2, opacity: 0.85 }}>
              Review and approve new registrations
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={c.warningForeground} />
        </Pressable>
      ) : null}

      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 360 }}>
          <Sparkline
            title="New orders"
            data={ordersDaily}
            height={180}
            caption={`${data.orders.newThisMonth} new orders this month`}
          />
        </View>
        <View style={{ flex: 1, minWidth: 360 }}>
          <Sparkline
            title="New tailors"
            data={tailorsDaily}
            height={180}
            color="#0EA5E9"
            caption={`${data.tailors.newThisMonth} new tailors this month`}
          />
        </View>
      </View>

      {/* ── Top tailors table ──────────────────────────────────────────── */}
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 18,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}
        >
          <View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>
              Top tailors by revenue
            </Text>
            <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
              Ranked by completed-invoice total
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/admin/tailors" as any)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: pressed ? c.secondary : c.muted,
            })}
          >
            <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "600" }}>
              View all
            </Text>
            <MaterialIcons name="arrow-forward" size={14} color={c.foreground} style={{ marginLeft: 4 }} />
          </Pressable>
        </View>

        {top.length === 0 ? (
          <View style={{ padding: 30, alignItems: "center" }}>
            <Text style={{ color: c.mutedForeground, fontSize: 13 }}>No tailors yet</Text>
          </View>
        ) : (
          top.map((u, i) => (
            <Pressable
              key={u.id}
              onPress={() => router.push(`/admin/tailors/${u.id}` as any)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 18,
                paddingVertical: 14,
                backgroundColor: pressed ? c.secondary : "transparent",
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
                gap: 12,
              })}
            >
              <Text
                style={{
                  width: 22,
                  fontSize: 12,
                  fontWeight: "800",
                  color: i === 0 ? c.primary : c.mutedForeground,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </Text>
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
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: c.foreground }}>
                  {formatCurrency(u.stats?.revenue ?? 0)}
                </Text>
                <StatusPill status={u.status} />
              </View>
              <MaterialIcons name="chevron-right" size={18} color={c.mutedForeground} />
            </Pressable>
          ))
        )}
      </View>

      <Text style={{ fontSize: 11, color: c.mutedForeground, textAlign: "right", marginTop: 4 }}>
        Updated {new Date(data.generatedAt).toLocaleString()}
      </Text>
    </ScrollView>
  );
}

/**
 * Spread `total` across `n` days with a slight upward trend so the chart
 * isn't a flat line. A real time-series endpoint would replace this in v2.
 */
function spark(total: number, n: number): number[] {
  if (total <= 0) return new Array(n).fill(0);
  const avg = total / n;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const wobble = Math.sin(i * 0.7) * 0.35;
    const v = Math.max(0, Math.round(avg * (1 + wobble)));
    out.push(v);
  }
  // Adjust the last value so the series sums to `total`.
  const diff = total - out.reduce((a, b) => a + b, 0);
  out[out.length - 1] = Math.max(0, out[out.length - 1] + diff);
  return out;
}

function formatCurrency(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return `₹${value}`;
}
