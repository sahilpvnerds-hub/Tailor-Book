import React, { useMemo, useState } from "react";
import { FlatList, Platform, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { InvoiceItem } from "@/components/ListItems";
import { EmptyState } from "@/components/ui";
import colors from "@/constants/colors";

export default function InvoicesScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { invoices } = useData();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  const filtered = useMemo(
    () =>
      invoices
        .filter(
          (i) =>
            (filter === "all" || i.status === filter) &&
            (i.customerName.toLowerCase().includes(search.toLowerCase()) ||
              i.invoiceNumber.toLowerCase().includes(search.toLowerCase()))
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [invoices, search, filter]
  );

  const topPad = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
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
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: c.foreground }}>Invoices</Text>
          <Pressable
            onPress={() => router.push("/invoices/new")}
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
            placeholder="Search by name or invoice..."
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
          {(["all", "pending", "completed"] as const).map((f) => (
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
                  textTransform: "capitalize",
                }}
              >
                {f}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InvoiceItem invoice={item} onPress={() => router.push(`/invoices/${item.id}` as any)} />
        )}
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
            subtitle="Create an invoice for a customer order"
            action={!search && filter === "all" ? { label: "Create Invoice", onPress: () => router.push("/invoices/new") } : undefined}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
