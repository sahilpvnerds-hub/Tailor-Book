import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Sidebar } from "@/components/admin/Sidebar";
import { PageHeader, type Crumb } from "@/components/admin/PageHeader";

/**
 * Admin console layout. Two-column desktop shell:
 *  - Sidebar (252px) on the left with navigation + admin profile
 *  - PageHeader + scrollable main area on the right
 *
 * Collapses to a stacked topbar + main layout below 900px so the same code
 * works on tablet/phones. Tailor app is unaffected — this layout is only
 * active under /admin/*.
 */
export default function AdminLayout() {
  const { user, ready } = useAdminGuard();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const auth = useAuth();

  const handleLogout = useCallback(async () => {
    await auth.logout();
    router.replace("/(auth)/login");
  }, [auth, router]);

  if (!ready) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  const meta = pageMeta(pathname, user?.name);

  return (
    <View style={[styles.flex, { flexDirection: isWide ? "row" : "column", backgroundColor: c.background }]}>
      {isWide ? (
        <Sidebar
          userName={user?.name ?? "Admin"}
          userEmail={user?.email ?? ""}
          onLogout={handleLogout}
        />
      ) : null}

      <View style={styles.flex}>
        {/* Mobile topbar (no sidebar) — collapses to compact title bar */}
        {!isWide ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingTop: insets.top + 12,
              paddingBottom: 12,
              backgroundColor: c.card,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
              gap: 10,
            }}
          >
            <Pressable
              onPress={() => router.push("/admin" as any)}
              style={{ padding: 6 }}
              hitSlop={8}
            >
              <MaterialIcons name="menu" size={22} color={c.foreground} />
            </Pressable>
            <Text
              numberOfLines={1}
              style={{ fontSize: 16, fontWeight: "700", color: c.foreground, flex: 1 }}
            >
              {meta.title}
            </Text>
          </View>
        ) : null}

        {/* Stacked mobile nav (only when sidebar is hidden) */}
        {!isWide ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
            style={{ backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border }}
          >
            {mobileTabs.map((t) => {
              const active = t.match(pathname);
              return (
                <Pressable
                  key={t.href}
                  onPress={() => router.push(t.href as any)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: active ? c.secondary : pressed ? c.muted : "transparent",
                  })}
                >
                  <MaterialIcons name={t.icon} size={16} color={active ? c.primary : c.mutedForeground} />
                  <Text
                    style={{
                      marginLeft: 6,
                      fontSize: 12,
                      fontWeight: active ? "700" : "500",
                      color: active ? c.foreground : c.mutedForeground,
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Wide screens: render the polished PageHeader chrome (fixed at top) */}
        {isWide ? (
          <View style={{ backgroundColor: c.background }}>
            <PageHeader
              title={meta.title}
              subtitle={meta.subtitle}
              crumbs={meta.crumbs}
              actions={meta.actions(router, handleLogout)}
            />
          </View>
        ) : null}

        {/* Content area: the Stack renders the page-specific child. The
            `key={pathname}` re-mounts the active screen on every navigation,
            which resets the page's own ScrollView back to y=0 — the desired
            "scroll to top on navigation" behavior. */}
        <Stack
          key={pathname}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.background, flex: 1 },
            animation: "fade",
          }}
        />
      </View>
    </View>
  );
}

const mobileTabs = [
  { label: "Overview", href: "/admin", icon: "dashboard" as const, match: (p: string) => p === "/admin" || p === "/admin/" },
  { label: "Tailors", href: "/admin/tailors", icon: "store" as const, match: (p: string) => p.startsWith("/admin/tailors") },
  { label: "Products", href: "/admin/products", icon: "local-offer" as const, match: (p: string) => p.startsWith("/admin/products") },
  { label: "Customers", href: "/admin/customers", icon: "people" as const, match: (p: string) => p.startsWith("/admin/customers") },
  { label: "Orders", href: "/admin/orders", icon: "shopping-bag" as const, match: (p: string) => p.startsWith("/admin/orders") },
  { label: "Invoices", href: "/admin/invoices", icon: "receipt-long" as const, match: (p: string) => p.startsWith("/admin/invoices") },
];

interface PageMeta {
  title: string;
  subtitle?: string;
  crumbs: Crumb[];
  actions: (
    router: ReturnType<typeof useRouter>,
    onLogout: () => void,
  ) => import("@/components/admin/PageHeader").PageAction[];
}

/**
 * Derive the page chrome from the pathname. Single source of truth so every
 * admin page renders the same breadcrumb + title + actions pattern.
 */
function pageMeta(pathname: string, userName?: string): PageMeta {
  const rootCrumbs: Crumb[] = [{ label: "Admin", href: "/admin" }];

  // Overview
  if (pathname === "/admin" || pathname === "/admin/") {
    return {
      title: "Overview",
      subtitle: `Welcome back${userName ? `, ${userName.split(" ")[0]}` : ""}. Here's the state of your platform today.`,
      crumbs: [{ label: "Admin", href: "/admin" }, { label: "Overview" }],
      actions: () => [],
    };
  }

  // Tailors
  if (pathname === "/admin/tailors") {
    return {
      title: "Tailors",
      subtitle: "All registered tailors on the platform",
      crumbs: [...rootCrumbs, { label: "Tailors" }],
      actions: () => [],
    };
  }

  // Tailors
  if (pathname === "/admin/tailors") {
    return {
      title: "Tailors",
      subtitle: "All registered tailors on the platform",
      crumbs: [...rootCrumbs, { label: "Tailors" }],
      actions: () => [],
    };
  }
  if (pathname === "/admin/tailors/pending") {
    return {
      title: "Pending Approvals",
      subtitle: "Review and approve new tailor registrations",
      crumbs: [...rootCrumbs, { label: "Tailors", href: "/admin/tailors" }, { label: "Pending" }],
      actions: () => [],
    };
  }
  if (pathname.startsWith("/admin/tailors/") && pathname !== "/admin/tailors/") {
    return {
      title: "Tailor Detail",
      subtitle: "Profile, stats, and account controls",
      crumbs: [...rootCrumbs, { label: "Tailors", href: "/admin/tailors" }, { label: "Detail" }],
      actions: () => [],
    };
  }

  // Products Master
  if (pathname.startsWith("/admin/products")) {
    return {
      title: "Products Master",
      subtitle: "Product catalog — pricing across all tailors",
      crumbs: [...rootCrumbs, { label: "Products" }],
      actions: () => [],
    };
  }

  // Customers
  if (pathname.startsWith("/admin/customers")) {
    return {
      title: "Customers",
      subtitle: "All customers across every tailor on the platform",
      crumbs: [...rootCrumbs, { label: "Customers" }],
      actions: () => [],
    };
  }

  // Orders
  if (pathname.startsWith("/admin/orders")) {
    return {
      title: "Orders",
      subtitle: "Every order, every tailor, every status",
      crumbs: [...rootCrumbs, { label: "Orders" }],
      actions: () => [],
    };
  }

  // Invoices
  if (pathname.startsWith("/admin/invoices")) {
    return {
      title: "Invoices",
      subtitle: "All invoices — paid, unpaid, cancelled",
      crumbs: [...rootCrumbs, { label: "Invoices" }],
      actions: () => [],
    };
  }

  return { title: "Admin", crumbs: rootCrumbs, actions: () => [] };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
});