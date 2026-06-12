import React, { useMemo, useState } from "react";
import { FlatList, Platform, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { MeasurementItem } from "@/components/ListItems";
import { EmptyState } from "@/components/ui";
import colors from "@/constants/colors";

export default function MeasurementsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { measurements } = useData();
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      measurements
        .filter(
          (m) =>
            m.customerName.toLowerCase().includes(search.toLowerCase()) ||
            m.productType.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [measurements, search]
  );

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
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MeasurementItem
            measurement={item}
            onPress={() => router.push(`/measurements/${item.id}` as any)}
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
            icon="straighten"
            title={search ? "No results found" : "No measurements yet"}
            subtitle={search ? "Try a different search" : "Record measurements for your customers"}
            action={!search ? { label: "Add Measurement", onPress: () => router.push("/measurements/new") } : undefined}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
