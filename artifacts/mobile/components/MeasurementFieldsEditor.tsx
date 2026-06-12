import React, { useCallback, useEffect, useRef } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { MEASUREMENT_FIELDS, MeasurementKey } from "@/constants/products";
import { Measurement } from "@/types";
import colors from "@/constants/colors";

interface Props {
  productType: string;
  // The latest saved measurement for this customer + product, if any.
  sourceMeasurement: Measurement | undefined;
  // Current values, keyed by MEASUREMENT_FIELDS key. String values so the user
  // can clear/type freely.
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  // Customer id (used for debug logging)
  customerId: string;
}

/**
 * Editor for measurement fields for a single invoice item.
 *
 * Auto-fill contract:
 *  - When `productType` changes, the parent re-fetches the latest saved
 *    `Measurement` for (customerId, productType) and passes it as
 *    `sourceMeasurement`. The parent decides whether to overwrite the values
 *    (only when the user has not manually touched them).
 *  - This component itself never overwrites values. It only renders the
 *    values it was given and bubbles user edits via `onChange`. That keeps
 *    the auto-fill policy in a single place (the parent screen) and avoids
 *    the useEffect loop that would come from re-applying the source here.
 */
export function MeasurementFieldsEditor({
  productType,
  sourceMeasurement,
  values,
  onChange,
  customerId,
}: Props) {
  const c = useColors();
  // Log whenever the source measurement changes so we can verify auto-fill
  // picks up the right record in dev tools.
  const lastSourceIdRef = useRef<string | undefined>(undefined);
  const logAutoFill = useCallback(() => {
    if (!sourceMeasurement) {
      console.log(
        `[AutoFill] customer=${customerId} product=${productType} → no saved measurement; fields remain empty`,
      );
      return;
    }
    if (lastSourceIdRef.current === sourceMeasurement.id) return;
    lastSourceIdRef.current = sourceMeasurement.id;
    const loaded: Record<string, number> = {};
    for (const f of MEASUREMENT_FIELDS) {
      const v = (sourceMeasurement as any)[f.key];
      if (typeof v === "number") loaded[f.key] = v;
    }
    console.log(
      `[AutoFill] customer=${customerId} product=${productType} measurementId=${sourceMeasurement.id} values=${JSON.stringify(loaded)}`,
    );
  }, [customerId, productType, sourceMeasurement]);
  useEffect(() => {
    logAutoFill();
  }, [logAutoFill]);

  const filledCount = MEASUREMENT_FIELDS.filter((f) => values[f.key]?.length).length;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Inter_600SemiBold",
            color: c.mutedForeground,
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Measurements ({productType})
        </Text>
        {filledCount > 0 && (
          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
            {filledCount}/{MEASUREMENT_FIELDS.length} filled
          </Text>
        )}
      </View>
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: colors.radius,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        {MEASUREMENT_FIELDS.map((field, idx) => {
          const raw = values[field.key] ?? "";
          const isFilled = raw.length > 0;
          return (
            <View key={field.key}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  backgroundColor: isFilled ? c.primary + "08" : "transparent",
                }}
              >
                <View style={{ width: 110 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: isFilled ? "Inter_600SemiBold" : "Inter_400Regular",
                      color: isFilled ? c.primary : c.foreground,
                    }}
                  >
                    {field.label}
                  </Text>
                </View>
                <TextInput
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontFamily: "Inter_600SemiBold",
                    color: c.foreground,
                    backgroundColor: c.input,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: isFilled ? c.primary + "60" : c.border,
                  }}
                  placeholder="—"
                  placeholderTextColor={c.mutedForeground}
                  value={raw}
                  onChangeText={(v) => onChange(field.key, v)}
                  keyboardType="decimal-pad"
                />

                {sourceMeasurement && (sourceMeasurement as any)[field.key] != null && (
                  <Pressable
                    onPress={() => onChange(field.key, String((sourceMeasurement as any)[field.key]))}
                    style={{
                      marginLeft: 6,
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: c.muted,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    hitSlop={6}
                  >
                    <MaterialIcons name="arrow-downward" size={14} color={c.mutedForeground} />
                  </Pressable>
                )}
              </View>
              {idx < MEASUREMENT_FIELDS.length - 1 && (
                <View style={{ height: 1, backgroundColor: c.border, marginLeft: 14 }} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
