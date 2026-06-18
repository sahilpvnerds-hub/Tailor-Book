import React, { useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { CustomerItem, InvoiceItem } from "@/components/ListItems";
import { formatCurrency, formatDate } from "@/utils/storage";
import colors from "@/constants/colors";

function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        gap: 8,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          backgroundColor: color + "18",
          borderWidth: 1.5,
          borderColor: color + "30",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name={icon} size={24} color={color} />
      </View>
      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.mutedForeground, textAlign: "center" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { customers, measurements, invoices, unreadCount, refresh } = useData();
  const [refreshing, setRefreshing] = useState(false);

  const totalRevenue = invoices.filter((i) => i.status === "completed").reduce((s, i) => s + i.total, 0);
  const pendingRevenue = invoices.filter((i) => i.status === "pending").reduce((s, i) => s + i.total, 0);
  const completedCount = invoices.filter((i) => i.status === "completed").length;
  const pendingCount = invoices.filter((i) => i.status === "pending").length;

  const recentCustomers = [...customers].slice(0, 3);
  const recentInvoices = [...invoices].slice(0, 4);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const topPad = Platform.OS === "web" ? 67 : 0;
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Header */}
      <View
        style={{
          backgroundColor: c.primary,
          paddingTop: insets.top + topPad + 20,
          paddingHorizontal: 22,
          paddingBottom: 32,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginBottom: 2 }}>
              {today}
            </Text>
            <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
              Hi, {user?.name?.split(" ")[0]}
            </Text>
            {user?.shopName ? (
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", marginTop: 1 }}>
                {user.shopName}
              </Text>
            ) : null}
          </View>

          {/* Header action buttons: Notification → Search */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {/* Notification bell */}
            <Pressable
              onPress={() => router.push("/notifications")}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.18)",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <MaterialIcons name="notifications" size={20} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: 5,
                    right: 5,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: "#EF4444",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1.5,
                    borderColor: c.primary,
                  }}
                >
                  <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Search icon */}
            <Pressable
              onPress={() => router.push("/search" as any)}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.18)",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <MaterialIcons name="search" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Revenue card */}
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.13)",
            borderRadius: 18,
            padding: 20,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.18)",
          }}
        >
          <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>
            Total Revenue
          </Text>
          <Text style={{ fontSize: 34, fontFamily: "Inter_700Bold", color: "#FFFFFF", marginBottom: 14 }}>
            {formatCurrency(totalRevenue)}
          </Text>
          <View style={{ flexDirection: "row", gap: 20 }}>
            <View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" }}>Pending</Text>
              <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FCD34D" }}>
                {formatCurrency(pendingRevenue)}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
            <View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" }}>Completed</Text>
              <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#6EE7E7" }}>
                {completedCount} paid
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
            <View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" }}>Customers</Text>
              <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" }}>
                {customers.length}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats pills */}
      <View style={{ flexDirection: "row", marginHorizontal: 22, marginTop: -20, gap: 10 }}>
        {[
          { icon: "people" as const, label: "Customers", value: customers.length, color: "#6366F1" },
          { icon: "straighten" as const, label: "Measurements", value: measurements.length, color: "#F59E0B" },
          { icon: "receipt" as const, label: "Pending", value: pendingCount, color: "#EF4444" },
        ].map((s) => (
          <View
            key={s.label}
            style={{
              flex: 1,
              backgroundColor: c.card,
              borderRadius: 16,
              padding: 14,
              alignItems: "center",
              gap: 6,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 4,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: s.color + "18", alignItems: "center", justifyContent: "center" }}>
              <MaterialIcons name={s.icon} size={18} color={s.color} />
            </View>
            <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: c.foreground }}>{s.value}</Text>
            <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: c.mutedForeground, textAlign: "center" }}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Quick Actions — Customer + Invoice only */}
      <View style={{ marginHorizontal: 22, marginTop: 24 }}>
        <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground, marginBottom: 14 }}>
          Quick Actions
        </Text>
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 18,
            padding: 18,
            flexDirection: "row",
            borderWidth: 1,
            borderColor: c.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <QuickAction
            icon="person-add"
            label="Add Customer"
            color="#6366F1"
            onPress={() => router.push("/customers/new")}
          />
          <QuickAction
            icon="receipt"
            label="New Invoice"
            color="#059669"
            onPress={() => router.push("/invoices/new")}
          />
        </View>
      </View>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <Pressable
          onPress={() => router.push("/(tabs)/invoices")}
          style={({ pressed }) => ({
            marginHorizontal: 22,
            marginTop: 18,
            backgroundColor: "#FEF3C7",
            borderRadius: 14,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 1,
            borderColor: "#FDE68A",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#FDE68A", alignItems: "center", justifyContent: "center" }}>
            <MaterialIcons name="schedule" size={18} color="#92400E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#92400E" }}>
              {pendingCount} pending invoice{pendingCount > 1 ? "s" : ""}
            </Text>
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#B45309" }}>
              {formatCurrency(pendingRevenue)} awaiting collection
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={18} color="#92400E" />
        </Pressable>
      )}

      {/* Recent Customers */}
      {recentCustomers.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 22, marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>
              Recent Customers
            </Text>
            <Pressable onPress={() => router.push("/(tabs)/customers")}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.primary }}>See all</Text>
            </Pressable>
          </View>
          <View style={{ marginHorizontal: 22, gap: 8 }}>
            {recentCustomers.map((cust) => (
              <CustomerItem
                key={cust.id}
                customer={cust}
                onPress={() => router.push(`/customers/${cust.id}` as any)}
                measurementCount={measurements.filter((m) => m.customerId === cust.id).length}
              />
            ))}
          </View>
        </View>
      )}

      {/* Recent Invoices */}
      {recentInvoices.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 22, marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>Recent Invoices</Text>
            <Pressable onPress={() => router.push("/(tabs)/invoices")}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.primary }}>See all</Text>
            </Pressable>
          </View>
          <View style={{ marginHorizontal: 22, gap: 8 }}>
            {recentInvoices.map((inv) => (
              <InvoiceItem key={inv.id} invoice={inv} onPress={() => router.push(`/invoices/${inv.id}` as any)} />
            ))}
          </View>
        </View>
      )}

      {/* Empty state */}
      {customers.length === 0 && (
        <View
          style={{
            marginHorizontal: 22,
            marginTop: 28,
            backgroundColor: c.card,
            borderRadius: 18,
            padding: 28,
            alignItems: "center",
            gap: 12,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.primary + "18", alignItems: "center", justifyContent: "center" }}>
            <MaterialIcons name="people" size={32} color={c.primary} />
          </View>
          <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: c.foreground, textAlign: "center" }}>
            Start your first order
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, textAlign: "center", lineHeight: 20 }}>
            Add a customer, record their measurements, and create an invoice.
          </Text>
          <Pressable
            onPress={() => router.push("/customers/new")}
            style={({ pressed }) => ({
              backgroundColor: c.primary,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: colors.radius,
              marginTop: 4,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
              Add First Customer
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
