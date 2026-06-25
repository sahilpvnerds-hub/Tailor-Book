import React from "react";
import { Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  /** Tints the left accent bar and the icon chip. */
  accent?: string;
  /**
   * Optional two-stat micro row shown at the bottom of the card.
   * Each entry is `[label, value]`. Stretches to fill the bottom row.
   */
  breakdown?: [string, string | number][];
  /** Optional trend chip (e.g. "+12% this week"). */
  trend?: {
    value: number;
    label: string;
  };
}

/**
 * Hero stat card. Stripe-style:
 *   - 4px colored left bar (the `accent` color)
 *   - 44px rounded icon chip tinted with the same accent
 *   - Big 30px number
 *   - Optional trend chip with arrow
 *   - Optional breakdown row at the bottom
 */
export function StatCard({ label, value, sublabel, icon, accent, breakdown, trend }: StatCardProps) {
  const c = useColors();
  const tint = accent ?? c.primary;

  const trendColor =
    trend == null
      ? c.mutedForeground
      : trend.value > 0
      ? c.success
      : trend.value < 0
      ? c.destructive
      : c.mutedForeground;

  const trendIcon: keyof typeof MaterialIcons.glyphMap =
    trend == null
      ? "remove"
      : trend.value > 0
      ? "trending-up"
      : trend.value < 0
      ? "trending-down"
      : "remove";

  return (
    <View
      style={{
        flex: 1,
        minWidth: 220,
        backgroundColor: c.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: c.border,
        padding: 0,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        overflow: "hidden",
        flexDirection: "row",
      }}
    >
      {/* Colored left bar */}
      <View style={{ width: 4, backgroundColor: tint }} />

      <View style={{ flex: 1, padding: 18 }}>
        {/* Top row: icon + label */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
          {icon ? (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: c.secondary,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <MaterialIcons name={icon} size={22} color={tint} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 11,
                color: c.mutedForeground,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              {label}
            </Text>
            {sublabel ? (
              <Text
                style={{ fontSize: 11, color: c.mutedForeground, marginTop: 2 }}
                numberOfLines={1}
              >
                {sublabel}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Value + trend */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
          <Text style={{ fontSize: 30, fontWeight: "800", color: c.foreground, lineHeight: 34 }}>
            {value}
          </Text>
          {trend ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 4,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: c.muted,
              }}
            >
              <MaterialIcons name={trendIcon} size={12} color={trendColor} />
              <Text style={{ marginLeft: 3, fontSize: 11, fontWeight: "700", color: trendColor }}>
                {trend.value > 0 ? "+" : ""}
                {trend.value}%
              </Text>
            </View>
          ) : null}
        </View>

        {/* Optional breakdown row */}
        {breakdown && breakdown.length > 0 ? (
          <View
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: c.border,
              flexDirection: "row",
              gap: 16,
            }}
          >
            {breakdown.map(([k, v], i) => (
              <View key={i} style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: c.mutedForeground, textTransform: "uppercase", fontWeight: "600" }}>
                  {k}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: c.foreground, marginTop: 2 }}>
                  {v}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
