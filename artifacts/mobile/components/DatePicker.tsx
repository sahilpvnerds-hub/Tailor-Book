import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import colors from "@/constants/colors";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYMD(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  return isNaN(d.getTime()) ? null : d;
}

function formatDisplay(s: string): string {
  const d = parseYMD(s);
  if (!d) return s;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  // Returns a 6x7 grid starting on Sunday.
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: (Date | null)[] = [];

  // Leading days from previous month
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push(new Date(year, month - 1, daysInPrevMonth - i));
  }
  // Days in current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  // Trailing days from next month
  while (cells.length < 42) {
    const last = cells[cells.length - 1]!;
    cells.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }
  return cells;
}

export function DatePicker({ value, onChange, label, placeholder = "Select date" }: DatePickerProps) {
  const c = useColors();
  const [open, setOpen] = useState(false);

  const initial = useMemo(() => parseYMD(value) ?? new Date(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setView] = useState<{ year: number; month: number }>({
    year: initial.getFullYear(),
    month: initial.getMonth(),
  });

  useEffect(() => {
    if (open) {
      const d = parseYMD(value) ?? new Date();
      setView({ year: d.getFullYear(), month: d.getMonth() });
    }
  }, [open, value]);

  const today = new Date();
  const selected = parseYMD(value);
  const cells = useMemo(() => buildMonthGrid(view.year, view.month), [view]);

  function selectDate(d: Date) {
    const ymd = formatYMD(d);
    onChange(ymd);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <View style={{ gap: 5 }}>
      {label && (
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Inter_600SemiBold",
            color: c.mutedForeground,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Text>
      )}
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.input,
          borderRadius: colors.radius,
          borderWidth: 1.5,
          borderColor: c.border,
          paddingHorizontal: 14,
          paddingVertical: 12,
          gap: 10,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <MaterialIcons name="calendar-today" size={18} color={c.mutedForeground} />
        <Text
          style={{
            flex: 1,
            fontSize: 15,
            fontFamily: "Inter_400Regular",
            color: value ? c.foreground : c.mutedForeground,
          }}
        >
          {value ? formatDisplay(value) : placeholder}
        </Text>
        <MaterialIcons name="chevron-right" size={18} color={c.mutedForeground} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: c.overlay,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 380,
              backgroundColor: c.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: c.border,
              padding: 18,
              gap: 14,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.18,
              shadowRadius: 18,
              elevation: 8,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Pressable
                onPress={() => shiftMonth(-1)}
                style={({ pressed }) => ({
                  padding: 6,
                  borderRadius: 8,
                  backgroundColor: c.muted,
                  opacity: pressed ? 0.7 : 1,
                })}
                hitSlop={8}
              >
                <MaterialIcons name="chevron-left" size={20} color={c.foreground} />
              </Pressable>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Inter_700Bold",
                  color: c.foreground,
                }}
              >
                {MONTH_NAMES[view.month]} {view.year}
              </Text>
              <Pressable
                onPress={() => shiftMonth(1)}
                style={({ pressed }) => ({
                  padding: 6,
                  borderRadius: 8,
                  backgroundColor: c.muted,
                  opacity: pressed ? 0.7 : 1,
                })}
                hitSlop={8}
              >
                <MaterialIcons name="chevron-right" size={20} color={c.foreground} />
              </Pressable>
            </View>

            {/* Weekday header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {WEEKDAYS.map((d, i) => (
                <View
                  key={`${d}-${i}`}
                  style={{ width: 36, alignItems: "center", paddingVertical: 4 }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Inter_500Medium",
                      color: c.mutedForeground,
                    }}
                  >
                    {d}
                  </Text>
                </View>
              ))}
            </View>

            {/* Day grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {cells.map((d, idx) => {
                if (!d) return <View key={idx} style={{ width: "14.2857%", aspectRatio: 1 }} />;
                const inMonth = d.getMonth() === view.month;
                const isToday = isSameDay(d, today);
                const isSelected = !!selected && isSameDay(d, selected);
                return (
                  <View
                    key={idx}
                    style={{
                      width: "14.2857%",
                      aspectRatio: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 2,
                    }}
                  >
                    <Pressable
                      onPress={() => selectDate(d)}
                      style={({ pressed }) => ({
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isSelected
                          ? c.primary
                          : isToday
                            ? c.accent
                            : "transparent",
                        opacity: pressed ? 0.7 : inMonth ? 1 : 0.35,
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: isSelected || isToday
                            ? "Inter_700Bold"
                            : "Inter_400Regular",
                          color: isSelected
                            ? c.primaryForeground
                            : isToday
                              ? c.primary
                              : c.foreground,
                        }}
                      >
                        {d.getDate()}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* Footer */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <Pressable
                onPress={() => selectDate(today)}
                style={({ pressed }) => ({
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Inter_600SemiBold",
                    color: c.primary,
                  }}
                >
                  Today
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setOpen(false)}
                style={({ pressed }) => ({
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Inter_500Medium",
                    color: c.mutedForeground,
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
