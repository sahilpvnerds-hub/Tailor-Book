import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";

interface NavItem {
  label: string;
  href: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  /** When set, a small badge is shown in the sidebar (e.g. pending approvals). */
  badge?: number;
  /** Optional sub-section title rendered above the item. */
  section?: string;
}

interface SidebarProps {
  userName: string;
  userEmail: string;
  pendingCount: number;
  onLogout: () => void;
}

const NAV: NavItem[] = [
  { label: "Overview", href: "/admin", icon: "dashboard", section: "GENERAL" },
  { label: "Tailors", href: "/admin/tailors", icon: "store", section: "OPERATIONS" },
  { label: "Pending Approvals", href: "/admin/tailors/pending", icon: "pending-actions", badge: 0 /* filled in by parent */ },
  { label: "Customers", href: "/admin/customers", icon: "people", section: "CATALOG" },
  { label: "Orders", href: "/admin/orders", icon: "shopping-bag" },
  { label: "Invoices", href: "/admin/invoices", icon: "receipt-long" },
];

export function Sidebar({ userName, userEmail, pendingCount, onLogout }: SidebarProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname() ?? "";

  // Inject the live pending badge
  const items: NavItem[] = NAV.map((n) =>
    n.href === "/admin/tailors/pending" ? { ...n, badge: pendingCount } : n,
  );

  return (
    <View
      style={{
        width: 252,
        backgroundColor: c.card,
        borderRightWidth: 1,
        borderRightColor: c.border,
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 16,
        paddingHorizontal: 14,
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flex: 1 }}>
        {/* Brand — gradient logo */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, marginBottom: 28 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: c.primary,
              alignItems: "center",
              justifyContent: "center",
              // Subtle gradient via overlay tint
              shadowColor: c.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 4,
              borderWidth: 1,
              borderColor: c.accent,
            }}
          >
            <MaterialIcons name="admin-panel-settings" size={22} color={c.primaryForeground} />
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: c.foreground, letterSpacing: -0.2 }}>
              Tailor Book
            </Text>
            <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "500", letterSpacing: 0.3 }}>
              Admin Console
            </Text>
          </View>
        </View>

        {/* Nav with section sub-headers */}
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {items.map((item, idx) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname.startsWith(item.href);
            const prevSection = idx > 0 ? items[idx - 1].section : undefined;
            const showSection = item.section && item.section !== prevSection;

            return (
              <View key={item.href}>
                {showSection ? (
                  <Text
                    style={{
                      fontSize: 10,
                      color: c.mutedForeground,
                      fontWeight: "700",
                      letterSpacing: 1,
                      paddingHorizontal: 10,
                      marginTop: 16,
                      marginBottom: 6,
                    }}
                  >
                    {item.section}
                  </Text>
                ) : null}

                <Pressable
                  onPress={() => router.push(item.href as any)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 9,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    marginBottom: 2,
                    backgroundColor: isActive
                      ? c.primary
                      : pressed
                      ? c.muted
                      : "transparent",
                  })}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={18}
                    color={isActive ? c.primaryForeground : c.mutedForeground}
                  />
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: 12,
                      fontSize: 13,
                      fontWeight: isActive ? "700" : "500",
                      color: isActive ? c.primaryForeground : c.foreground,
                    }}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {item.badge && item.badge > 0 ? (
                    <View
                      style={{
                        minWidth: 20,
                        height: 20,
                        borderRadius: 10,
                        paddingHorizontal: 6,
                        backgroundColor: isActive ? c.primaryForeground : c.warning,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: isActive ? c.primary : c.warningForeground,
                          fontSize: 10,
                          fontWeight: "800",
                        }}
                      >
                        {item.badge}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* User card + logout */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: c.border,
          paddingTop: 12,
          marginTop: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 6,
            paddingVertical: 8,
            marginBottom: 6,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: c.secondary,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: c.primary }}>
              {userName?.charAt(0).toUpperCase() ?? "A"}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, fontWeight: "700", color: c.foreground }}
            >
              {userName}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 4,
                  backgroundColor: c.primary,
                  marginRight: 6,
                }}
              >
                <Text style={{ color: c.primaryForeground, fontSize: 9, fontWeight: "800", letterSpacing: 0.4 }}>
                  ADMIN
                </Text>
              </View>
              <Text numberOfLines={1} style={{ fontSize: 10, color: c.mutedForeground, flex: 1 }}>
                {userEmail}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={onLogout}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: pressed ? c.muted : "transparent",
          })}
        >
          <MaterialIcons name="logout" size={18} color={c.destructive} />
          <Text style={{ marginLeft: 12, fontSize: 13, color: c.destructive, fontWeight: "600" }}>
            Logout
          </Text>
        </Pressable>
      </View>
    </View>
  );
}