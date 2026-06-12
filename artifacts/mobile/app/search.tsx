import React, { useMemo, useState } from "react";
import { FlatList, Platform, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { CustomerItem, InvoiceItem, MeasurementItem } from "@/components/ListItems";
import colors from "@/constants/colors";

export default function SearchScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { customers, measurements, invoices } = useData();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return { customers: [], measurements: [], invoices: [] };
    const q = query.toLowerCase();
    return {
      customers: customers.filter((c) => c.name.toLowerCase().includes(q) || c.mobile.includes(q)).slice(0, 5),
      measurements: measurements.filter((m) => m.customerName.toLowerCase().includes(q) || m.productType.toLowerCase().includes(q)).slice(0, 5),
      invoices: invoices.filter((i) => i.customerName.toLowerCase().includes(q) || i.invoiceNumber.toLowerCase().includes(q)).slice(0, 5),
    };
  }, [query, customers, measurements, invoices]);

  const hasResults = results.customers.length > 0 || results.measurements.length > 0 || results.invoices.length > 0;
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
          gap: 14,
        }}
      >
        <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: c.foreground }}>Search</Text>
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
          <MaterialIcons name="search" size={20} color={c.mutedForeground} />
          <TextInput
            style={{ flex: 1, fontSize: 16, fontFamily: "Inter_400Regular", color: c.foreground, paddingVertical: 12 }}
            placeholder="Search customers, invoices..."
            placeholderTextColor={c.mutedForeground}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")}>
              <MaterialIcons name="close" size={18} color={c.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={[]}
        keyExtractor={() => ""}
        renderItem={() => null}
        ListHeaderComponent={
          !query.trim() ? (
            <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
              <View style={{ backgroundColor: c.muted, borderRadius: 40, padding: 20 }}>
                <MaterialIcons name="search" size={40} color={c.mutedForeground} />
              </View>
              <Text style={{ fontSize: 16, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
                Search across all records
              </Text>
            </View>
          ) : !hasResults ? (
            <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
              <MaterialIcons name="search-off" size={40} color={c.mutedForeground} />
              <Text style={{ fontSize: 16, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
                No results for "{query}"
              </Text>
            </View>
          ) : (
            <View style={{ gap: 20 }}>
              {results.customers.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Customers
                  </Text>
                  {results.customers.map((cust) => (
                    <CustomerItem
                      key={cust.id}
                      customer={cust}
                      onPress={() => router.push(`/customers/${cust.id}` as any)}
                    />
                  ))}
                </View>
              )}
              {results.measurements.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Measurements
                  </Text>
                  {results.measurements.map((m) => (
                    <MeasurementItem
                      key={m.id}
                      measurement={m}
                      onPress={() => router.push(`/measurements/${m.id}` as any)}
                    />
                  ))}
                </View>
              )}
              {results.invoices.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Invoices
                  </Text>
                  {results.invoices.map((inv) => (
                    <InvoiceItem
                      key={inv.id}
                      invoice={inv}
                      onPress={() => router.push(`/invoices/${inv.id}` as any)}
                    />
                  ))}
                </View>
              )}
            </View>
          )
        }
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
