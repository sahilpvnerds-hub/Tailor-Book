import React, { useMemo, useState } from "react";
import { FlatList, Platform, Pressable, Text, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { EmptyState, Badge } from "@/components/ui";
import colors from "@/constants/colors";
import { formatCurrency, formatDate } from "@/utils/storage";

/**
 * Invoices list — top-level stack screen reachable from the Home page
 * "Invoice List" Quick Action and the "See all" link under Recent
 * Invoices. Lives outside the (tabs) group on purpose: a tab marked
 * `href: null` is hidden from the bar but `router.push` to it can be
 * ignored by expo-router, so we expose this as a plain stack route
 * instead.
 */
export default function InvoicesScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { invoices } = useData();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "cancelled">("all");

  const statusConfig = {
    pending: { label: "Pending", color: "#D97706", bg: "#FEF3C7", variant: "warning" as const },
    completed: { label: "Completed", color: "#059669", bg: "#D1FAE5", variant: "success" as const },
    cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2", variant: "destructive" as const },
  };

  const filtered = useMemo(
    () =>
      invoices
        .filter(
          (inv) =>
            (filter === "all" || inv.status === filter) &&
            (search.trim().length === 0 ||
              inv.customerName.toLowerCase().includes(search.toLowerCase()) ||
              inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
              (inv.orderLabel ?? "").toLowerCase().includes(search.toLowerCase()))
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [invoices, search, filter]
  );

  // Aggregate stats for the summary row at the top of the list.
  const totals = useMemo(() => {
    const sum = (sel: (i: typeof invoices[number]) => boolean) =>
      invoices.filter(sel).reduce((s, i) => s + Number(i.total ?? 0), 0);
    return {
      total: sum(() => true),
      pending: sum((i) => i.status === "pending"),
      completed: sum((i) => i.status === "completed"),
    };
  }, [invoices]);

  const topPad = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Hide the parent stack header — we render our own header in-body */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              style={{ padding: 4 }}
              hitSlop={8}
            >
              <MaterialIcons name="arrow-back" size={24} color={c.foreground} />
            </Pressable>
            <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: c.foreground }}>Invoices</Text>
          </View>
          {/* "+" add button intentionally hidden — invoices are only ever
              created from the order detail page (per-item or whole-order
              generation). There is no manual "add invoice" flow. */}
        </View>

        {/* Summary stats — total invoiced, pending, completed */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: c.muted + "40",
            borderRadius: 12,
            padding: 12,
            gap: 14,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: c.mutedForeground, textTransform: "uppercase" }}>
              Total
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.foreground, marginTop: 2 }}>
              {formatCurrency(totals.total)}
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: c.border }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: c.mutedForeground, textTransform: "uppercase" }}>
              Pending
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#D97706", marginTop: 2 }}>
              {formatCurrency(totals.pending)}
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: c.border }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: c.mutedForeground, textTransform: "uppercase" }}>
              Paid
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#059669", marginTop: 2 }}>
              {formatCurrency(totals.completed)}
            </Text>
          </View>
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
            placeholder="Search invoices..."
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
          const balance = Number(item.total ?? 0) - Number(item.paidAmount ?? 0);
          return (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/invoices/${item.id}` as any);
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
                <MaterialIcons name="receipt" size={22} color={sc.color} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }} numberOfLines={1}>
                  {item.customerName}
                </Text>
                <Text
                  style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 1 }}
                  numberOfLines={1}
                >
                  {item.invoiceNumber} · {item.orderLabel || "—"} · {formatDate(item.createdAt)}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.primary }}>
                    {item.items?.length ?? 0} item{(item.items?.length ?? 0) !== 1 ? "s" : ""}
                  </Text>
                  {balance > 0 && (
                    <View style={{ backgroundColor: "#FEF3C7", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#D97706" }}>
                        Bal: {formatCurrency(balance)}
                      </Text>
                    </View>
                  )}
                  {balance <= 0 && (item.paidAmount ?? 0) > 0 && (
                    <View style={{ backgroundColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#059669" }}>✓ Paid</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={{ alignItems: "flex-end", gap: 5 }}>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>
                  {formatCurrency(Number(item.total))}
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
            icon="receipt"
            title={search || filter !== "all" ? "No invoices found" : "No invoices yet"}
            subtitle={
              search || filter !== "all"
                ? "Try clearing filters or search"
                : "Invoices are generated from completed orders"
            }
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
