import React, { useMemo, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { CustomerItem, InvoiceItem } from "@/components/ListItems";
import { formatCurrency, formatDate } from "@/utils/storage";
import colors from "@/constants/colors";
import { useTranslation } from "@/utils/i18n";

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
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  /**
   * Live search across customers. We match on name OR mobile (digits
   * only, so "9898" still hits "989-898-1234"). Returns up to 5
   * results, sorted by recency.
   */
  const trimmedQuery = searchQuery.trim();
  const searchResults = useMemo(() => {
    if (!trimmedQuery) return [];
    const q = trimmedQuery.toLowerCase();
    const qDigits = trimmedQuery.replace(/\D/g, "");
    return customers
      .filter((cust) => {
        if (cust.name.toLowerCase().includes(q)) return true;
        if (qDigits.length > 0 && cust.mobile.replace(/\D/g, "").includes(qDigits)) return true;
        return false;
      })
      .slice(0, 5);
  }, [trimmedQuery, customers]);
  const showSearchDropdown = trimmedQuery.length > 0;

  function addNewCustomer() {
    // Send the typed query to the new-customer screen so it can prefill
    // the name or mobile field.
    const q = encodeURIComponent(trimmedQuery);
    router.push(`/customers/new?q=${q}` as any);
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
      keyboardShouldPersistTaps="handled"
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginBottom: 2 }}>
              {today}
            </Text>
            <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
              {t("dashboard.welcome", { name: user?.name?.split(" ")[0] ?? "" })}
            </Text>
            {user?.shopName ? (
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", marginTop: 1 }}>
                {user.shopName}
              </Text>
            ) : null}
          </View>

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
        </View>

        {/* ── Global search bar ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#FFFFFF",
            borderRadius: 14,
            paddingHorizontal: 14,
            height: 48,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 10,
            elevation: 4,
            marginBottom: 20,
          }}
        >
          <MaterialIcons name="search" size={20} color={c.mutedForeground} />
          <TextInput
            style={{
              flex: 1,
              fontSize: 15,
              fontFamily: "Inter_400Regular",
              color: c.foreground,
              paddingVertical: 0,
              marginLeft: 10,
            }}
            placeholder={t("dashboard.searchPlaceholder")}
            placeholderTextColor={c.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <MaterialIcons name="close" size={18} color={c.mutedForeground} />
            </Pressable>
          )}
        </View>

        {/* Live search dropdown — overlayed on the hero, sits above the
            revenue card. Only shows while the user is actively typing.
            Behavior:
            - matching customers → list + "Add New Customer" button
            - no matches       → "No customer found" message + button */}
        {showSearchDropdown && (
          <View
            style={{
              position: "absolute",
              left: 22,
              right: 22,
              top: insets.top + topPad + 20 + 18 + 22 + 48 + 8, // below the search bar
              backgroundColor: c.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: c.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.15,
              shadowRadius: 14,
              elevation: 8,
              zIndex: 50,
              overflow: "hidden",
            }}
          >
            {searchResults.length > 0 ? (
              <>
                {/* Result list */}
                {searchResults.map((cust, idx) => (
                  <Pressable
                    key={cust.id}
                    onPress={() => {
                      setSearchQuery("");
                      router.push(`/customers/${cust.id}` as any);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      backgroundColor: pressed ? c.muted : "transparent",
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: c.border,
                    })}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: c.primary + "18",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.primary }}>
                        {cust.name?.charAt(0)?.toUpperCase() ?? "?"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }} numberOfLines={1}>
                        {cust.name}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }} numberOfLines={1}>
                        {cust.mobile}
                      </Text>
                    </View>
                    <MaterialIcons name="north-west" size={16} color={c.mutedForeground} />
                  </Pressable>
                ))}

                {/* "Add New Customer" button — always shown in the
                    results state so the user can add a new one without
                    clearing the search first. */}
                <Pressable
                  onPress={addNewCustomer}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 12,
                    backgroundColor: pressed ? c.primary : c.primary,
                    borderTopWidth: 1,
                    borderTopColor: c.border,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <MaterialIcons name="person-add" size={18} color="#FFFFFF" />
                  <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" }}>
                    {t("dashboard.searchAddNew")}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                {/* No-match state — explicit "No customer found" message */}
                <View
                  style={{
                    paddingVertical: 20,
                    paddingHorizontal: 16,
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: c.muted,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialIcons name="search-off" size={22} color={c.mutedForeground} />
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: "Inter_700Bold",
                      color: c.foreground,
                      textAlign: "center",
                    }}
                  >
                    {t("dashboard.searchNoResults")}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Inter_400Regular",
                      color: c.mutedForeground,
                      textAlign: "center",
                    }}
                  >
                    {t("dashboard.searchNoResultsHint", { query: trimmedQuery })}
                  </Text>
                </View>

                {/* "Add New Customer" CTA — pre-fills the new-customer
                    form with the typed query (mobile or name) */}
                <Pressable
                  onPress={addNewCustomer}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 12,
                    backgroundColor: c.primary,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <MaterialIcons name="person-add" size={18} color="#FFFFFF" />
                  <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" }}>
                    {t("dashboard.searchAddNew")}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}

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
            {t("dashboard.totalRevenue")}
          </Text>
          <Text style={{ fontSize: 34, fontFamily: "Inter_700Bold", color: "#FFFFFF", marginBottom: 14 }}>
            {formatCurrency(totalRevenue)}
          </Text>
          <View style={{ flexDirection: "row", gap: 20 }}>
            <View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" }}>{t("dashboard.pending")}</Text>
              <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FCD34D" }}>
                {formatCurrency(pendingRevenue)}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
            <View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" }}>{t("dashboard.completed")}</Text>
              <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#6EE7E7" }}>
                {t("dashboard.paidCount", { count: completedCount })}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
            <View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" }}>{t("dashboard.customers")}</Text>
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
          { icon: "people" as const, label: t("dashboard.stats.customers"), value: customers.length, color: "#6366F1" },
          { icon: "straighten" as const, label: t("dashboard.stats.measurements"), value: measurements.length, color: "#F59E0B" },
          { icon: "receipt" as const, label: t("dashboard.stats.pending"), value: pendingCount, color: "#EF4444" },
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
          {t("dashboard.quickActions")}
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
            label={t("dashboard.addCustomer")}
            color="#6366F1"
            onPress={() => router.push("/customers/new")}
          />
          <QuickAction
            icon="receipt"
            label={t("dashboard.newInvoice")}
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
              {pendingCount > 1
                ? t("dashboard.pendingInvoicePlural", { count: pendingCount })
                : t("dashboard.pendingInvoice", { count: pendingCount })}
            </Text>
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#B45309" }}>
              {t("dashboard.awaitingCollection", { amount: formatCurrency(pendingRevenue) })}
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
              {t("dashboard.recentCustomers")}
            </Text>
            <Pressable onPress={() => router.push("/(tabs)/customers")}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.primary }}>{t("dashboard.seeAll")}</Text>
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
            <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>{t("dashboard.recentInvoices")}</Text>
            <Pressable onPress={() => router.push("/(tabs)/invoices")}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.primary }}>{t("dashboard.seeAll")}</Text>
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
            {t("dashboard.startFirstOrder")}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, textAlign: "center", lineHeight: 20 }}>
            {t("dashboard.startFirstOrderHint")}
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
              {t("dashboard.addFirstCustomer")}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
