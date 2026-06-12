import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import colors from "@/constants/colors";
import { Badge } from "./ui";
import { Customer, Invoice, Measurement } from "@/types";
import { formatCurrency, formatDate } from "@/utils/storage";

// --- CustomerItem ---
interface CustomerItemProps {
  customer: Customer;
  onPress: () => void;
  measurementCount?: number;
}

export function CustomerItem({ customer, onPress, measurementCount = 0 }: CustomerItemProps) {
  const c = useColors();
  const initials = customer.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.card,
          borderRadius: colors.radius,
          padding: 14,
          gap: 12,
          borderWidth: 1,
          borderColor: c.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: c.primary + "20",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: c.primary }}>
          {initials}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
          {customer.name}
        </Text>
        <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 1 }}>
          {customer.mobile}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
          {measurementCount} measurements
        </Text>
        <MaterialIcons name="chevron-right" size={18} color={c.mutedForeground} />
      </View>
    </Pressable>
  );
}

// --- MeasurementItem ---
interface MeasurementItemProps {
  measurement: Measurement;
  onPress: () => void;
}

export function MeasurementItem({ measurement, onPress }: MeasurementItemProps) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.card,
          borderRadius: colors.radius,
          padding: 14,
          gap: 12,
          borderWidth: 1,
          borderColor: c.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: colors.radius,
          backgroundColor: "#6366F120",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name="straighten" size={22} color="#6366F1" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
          {measurement.customerName}
        </Text>
        <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 1 }}>
          {measurement.productType} · {formatDate(measurement.date)}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={18} color={c.mutedForeground} />
    </Pressable>
  );
}

// --- InvoiceItem ---
interface InvoiceItemProps {
  invoice: Invoice;
  onPress: () => void;
}

const statusVariant = (status: Invoice["status"]) => {
  switch (status) {
    case "completed": return "success" as const;
    case "cancelled": return "destructive" as const;
    default: return "warning" as const;
  }
};

const statusLabel = (status: Invoice["status"]) => {
  switch (status) {
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    default: return "Pending";
  }
};

export function InvoiceItem({ invoice, onPress }: InvoiceItemProps) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.card,
          borderRadius: colors.radius,
          padding: 14,
          gap: 12,
          borderWidth: 1,
          borderColor: c.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: colors.radius,
          backgroundColor: "#059669" + "20",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name="receipt" size={22} color="#059669" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
          {invoice.customerName}
        </Text>
        <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 1 }}>
          {invoice.invoiceNumber} · {formatDate(invoice.createdAt)}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.foreground }}>
          {formatCurrency(invoice.total)}
        </Text>
        <Badge label={statusLabel(invoice.status)} variant={statusVariant(invoice.status)} />
      </View>
    </Pressable>
  );
}
