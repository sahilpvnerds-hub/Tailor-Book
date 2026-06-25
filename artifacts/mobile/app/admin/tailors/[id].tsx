import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { StatCard } from "@/components/admin/StatCard";
import { StatusPill } from "@/components/admin/StatusPill";
import {
  api,
  getToken,
  type AdminTailorDetail,
  type AdminUserPatch,
  type Order,
  type Invoice,
} from "@/utils/api";

/**
 * Admin tailor detail / edit screen. Two-column on wide screens:
 *   - Left: profile header, stat strip, edit form, danger zone
 *   - Right: activity feed (recent orders + recent invoices for this tailor)
 *
 * On narrow screens (<900px) the two columns stack vertically.
 */
export default function AdminTailorDetailScreen() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 1100;

  const [data, setData] = useState<AdminTailorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Editable fields (local state; not flushed until "Save")
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const token = await getToken();
      if (!token) return;
      const [detail, orderRows, invoiceRows] = await Promise.all([
        api.admin.getUser(token, id),
        api.orders.get(token, { tailorId: id }),
        api.invoices.get(token, { tailorId: id }),
      ]);
      setData(detail);
      setName(detail.name);
      setEmail(detail.email);
      setMobile(detail.mobile);
      setShopName(detail.shopName ?? "");
      setShopAddress(detail.shopAddress ?? "");
      setCity(detail.city ?? "");
      setState(detail.state ?? "");
      setOrders(orderRows.slice(0, 5));
      setInvoices(invoiceRows.slice(0, 5));
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty =
    data != null &&
    (name !== data.name ||
      email !== data.email ||
      mobile !== data.mobile ||
      shopName !== (data.shopName ?? "") ||
      shopAddress !== (data.shopAddress ?? "") ||
      city !== (data.city ?? "") ||
      state !== (data.state ?? ""));

  const onSave = useCallback(async () => {
    if (!data || !dirty) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      const patch: AdminUserPatch = {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        mobile: mobile.trim() || undefined,
        shopName: shopName.trim() || null,
        shopAddress: shopAddress.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
      };
      const updated = await api.admin.patchUser(token, data.id, patch);
      setData({ ...data, ...updated });
      Alert.alert("Saved", "Tailor profile updated");
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [data, dirty, name, email, mobile, shopName, shopAddress, city, state]);

  const toggleSuspend = useCallback(async () => {
    if (!data) return;
    const willSuspend = data.status !== "rejected";
    setActionBusy(true);
    try {
      const token = await getToken();
      if (!token) return;
      if (willSuspend) {
        await api.admin.suspendUser(token, data.id);
        setData({ ...data, status: "rejected" });
      } else {
        await api.admin.unsuspendUser(token, data.id);
        setData({ ...data, status: "approved" });
      }
      Alert.alert("Done", willSuspend ? "Account suspended" : "Account reactivated");
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setActionBusy(false);
    }
  }, [data]);

  const onDelete = useCallback(() => {
    if (!data) return;
    Alert.alert(
      "Delete tailor?",
      `This permanently removes ${data.name} and all related data. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setActionBusy(true);
            try {
              const token = await getToken();
              if (!token) return;
              await api.admin.deleteUser(token, data.id);
              Alert.alert("Deleted", `${data.name} was removed`, [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (err) {
              Alert.alert("Error", (err as Error).message);
            } finally {
              setActionBusy(false);
            }
          },
        },
      ],
    );
  }, [data, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, backgroundColor: c.background }}>
        <MaterialIcons name="person-off" size={48} color={c.mutedForeground} />
        <Text style={{ marginTop: 12, color: c.foreground }}>Tailor not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }} keyboardShouldPersistTaps="handled">
        {/* Profile header card */}
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.border,
            padding: 22,
            flexDirection: "row",
            alignItems: "center",
            gap: 18,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: c.secondary,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 3,
              borderColor: c.card,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Text style={{ fontSize: 28, fontWeight: "800", color: c.foreground }}>
              {data.name?.charAt(0).toUpperCase() ?? "?"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: c.foreground, letterSpacing: -0.3 }}>
              {data.name}
            </Text>
            <Text style={{ fontSize: 13, color: c.mutedForeground, marginTop: 4 }}>
              {data.email}
            </Text>
            <View style={{ marginTop: 8, flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              <StatusPill status={data.status} />
              {data.role === "admin" ? (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                    backgroundColor: c.primary,
                  }}
                >
                  <Text style={{ color: c.primaryForeground, fontSize: 10, fontWeight: "800" }}>
                    ADMIN
                  </Text>
                </View>
              ) : null}
              {data.speciality ? (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                    backgroundColor: c.muted,
                  }}
                >
                  <Text
                    style={{
                      color: c.mutedForeground,
                      fontSize: 10,
                      fontWeight: "700",
                      textTransform: "capitalize",
                    }}
                  >
                    {data.speciality}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "600" }}>JOINED</Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: c.foreground }}>
              {new Date(data.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </Text>
            {data.city ? (
              <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 2 }}>
                📍 {data.city}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <StatCard
            label="Customers"
            value={data.stats.customers}
            icon="people"
            accent="#0EA5E9"
          />
          <StatCard
            label="Orders"
            value={data.stats.orders}
            icon="shopping-bag"
            accent="#A855F7"
          />
          <StatCard
            label="Invoices"
            value={data.stats.invoices}
            icon="receipt-long"
            accent={c.primary}
          />
          <StatCard
            label="Revenue"
            value={`₹${data.stats.revenue.toLocaleString()}`}
            icon="payments"
            accent="#059669"
          />
        </View>

        {/* Two-column main area */}
        <View
          style={{
            flexDirection: isWide ? "row" : "column",
            gap: 18,
            alignItems: "flex-start",
          }}
        >
          {/* LEFT: edit form + danger zone */}
          <View style={{ flex: isWide ? 1.5 : undefined, minWidth: 0, width: "100%", gap: 18 }}>
            <Section title="Profile">
              <Field label="Name" value={name} onChangeText={setName} />
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Field
                label="Mobile"
                value={mobile}
                onChangeText={setMobile}
                keyboardType="phone-pad"
              />
            </Section>

            <Section title="Shop">
              <Field label="Shop name" value={shopName} onChangeText={setShopName} />
              <Field
                label="Address"
                value={shopAddress}
                onChangeText={setShopAddress}
                multiline
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field label="City" value={city} onChangeText={setCity} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="State" value={state} onChangeText={setState} />
                </View>
              </View>
            </Section>

            <Pressable
              onPress={onSave}
              disabled={!dirty || saving}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 13,
                borderRadius: 11,
                backgroundColor: !dirty || saving
                  ? c.muted
                  : pressed
                  ? c.secondary
                  : c.primary,
                shadowColor: !dirty || saving ? "transparent" : c.primary,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.25,
                shadowRadius: 6,
                elevation: 2,
              })}
            >
              {saving ? (
                <ActivityIndicator size="small" color={c.primaryForeground} />
              ) : (
                <>
                  <MaterialIcons name="save" size={18} color={c.primaryForeground} />
                  <Text
                    style={{
                      marginLeft: 8,
                      color: c.primaryForeground,
                      fontWeight: "700",
                      fontSize: 14,
                    }}
                  >
                    Save changes
                  </Text>
                </>
              )}
            </Pressable>

            <View
              style={{
                backgroundColor: c.card,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: c.border,
                padding: 18,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialIcons name="warning" size={18} color={c.destructive} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: c.destructive,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Danger zone
                </Text>
              </View>

              <Pressable
                onPress={toggleSuspend}
                disabled={actionBusy}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 13,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  backgroundColor: pressed ? c.muted : c.background,
                  borderWidth: 1,
                  borderColor: c.border,
                  opacity: actionBusy ? 0.6 : 1,
                })}
              >
                <MaterialIcons
                  name={data.status === "rejected" ? "play-circle-outline" : "block"}
                  size={18}
                  color={c.foreground}
                />
                <Text style={{ marginLeft: 12, color: c.foreground, fontWeight: "600", fontSize: 14 }}>
                  {data.status === "rejected" ? "Reactivate account" : "Suspend account"}
                </Text>
              </Pressable>

              <Pressable
                onPress={onDelete}
                disabled={actionBusy}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 13,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  backgroundColor: pressed ? c.secondary : c.background,
                  borderWidth: 1,
                  borderColor: c.destructive,
                  opacity: actionBusy ? 0.6 : 1,
                })}
              >
                <MaterialIcons name="delete-outline" size={18} color={c.destructive} />
                <Text style={{ marginLeft: 12, color: c.destructive, fontWeight: "600", fontSize: 14 }}>
                  Delete account permanently
                </Text>
              </Pressable>
            </View>
          </View>

          {/* RIGHT: activity feed */}
          <View style={{ flex: 1, width: "100%", gap: 18 }}>
            <ActivityCard
              title="Recent orders"
              icon="shopping-bag"
              empty="No orders yet"
              items={orders.map((o) => ({
                id: o.id,
                title: o.orderNumber,
                subtitle: `${o.customerName} · ${new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`,
                right: `₹${Number(o.totalAmount).toLocaleString()}`,
                status: o.status,
              }))}
            />
            <ActivityCard
              title="Recent invoices"
              icon="receipt-long"
              empty="No invoices yet"
              items={invoices.map((inv) => ({
                id: inv.id,
                title: inv.invoiceNumber,
                subtitle: `${inv.customerName} · ${new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`,
                right: `₹${Number(inv.total).toLocaleString()}`,
                status: inv.status,
              }))}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: c.border,
        padding: 18,
        gap: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "800",
          color: c.mutedForeground,
          textTransform: "uppercase",
          letterSpacing: 0.7,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  ...rest
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          fontSize: 11,
          color: c.mutedForeground,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={c.mutedForeground}
        style={{
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 11,
          fontSize: 14,
          color: c.foreground,
          backgroundColor: c.background,
        }}
        {...rest}
      />
    </View>
  );
}

interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  right: string;
  status: string;
}

function ActivityCard({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: ActivityItem[];
  empty: string;
}) {
  const c = useColors();
  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: c.border,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 16,
          borderBottomWidth: items.length > 0 ? 1 : 0,
          borderBottomColor: c.border,
        }}
      >
        <MaterialIcons name={icon} size={18} color={c.mutedForeground} />
        <Text
          style={{
            marginLeft: 8,
            fontSize: 14,
            fontWeight: "700",
            color: c.foreground,
            flex: 1,
          }}
        >
          {title}
        </Text>
        <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "600" }}>
          {items.length} latest
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={{ padding: 28, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: c.mutedForeground }}>{empty}</Text>
        </View>
      ) : (
        items.map((it, i) => (
          <View
            key={it.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: c.border,
              gap: 10,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: c.foreground }}
                numberOfLines={1}
              >
                {it.title}
              </Text>
              <Text
                style={{ fontSize: 11, color: c.mutedForeground, marginTop: 2 }}
                numberOfLines={1}
              >
                {it.subtitle}
              </Text>
            </View>
            <Text
              style={{ fontSize: 13, fontWeight: "700", color: c.foreground }}
              numberOfLines={1}
            >
              {it.right}
            </Text>
            <StatusPill status={it.status} size="sm" />
          </View>
        ))
      )}
    </View>
  );
}