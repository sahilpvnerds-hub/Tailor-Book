import React, { useEffect, useState } from "react";
import {
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
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { StatCard, SectionHeader } from "@/components/ui";
import { CustomerItem, InvoiceItem, MeasurementItem } from "@/components/ListItems";
import { formatCurrency, formatDate } from "@/utils/storage";
import colors from "@/constants/colors";

export default function DashboardScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { customers, measurements, invoices, isLoading, refresh } = useData();
  const [refreshing, setRefreshing] = useState(false);

  const totalRevenue = invoices
    .filter((i) => i.status === "completed")
    .reduce((s, i) => s + i.total, 0);

  const pendingInvoices = invoices.filter((i) => i.status === "pending");
  const recentCustomers = [...customers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const recentInvoices = [...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const topPad = Platform.OS === "web" ? 67 : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + topPad + 16,
          paddingHorizontal: 20,
          paddingBottom: 20,
          backgroundColor: c.primary,
        }}
      >
        <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.primaryForeground + "CC" }}>
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" })}
        </Text>
        <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: c.primaryForeground, marginTop: 2 }}>
          Welcome back, {user?.name?.split(" ")[0]}
        </Text>
        {user?.shopName && (
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.primaryForeground + "BB", marginTop: 3 }}>
            {user.shopName}
          </Text>
        )}

        {/* Quick actions */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
          {[
            { icon: "person-add" as const, label: "Add Customer", route: "/customers/new" },
            { icon: "straighten" as const, label: "Measure", route: "/measurements/new" },
            { icon: "receipt" as const, label: "Invoice", route: "/invoices/new" },
          ].map((a) => (
            <Pressable
              key={a.route}
              onPress={() => router.push(a.route as any)}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: colors.radius,
                padding: 12,
                alignItems: "center",
                gap: 6,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <MaterialIcons name={a.icon} size={22} color={c.primaryForeground} />
              <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.primaryForeground, textAlign: "center" }}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ padding: 20, gap: 24 }}>
        {/* Stats */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <StatCard label="Customers" value={customers.length} icon="people" color="#6366F1" />
            <StatCard label="Measurements" value={measurements.length} icon="straighten" color="#F59E0B" />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <StatCard label="Total Invoices" value={invoices.length} icon="receipt" color="#059669" />
            <StatCard label="Revenue" value={formatCurrency(totalRevenue)} icon="currency-rupee" color="#1C1C7D" />
          </View>
        </View>

        {/* Pending invoices alert */}
        {pendingInvoices.length > 0 && (
          <Pressable
            onPress={() => router.push("/(tabs)/invoices")}
            style={{
              backgroundColor: "#FEF3C7",
              borderRadius: colors.radius,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              borderWidth: 1,
              borderColor: "#FDE68A",
            }}
          >
            <MaterialIcons name="notifications" size={20} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#92400E" }}>
                {pendingInvoices.length} pending {pendingInvoices.length === 1 ? "invoice" : "invoices"}
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#92400E" }}>
                Tap to view and update status
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color="#92400E" />
          </Pressable>
        )}

        {/* Recent customers */}
        {recentCustomers.length > 0 && (
          <View>
            <SectionHeader
              title="Recent Customers"
              action={{ label: "View all", onPress: () => router.push("/(tabs)/customers") }}
            />
            <View style={{ gap: 8 }}>
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

        {/* Recent invoices */}
        {recentInvoices.length > 0 && (
          <View>
            <SectionHeader
              title="Recent Invoices"
              action={{ label: "View all", onPress: () => router.push("/(tabs)/invoices") }}
            />
            <View style={{ gap: 8 }}>
              {recentInvoices.map((inv) => (
                <InvoiceItem
                  key={inv.id}
                  invoice={inv}
                  onPress={() => router.push(`/invoices/${inv.id}` as any)}
                />
              ))}
            </View>
          </View>
        )}

        {customers.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 32, gap: 12 }}>
            <View style={{ backgroundColor: c.muted, borderRadius: 40, padding: 16 }}>
              <MaterialIcons name="people" size={36} color={c.mutedForeground} />
            </View>
            <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
              Start by adding a customer
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, textAlign: "center" }}>
              Add your first customer to begin managing measurements and invoices.
            </Text>
            <Pressable
              onPress={() => router.push("/customers/new")}
              style={{ backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 11, borderRadius: colors.radius, marginTop: 4 }}
            >
              <Text style={{ color: c.primaryForeground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
                Add First Customer
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
