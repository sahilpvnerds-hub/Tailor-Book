import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { formatDate } from "@/utils/storage";
import colors from "@/constants/colors";
import { Notification } from "@/types";

// ── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<
  Notification["type"],
  { icon: keyof typeof MaterialIcons.glyphMap; color: string; bg: string; label: string }
> = {
  delivery_overdue:    { icon: "warning",       color: "#DC2626", bg: "#FEE2E2", label: "OVERDUE" },
  delivery_due_today:  { icon: "schedule",       color: "#D97706", bg: "#FEF3C7", label: "TODAY" },
  delivery_due_tomorrow: { icon: "event",        color: "#2563EB", bg: "#DBEAFE", label: "TOMORROW" },
  pending_invoice:     { icon: "receipt-long",   color: "#7C3AED", bg: "#EDE9FE", label: "PAYMENT" },
  general:             { icon: "notifications",  color: "#0D6E6E", bg: "#D1EDED", label: "INFO" },
};

// ── Countdown label ───────────────────────────────────────────────────────────
function getCountdownLabel(notif: Notification): string | null {
  const isDelivery =
    notif.type === "delivery_due_today" ||
    notif.type === "delivery_due_tomorrow" ||
    notif.type === "delivery_overdue";
  if (!isDelivery || !notif.deliveryDate) return null;

  const deliveryMs = new Date(notif.deliveryDate).setHours(0, 0, 0, 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const diffDays = Math.round((deliveryMs - todayStart.getTime()) / 86_400_000);

  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return n === 1 ? "Overdue by 1 Day" : `Overdue by ${n} Days`;
  }
  if (diffDays === 0) {
    const hoursLeft = Math.ceil((new Date(notif.deliveryDate).setHours(23, 59, 59, 999) - Date.now()) / 3_600_000);
    return hoursLeft <= 0 ? "Due Today" : hoursLeft === 1 ? "Due in 1 Hour" : `Due in ${hoursLeft} Hours`;
  }
  if (diffDays === 1) return "Due Tomorrow";
  return `Due in ${diffDays} Days`;
}

function getCountdownStyle(label: string): { bg: string; text: string } {
  if (label.startsWith("Overdue"))  return { bg: "#FEE2E2", text: "#DC2626" };
  if (label.includes("Hour") || label === "Due Today") return { bg: "#FEF3C7", text: "#D97706" };
  return { bg: "#DBEAFE", text: "#2563EB" };
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", paddingTop: 80, gap: 14, paddingHorizontal: 32 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" }}>
        <MaterialIcons name="notifications-none" size={40} color={c.mutedForeground} />
      </View>
      <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: c.foreground }}>All caught up!</Text>
      <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, textAlign: "center", lineHeight: 20 }}>
        Delivery reminders and payment alerts will appear here automatically.
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { notifications, markNotificationRead, markAllRead } = useData();
  const topPad = Platform.OS === "web" ? 67 : 0;

  const unread = notifications.filter((n) => !n.isRead).length;

  // Sort: unread first, then by date
  const sorted = [...notifications].sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  function handlePress(notif: Notification) {
    markNotificationRead(notif.id);
    // Navigate to invoice if linked
    if (notif.invoiceId) {
      router.push(`/invoices/${notif.invoiceId}` as any);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>

      {/* ── Header ── */}
      <View
        style={{
          paddingTop: insets.top + topPad + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: c.card,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={{ backgroundColor: c.muted, borderRadius: 10, padding: 8 }}>
            <MaterialIcons name="arrow-back" size={20} color={c.foreground} />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>Notifications</Text>
          {unread > 0 && (
            <View style={{ backgroundColor: "#EF4444", borderRadius: 12, minWidth: 24, height: 24, alignItems: "center", justifyContent: "center", paddingHorizontal: 7 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>{unread}</Text>
            </View>
          )}
          {unread > 0 && (
            <Pressable onPress={markAllRead} hitSlop={8} style={{ backgroundColor: c.muted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.primary }}>Mark all read</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {sorted.length === 0 ? (
          <EmptyState />
        ) : (
          sorted.map((notif) => {
            const tc = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.general;
            const countdown = getCountdownLabel(notif);
            const pillStyle = countdown ? getCountdownStyle(countdown) : null;
            const hasOrderInfo = !!notif.invoiceId;

            return (
              <Pressable
                key={notif.id}
                onPress={() => handlePress(notif)}
                style={({ pressed }) => ({
                  backgroundColor: notif.isRead ? c.card : c.primary + "08",
                  borderRadius: colors.radius + 2,
                  borderWidth: 1,
                  borderColor: notif.isRead ? c.border : c.primary + "30",
                  overflow: "hidden",
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                {/* Coloured left accent bar */}
                <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: tc.color }} />

                <View style={{ padding: 14, paddingLeft: 18, gap: 10 }}>

                  {/* Top row: icon + title + badge + unread dot */}
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tc.bg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <MaterialIcons name={tc.icon} size={20} color={tc.color} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ flex: 1, fontSize: 14, fontFamily: notif.isRead ? "Inter_600SemiBold" : "Inter_700Bold", color: c.foreground }}>
                          {notif.title}
                        </Text>
                        {/* Type badge */}
                        <View style={{ backgroundColor: tc.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: tc.color, letterSpacing: 0.5 }}>
                            {tc.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                        {formatDate(notif.createdAt)}
                      </Text>
                    </View>
                    {!notif.isRead && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", marginTop: 4, flexShrink: 0 }} />
                    )}
                  </View>

                  {/* ── Order details card (if linked to invoice) ── */}
                  {hasOrderInfo && (
                    <View
                      style={{
                        backgroundColor: c.muted,
                        borderRadius: colors.radius,
                        padding: 12,
                        gap: 8,
                        borderWidth: 1,
                        borderColor: c.border,
                      }}
                    >
                      {/* Order number row */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <MaterialIcons name="receipt" size={14} color={tc.color} />
                        <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: tc.color }}>
                          Order #{notif.invoiceNumber}
                        </Text>
                      </View>

                      {/* Customer row */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <MaterialIcons name="person" size={14} color={c.mutedForeground} />
                        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                          {notif.customerName}
                        </Text>
                        {notif.customerMobile && (
                          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                            · {notif.customerMobile}
                          </Text>
                        )}
                      </View>

                      {/* Item types chips */}
                      {notif.itemTypes && notif.itemTypes.length > 0 && (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                          {notif.itemTypes.map((item, idx) => (
                            <View
                              key={idx}
                              style={{
                                backgroundColor: tc.color + "15",
                                borderRadius: 6,
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderWidth: 1,
                                borderColor: tc.color + "30",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <MaterialIcons name="checkroom" size={11} color={tc.color} />
                              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: tc.color }}>
                                {item}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Delivery date */}
                      {notif.deliveryDate && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <MaterialIcons name="event" size={14} color={c.mutedForeground} />
                          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                            Delivery: {formatDate(notif.deliveryDate)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Fallback message (no invoice link) */}
                  {!hasOrderInfo && (
                    <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, lineHeight: 18 }}>
                      {notif.message}
                    </Text>
                  )}

                  {/* Bottom row: countdown pill + tap hint */}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    {countdown && pillStyle ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: pillStyle.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <MaterialIcons name="timer" size={12} color={pillStyle.text} />
                        <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: pillStyle.text }}>
                          {countdown}
                        </Text>
                      </View>
                    ) : <View />}

                    {hasOrderInfo && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.primary }}>View Order</Text>
                        <MaterialIcons name="arrow-forward" size={12} color={c.primary} />
                      </View>
                    )}
                  </View>

                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
