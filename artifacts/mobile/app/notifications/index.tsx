import React, { useState } from "react";
import {
  Alert,
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
import { useTranslation } from "@/utils/i18n";

// ── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<
  Notification["type"],
  { icon: keyof typeof MaterialIcons.glyphMap; color: string; bg: string; labelKey: string }
> = {
  delivery_overdue:    { icon: "warning",       color: "#DC2626", bg: "#FEE2E2", labelKey: "notifications.types.delivery_overdue" },
  delivery_due_today:  { icon: "schedule",       color: "#D97706", bg: "#FEF3C7", labelKey: "notifications.types.delivery_due_today" },
  delivery_due_tomorrow: { icon: "event",        color: "#2563EB", bg: "#DBEAFE", labelKey: "notifications.types.delivery_due_tomorrow" },
  pending_invoice:     { icon: "receipt-long",   color: "#7C3AED", bg: "#EDE9FE", labelKey: "notifications.types.pending_invoice" },
  general:             { icon: "notifications",  color: "#0D6E6E", bg: "#D1EDED", labelKey: "notifications.types.general" },
};

// ── Countdown label ───────────────────────────────────────────────────────────
function getCountdownLabel(notif: Notification, t: (k: string, p?: any) => string): string | null {
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
    return n === 1 ? t("notif.overdueByDay") : t("notif.overdueByDays", { count: n });
  }
  if (diffDays === 0) {
    const hoursLeft = Math.ceil((new Date(notif.deliveryDate).setHours(23, 59, 59, 999) - Date.now()) / 3_600_000);
    return hoursLeft <= 0
      ? t("notif.dueToday")
      : hoursLeft === 1
        ? t("notif.dueInHour")
        : t("notif.dueInHours", { count: hoursLeft });
  }
  if (diffDays === 1) return t("notif.dueTomorrow");
  return t("notif.dueInDays", { count: diffDays });
}

function getCountdownStyle(label: string): { bg: string; text: string } {
  if (label.startsWith("Overdue") || label.includes("मोड") || label.includes("देर") || label.includes("મોડું"))  return { bg: "#FEE2E2", text: "#DC2626" };
  if (label.includes("Hour") || label.includes("घंटे") || label.includes("કલાક") || label === "Due Today" || label.includes("आज") || label.includes("આજે")) return { bg: "#FEF3C7", text: "#D97706" };
  return { bg: "#DBEAFE", text: "#2563EB" };
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", paddingTop: 80, gap: 14, paddingHorizontal: 32 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" }}>
        <MaterialIcons name="notifications-none" size={40} color={c.mutedForeground} />
      </View>
      <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: c.foreground }}>{title}</Text>
      <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, textAlign: "center", lineHeight: 20 }}>
        {subtitle}
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { notifications, customers, markNotificationRead, markAllRead, clearAllNotifications } = useData();
  const { t } = useTranslation();
  const topPad = Platform.OS === "web" ? 67 : 0;

  const unread = notifications.filter((n) => !n.isRead).length;

  // Sort: unread first, then by date
  const sorted = [...notifications].sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  /**
   * Look up the customer record attached to a notification by name +
   * mobile. Notifications store `customerName` / `customerMobile` but
   * not the id, so we find the matching customer at tap time.
   */
  function findCustomerForNotif(notif: Notification): { id: string } | null {
    if (!notif.customerName && !notif.customerMobile) return null;
    const name = notif.customerName?.trim().toLowerCase() ?? "";
    const mobileDigits = (notif.customerMobile ?? "").replace(/\D/g, "");
    return (
      customers.find((c) => {
        if (name && c.name.trim().toLowerCase() === name) return true;
        if (mobileDigits && c.mobile.replace(/\D/g, "") === mobileDigits) return true;
        return false;
      }) ?? null
    );
  }

  /**
   * Tap a notification — show an action sheet of context-aware options.
   * The actions are derived from what data the notification carries,
   * so e.g. an "order due today" alert offers to open the order, start
   * a new invoice for that customer, or jump to the customer profile.
   */
  function handlePress(notif: Notification) {
    markNotificationRead(notif.id);
    const customer = findCustomerForNotif(notif);

    Alert.alert(
      "Pending Payment",
      "What would you like to do?",
      [
        {
          text: "Dismiss",
          style: "cancel",
        },
        {
          text: "View Order Invoice",
          onPress: () => {
            if (notif.invoiceId) {
              router.push(`/invoices/${notif.invoiceId}` as any);
            } else {
              router.push("/invoices" as any);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }

  function confirmClearAll() {
    // Find every notification type currently in the list — those are
    // the categories the user wants gone. If they choose "Clear &
    // don't show again", we mute all of them so they don't reappear.
    const presentTypes = Array.from(new Set(notifications.map((n) => n.type)));
    Alert.alert(t("notif.clearAll.title"), t("notif.clearAll.message"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("notif.clearAll.confirm"), style: "destructive", onPress: () => clearAllNotifications() },
      {
        text: t("notif.clearAll.confirmAndMute"),
        style: "destructive",
        onPress: () => clearAllNotifications({ muteTypes: presentTypes }),
      },
    ]);
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
          <Text style={{ flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>{t("notifications.title")}</Text>
          {unread > 0 && (
            <View style={{ backgroundColor: "#EF4444", borderRadius: 12, minWidth: 24, height: 24, alignItems: "center", justifyContent: "center", paddingHorizontal: 7 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>{unread}</Text>
            </View>
          )}
        </View>

        {/* ── Action row: Mark All Read + Clear All ── */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {notifications.length > 0 && (
            <Pressable onPress={markAllRead} hitSlop={8} style={{ backgroundColor: c.muted, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MaterialIcons name="done-all" size={14} color={c.primary} />
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.primary }}>{t("notifications.markAllRead")}</Text>
            </Pressable>
          )}
          {notifications.length > 0 && (
            <Pressable onPress={confirmClearAll} hitSlop={8} style={{ backgroundColor: c.muted, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MaterialIcons name="delete-outline" size={14} color={c.destructive} />
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.destructive }}>{t("notifications.clearAll")}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {sorted.length === 0 ? (
          <EmptyState title={t("notif.empty.title")} subtitle={t("notif.empty.subtitle")} />
        ) : (
          sorted.map((notif) => {
            const tc = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.general;
            const countdown = getCountdownLabel(notif, t);
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
                            {t(tc.labelKey).toUpperCase()}
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
                          {t("notif.orderPrefix")}{notif.invoiceNumber}
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
                            {t("notif.deliveryPrefix")} {formatDate(notif.deliveryDate)}
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
                        <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.primary }}>{t("notif.viewOrder")}</Text>
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
