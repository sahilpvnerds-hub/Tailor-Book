import React, { useMemo, useState } from "react";
import { FlatList, Platform, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { EmptyState, Badge } from "@/components/ui";
import colors from "@/constants/colors";
import { formatCurrency, formatDate } from "@/utils/storage";

/**
 * Orders list — accessible via the "Orders" tab in the bottom bar.
 * Renamed from the previous /invoices route, which now hosts the
 * Invoices list.
 */
export default function OrdersScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { orders } = useData();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "cancelled">("all");

  const statusConfig = {
    pending: { label: "Pending", color: "#D97706", bg: "#FEF3C7", variant: "warning" as const },
    completed: { label: "Completed", color: "#059669", bg: "#D1FAE5", variant: "success" as const },
    cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2", variant: "destructive" as const },
  };

  const filtered = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            (filter === "all" || o.status === filter) &&
            (o.customerName.toLowerCase().includes(search.toLowerCase()) ||
              o.orderNumber.toLowerCase().includes(search.toLowerCase()))
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders, search, filter]
  );

  function deliveryDaysLeft(dateStr?: string | null): number | null {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const topPad = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Search and Header panel */}
      <View
        style={{
          paddingTop: insets.top + topPad + 16,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: c.card,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: c.foreground }}>Orders</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/orders/new");
            }}
            style={{ backgroundColor: c.primary, borderRadius: 10, padding: 8 }}
          >
            <MaterialIcons name="add" size={20} color={c.primaryForeground} />
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.input,
            borderRadius: colors.radius,
            borderWidth: 1,
            borderColor: c.border,
            paddingHorizontal: 12,
            gap: 8,
          }}
        >
          <MaterialIcons name="search" size={18} color={c.mutedForeground} />
          <TextInput
            style={{ flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: c.foreground, paddingVertical: 10 }}
            placeholder="Search orders..."
            placeholderTextColor={c.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <MaterialIcons name="close" size={16} color={c.mutedForeground} />
            </Pressable>
          )}
        </View>

        {/* Filter pills */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["all", "pending", "completed", "cancelled"] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: filter === f ? c.primary : c.muted,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_500Medium",
                  color: filter === f ? c.primaryForeground : c.mutedForeground,
                }}
              >
                {f === "all" ? "All" : statusConfig[f].label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const sc = statusConfig[item.status];
          return (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/orders/${item.id}` as any);
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: c.card,
                borderRadius: colors.radius,
                padding: 14,
                gap: 12,
                borderWidth: 1,
                borderColor: c.border,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 1,
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: sc.bg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name="shopping-bag" size={22} color={sc.color} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                  {item.customerName}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 1 }}>
                  {item.orderNumber} · {formatDate(item.createdAt)}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.primary }}>
                    {item.items?.length ?? 0} item{(item.items?.length ?? 0) !== 1 ? "s" : ""}
                  </Text>
                  {item.deliveryDate && (() => {
                    const days = deliveryDaysLeft(item.deliveryDate);
                    if (days === null) return null;
                    const col = days < 0 ? "#DC2626" : days <= 2 ? "#D97706" : "#059669";
                    const lbl = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`;
                    return (
                      <View style={{ backgroundColor: col + "18", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: col }}>{lbl}</Text>
                      </View>
                    );
                  })()}
                  {(item.balanceDue ?? 0) > 0 && (
                    <View style={{ backgroundColor: "#FEF3C7", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#D97706" }}>
                        Bal: {formatCurrency(item.balanceDue ?? 0)}
                      </Text>
                    </View>
                  )}
                  {(item.advanceAmount ?? 0) > 0 && (item.balanceDue ?? 0) === 0 && (
                    <View style={{ backgroundColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#059669" }}>✓ Paid</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={{ alignItems: "flex-end", gap: 5 }}>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>
                  {formatCurrency(Number(item.totalAmount))}
                </Text>
                <Badge label={sc.label} variant={sc.variant} />
              </View>
            </Pressable>
          );
        }}
        contentContainerStyle={{
          padding: 16,
          gap: 8,
          flexGrow: 1,
          paddingBottom: insets.bottom + 100,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        scrollEnabled={!!filtered.length}
        ListEmptyComponent={
          <EmptyState
            icon="shopping-bag"
            title={search || filter !== "all" ? "No orders found" : "No orders"}
            subtitle="Create an order from a customer profile or tap + above"
            action={!search && filter === "all" ? { label: "Create Order", onPress: () => router.push("/orders/new") } : undefined}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
