import React from "react";
import { Text, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

export type AdminStatus = "approved" | "pending" | "rejected" | "suspended";
export type OrderStatus = "pending" | "partially-delivered" | "completed" | "cancelled";

interface PillConfig {
  bg: string;
  fg: string;
  label: string;
  /** Small dot shown to the left of the label. */
  dot: string;
}

/** Look up the visual config for a given status. Falls back to "pending" style. */
function configFor(status: string, c: ReturnType<typeof useColors>): PillConfig {
  switch (status) {
    case "approved":
    case "completed":
      return { bg: c.success, fg: c.successForeground, label: status === "completed" ? "Paid" : "Approved", dot: c.success };
    case "pending":
      return { bg: c.warning, fg: c.warningForeground, label: "Pending", dot: c.warning };
    case "partially-delivered":
      return { bg: "#EDE9FE", fg: "#7C3AED", label: "Partial", dot: "#7C3AED" };
    case "rejected":
    case "cancelled":
      return { bg: c.destructive, fg: c.destructiveForeground, label: status === "cancelled" ? "Cancelled" : "Rejected", dot: c.destructive };
    case "suspended":
      return { bg: c.muted, fg: c.mutedForeground, label: "Suspended", dot: c.mutedForeground };
    default:
      return { bg: c.muted, fg: c.mutedForeground, label: status, dot: c.mutedForeground };
  }
}

interface StatusPillProps {
  status: string;
  size?: "sm" | "md";
  style?: ViewStyle;
}

/**
 * Shared status badge. Use the `size` prop to switch between the compact
 * 10px chip used in tables and the slightly larger 11px version used in
 * card headers.
 */
export function StatusPill({ status, size = "sm", style }: StatusPillProps) {
  const c = useColors();
  const v = configFor(status, c);
  const fontSize = size === "md" ? 11 : 10;
  const padV = size === "md" ? 4 : 2;
  const padH = size === "md" ? 10 : 8;
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          paddingHorizontal: padH,
          paddingVertical: padV,
          borderRadius: 999,
          backgroundColor: v.bg,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: v.fg,
          marginRight: 6,
          opacity: 0.85,
        }}
      />
      <Text style={{ color: v.fg, fontSize, fontWeight: "700", letterSpacing: 0.2 }}>
        {v.label}
      </Text>
    </View>
  );
}
