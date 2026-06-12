import React from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import colors from "@/constants/colors";
import { Badge } from "./ui";
import { Customer, Invoice, Measurement } from "@/types";
import { formatCurrency, formatDate } from "@/utils/storage";

// ── CustomerItem ──────────────────────────────────────────────────────────────
interface CustomerItemProps {
  customer: Customer;
  onPress: () => void;
  measurementCount?: number;
}

export function CustomerItem({
  customer,
  onPress,
  measurementCount = 0,
}: CustomerItemProps) {
  const c = useColors();
  const initials = customer.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: c.card,
        borderRadius: colors.radius,
        padding: 14,
        gap: 12,
        borderWidth: 1,
        borderColor: c.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
        opacity: pressed ? 0.88 : 1,
      })}
    >
      {/* Avatar */}
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          backgroundColor: c.primary + "18",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: c.primary + "25",
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontFamily: "Inter_700Bold",
            color: c.primary,
          }}
        >
          {initials}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontFamily: "Inter_600SemiBold",
            color: c.foreground,
          }}
        >
          {customer.name}
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontFamily: "Inter_400Regular",
            color: c.mutedForeground,
            marginTop: 1,
          }}
        >
          {customer.mobile}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", gap: 5 }}>
        {measurementCount > 0 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: c.secondary,
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 3,
            }}
          >
            <MaterialIcons name="straighten" size={11} color={c.primary} />
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Inter_600SemiBold",
                color: c.primary,
              }}
            >
              {measurementCount}
            </Text>
          </View>
        )}
        <MaterialIcons name="chevron-right" size={18} color={c.mutedForeground} />
      </View>
    </Pressable>
  );
}

// ── MeasurementItem ───────────────────────────────────────────────────────────
interface MeasurementItemProps {
  measurement: Measurement;
  onPress: () => void;
}

export function MeasurementItem({ measurement, onPress }: MeasurementItemProps) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: c.card,
        borderRadius: colors.radius,
        padding: 14,
        gap: 12,
        borderWidth: 1,
        borderColor: c.border,
        opacity: pressed ? 0.88 : 1,
      })}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          backgroundColor: "#6366F118",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "#6366F125",
        }}
      >
        <MaterialIcons name="straighten" size={22} color="#6366F1" />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontFamily: "Inter_600SemiBold",
            color: c.foreground,
          }}
        >
          {measurement.customerName}
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Inter_400Regular",
            color: c.mutedForeground,
            marginTop: 1,
          }}
        >
          {measurement.productType} · {formatDate(measurement.date)}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={18} color={c.mutedForeground} />
    </Pressable>
  );
}

// ── InvoiceItem ───────────────────────────────────────────────────────────────
interface InvoiceItemProps {
  invoice: Invoice;
  onPress: () => void;
}

const statusConfig = {
  completed: {
    variant: "success" as const,
    label: "Paid",
    color: "#059669",
    bg: "#D1FAE5",
  },
  cancelled: {
    variant: "destructive" as const,
    label: "Cancelled",
    color: "#DC2626",
    bg: "#FEE2E2",
  },
  pending: {
    variant: "warning" as const,
    label: "Pending",
    color: "#D97706",
    bg: "#FEF3C7",
  },
};

export function InvoiceItem({ invoice, onPress }: InvoiceItemProps) {
  const c = useColors();
  const sc = statusConfig[invoice.status];

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: c.card,
        borderRadius: colors.radius,
        padding: 14,
        gap: 12,
        borderWidth: 1,
        borderColor: c.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
        opacity: pressed ? 0.88 : 1,
      })}
    >
      {/* Icon */}
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          backgroundColor: sc.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name="receipt" size={22} color={sc.color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontFamily: "Inter_600SemiBold",
            color: c.foreground,
          }}
        >
          {invoice.customerName}
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Inter_400Regular",
            color: c.mutedForeground,
            marginTop: 1,
          }}
        >
          {invoice.invoiceNumber} · {formatDate(invoice.createdAt)}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", gap: 5 }}>
        <Text
          style={{
            fontSize: 16,
            fontFamily: "Inter_700Bold",
            color: c.foreground,
          }}
        >
          {formatCurrency(invoice.total)}
        </Text>
        <Badge label={sc.label} variant={sc.variant} />
      </View>
    </Pressable>
  );
}
