import React from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { Badge, Card, Divider } from "@/components/ui";
import { MEASUREMENT_FIELDS } from "@/constants/products";
import { formatDate } from "@/utils/storage";
import colors from "@/constants/colors";

export default function MeasurementDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { measurements, deleteMeasurement, customers } = useData();
  const measurement = measurements.find((m) => m.id === id);

  const topPad = Platform.OS === "web" ? 67 : 0;

  if (!measurement) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>Not found</Text>
      </View>
    );
  }

  function handleDelete() {
    Alert.alert("Delete Measurement", "Delete this measurement record?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteMeasurement(measurement!.id);
          router.back();
        },
      },
    ]);
  }

  const filledFields = MEASUREMENT_FIELDS.filter(
    (f) => (measurement as any)[f.key] !== undefined
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + topPad + 16,
          paddingHorizontal: 20,
          paddingBottom: 24,
          backgroundColor: "#6366F1",
          gap: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 8 }}>
            <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" }}>
            Measurement
          </Text>
          <Pressable onPress={handleDelete} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 8 }}>
            <MaterialIcons name="delete" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
            {measurement.customerName}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Badge label={measurement.productType} variant="secondary" />
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" }}>
              {formatDate(measurement.date)}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ padding: 20, gap: 16 }}>
        {/* Measurements */}
        <Card>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
            Measurements (inches)
          </Text>
          {filledFields.length === 0 ? (
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
              No measurements recorded
            </Text>
          ) : (
            <View style={{ gap: 0 }}>
              {filledFields.map((field, idx) => (
                <React.Fragment key={field.key}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                      {field.label}
                    </Text>
                    <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>
                      {(measurement as any)[field.key]}"
                    </Text>
                  </View>
                  {idx < filledFields.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </View>
          )}
        </Card>

        {/* Custom measurements */}
        {measurement.customMeasurements?.length > 0 && (
          <Card>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
              Custom
            </Text>
            <View style={{ gap: 0 }}>
              {measurement.customMeasurements.map((m, idx) => (
                <React.Fragment key={m.label}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>{m.label}</Text>
                    <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>{m.value}"</Text>
                  </View>
                  {idx < measurement.customMeasurements.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </View>
          </Card>
        )}

        {/* Notes */}
        {measurement.notes && (
          <Card>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Notes
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.foreground }}>
              {measurement.notes}
            </Text>
          </Card>
        )}

        {/* Create invoice from this measurement */}
        <Pressable
          onPress={() => {
            const cust = customers.find((cu) => cu.id === measurement.customerId);
            if (cust) {
              router.push({
                pathname: "/invoices/new",
                params: { customerId: cust.id, customerName: cust.name, customerMobile: cust.mobile, measurementId: measurement.id, productType: measurement.productType },
              });
            }
          }}
          style={({ pressed }) => ({
            backgroundColor: c.primary,
            borderRadius: colors.radius,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <MaterialIcons name="receipt" size={20} color={c.primaryForeground} />
          <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.primaryForeground }}>
            Create Invoice for this Measurement
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
