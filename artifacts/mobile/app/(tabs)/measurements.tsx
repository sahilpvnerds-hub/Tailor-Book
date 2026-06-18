import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { EmptyState } from "@/components/ui";
import { formatDate } from "@/utils/storage";
import colors from "@/constants/colors";

const RELATION_FILTERS = ["all", "self", "wife", "son", "daughter"] as const;
const DEFAULT_PRODUCT_FILTERS = ["Shirt", "Pant", "Blazer", "Kurta", "Lehenga"];

function titleCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

export default function MeasurementsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { measurements, familyMembers, customers, productTypes } = useData();
  const [search, setSearch] = useState("");
  const [relationFilter, setRelationFilter] = useState<(typeof RELATION_FILTERS)[number]>("all");
  const [productFilter, setProductFilter] = useState("all");

  const productFilters = useMemo(() => {
    const names = new Set([...DEFAULT_PRODUCT_FILTERS, ...productTypes.map((p) => p.name), ...measurements.map((m) => m.productType)]);
    return ["all", ...Array.from(names).filter(Boolean).sort((a, b) => a.localeCompare(b))];
  }, [measurements, productTypes]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, {
      key: string;
      customerName: string;
      personName: string;
      relation: string;
      items: typeof measurements;
      latest: string;
    }>();

    for (const m of measurements) {
      const member = m.familyMemberId ? familyMembers.find((fm) => fm.id === m.familyMemberId) : undefined;
      const customer = customers.find((cu) => cu.id === m.customerId);
      const relation = member?.relation ?? "self";
      const personName = member?.name ?? m.familyMemberName ?? customer?.name ?? m.customerName;
      if (relationFilter !== "all" && relation !== relationFilter) continue;
      if (productFilter !== "all" && m.productType !== productFilter) continue;
      if (
        q &&
        !m.customerName.toLowerCase().includes(q) &&
        !personName.toLowerCase().includes(q) &&
        !m.productType.toLowerCase().includes(q)
      ) continue;

      const key = `${m.customerId}:${m.familyMemberId ?? "self"}`;
      const existing = map.get(key) ?? {
        key,
        customerName: m.customerName,
        personName,
        relation,
        items: [],
        latest: "",
      };
      existing.items.push(m);
      if (m.createdAt > existing.latest) existing.latest = m.createdAt;
      map.set(key, existing);
    }

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }))
      .sort((a, b) => b.latest.localeCompare(a.latest));
  }, [customers, familyMembers, measurements, productFilter, relationFilter, search]);

  const topPad = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View
        style={{
          paddingTop: insets.top + topPad + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: c.card,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: c.foreground }}>
            Measurements
          </Text>
          <Pressable
            onPress={() => router.push("/measurements/new")}
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
            placeholder="Search by customer or product..."
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {RELATION_FILTERS.map((filter) => {
            const selected = relationFilter === filter;
            return (
              <Pressable
                key={filter}
                onPress={() => setRelationFilter(filter)}
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: selected ? c.primary : c.muted, borderWidth: 1, borderColor: selected ? c.primary : c.border }}
              >
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: selected ? c.primaryForeground : c.mutedForeground }}>
                  {filter === "all" ? "All" : titleCase(filter)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {productFilters.map((filter) => {
            const selected = productFilter === filter;
            return (
              <Pressable
                key={filter}
                onPress={() => setProductFilter(filter)}
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: selected ? c.primary : c.card, borderWidth: 1, borderColor: selected ? c.primary : c.border }}
              >
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: selected ? c.primaryForeground : c.mutedForeground }}>
                  {filter === "all" ? "All Products" : filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, flexGrow: 1, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {grouped.length === 0 ? (
          <EmptyState
            icon="straighten"
            title={search || relationFilter !== "all" || productFilter !== "all" ? "No results found" : "No measurements yet"}
            subtitle={search ? "Try a different search" : "Record measurements for your customers"}
            action={!search && relationFilter === "all" && productFilter === "all" ? { label: "Add Measurement", onPress: () => router.push("/measurements/new") } : undefined}
          />
        ) : (
          grouped.map((group) => (
            <View key={group.key} style={{ backgroundColor: c.card, borderRadius: colors.radius, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
              <View style={{ padding: 14, backgroundColor: c.primary + "10", flexDirection: "row", alignItems: "center", gap: 10 }}>
                <MaterialIcons name="person" size={18} color={c.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.foreground }}>
                    {group.personName} ({titleCase(group.relation)})
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                    Customer: {group.customerName}
                  </Text>
                </View>
              </View>
              {group.items.map((item, idx) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/measurements/${item.id}` as any)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    backgroundColor: pressed ? c.muted : c.card,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: c.border,
                  })}
                >
                  <MaterialIcons name="straighten" size={18} color={c.mutedForeground} />
                  <Text style={{ flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                    {item.productType}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                    {formatDate(item.date ?? item.measurementDate ?? item.createdAt)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
