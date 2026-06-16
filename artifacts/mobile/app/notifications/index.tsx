import React from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { formatDate } from "@/utils/storage";
import colors from "@/constants/colors";
import { Notification } from "@/types";

const TYPE_CONFIG: Record<Notification["type"], { icon: keyof typeof MaterialIcons.glyphMap; color: string; bg: string }> = {
  delivery_due_today: { icon: "schedule", color: "#DC2626", bg: "#FEE2E2" },
  delivery_due_tomorrow: { icon: "event", color: "#D97706", bg: "#FEF3C7" },
  pending_invoice: { icon: "receipt", color: "#2563EB", bg: "#DBEAFE" },
  general: { icon: "notifications", color: "#0D6E6E", bg: "#D1EDED" },
};

export default function NotificationsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { notifications, markNotificationRead, markAllRead } = useData();
  const topPad = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + topPad + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: c.card,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ backgroundColor: c.muted, borderRadius: 10, padding: 8 }}
        >
          <MaterialIcons name="arrow-back" size={20} color={c.foreground} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
          Notifications
        </Text>
        {notifications.some((n) => !n.isRead) && (
          <Pressable onPress={markAllRead}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.primary }}>
              Mark all read
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 10,
          paddingBottom: insets.bottom + 30,
        }}
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", paddingTop: 60, gap: 12 }}>
            <MaterialIcons name="notifications-none" size={48} color={c.mutedForeground} />
            <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: c.mutedForeground }}>
              No notifications
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, textAlign: "center" }}>
              You're all caught up! Notifications about deliveries and pending payments will appear here.
            </Text>
          </View>
        ) : (
          notifications.map((notif) => {
            const tc = TYPE_CONFIG[notif.type];
            return (
              <Pressable
                key={notif.id}
                onPress={() => markNotificationRead(notif.id)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "flex-start",
                  backgroundColor: notif.isRead ? c.card : c.primary + "08",
                  borderRadius: colors.radius,
                  padding: 14,
                  gap: 12,
                  borderWidth: 1,
                  borderColor: notif.isRead ? c.border : c.primary + "25",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 13,
                    backgroundColor: tc.bg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialIcons name={tc.icon} size={20} color={tc.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: notif.isRead ? "Inter_500Medium" : "Inter_700Bold",
                      color: c.foreground,
                    }}
                  >
                    {notif.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: "Inter_400Regular",
                      color: c.mutedForeground,
                      marginTop: 2,
                      lineHeight: 18,
                    }}
                  >
                    {notif.message}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Inter_400Regular",
                      color: c.mutedForeground,
                      marginTop: 4,
                    }}
                  >
                    {formatDate(notif.createdAt)}
                  </Text>
                </View>
                {!notif.isRead && (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: c.primary,
                      marginTop: 5,
                    }}
                  />
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
