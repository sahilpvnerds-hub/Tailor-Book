import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { CustomerItem } from "@/components/ListItems";
import { EmptyState } from "@/components/ui";
import colors from "@/constants/colors";

export default function CustomersScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { customers, measurements } = useData();
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      customers.filter(
        (cu) =>
          cu.name.toLowerCase().includes(search.toLowerCase()) ||
          cu.mobile.includes(search)
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [customers, search]
  );

  const topPad = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Header */}
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
            Customers
          </Text>
          <Pressable
            onPress={() => router.push("/customers/new")}
            style={{ backgroundColor: c.primary, borderRadius: 10, padding: 8 }}
          >
            <MaterialIcons name="person-add" size={20} color={c.primaryForeground} />
          </Pressable>
        </View>
        {/* Search */}
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
            placeholder="Search by name or mobile..."
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
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CustomerItem
            customer={item}
            onPress={() => router.push(`/customers/${item.id}` as any)}
            measurementCount={measurements.filter((m) => m.customerId === item.id).length}
          />
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
            icon="people"
            title={search ? "No results found" : "No customers yet"}
            subtitle={search ? "Try a different search term" : "Add your first customer to get started"}
            action={!search ? { label: "Add Customer", onPress: () => router.push("/customers/new") } : undefined}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
