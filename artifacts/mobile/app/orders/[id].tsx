import React, { useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { Button, Card, Badge, Divider } from "@/components/ui";
import { formatCurrency, formatDate } from "@/utils/storage";
import colors from "@/constants/colors";
import { Order } from "@/types";

function titleCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

const statusConfig = {
  pending: {
    label: "Pending",
    color: "#D97706",
    bg: "#FEF3C7",
    variant: "warning" as const,
  },
  completed: {
    label: "Completed",
    color: "#059669",
    bg: "#D1FAE5",
    variant: "success" as const,
  },
  cancelled: {
    label: "Cancelled",
    color: "#DC2626",
    bg: "#FEE2E2",
    variant: "destructive" as const,
  },
};

export default function OrderDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { orders, invoices, measurements, updateOrderStatus, deleteOrder, generateInvoiceFromOrder } = useData();
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  const order = orders.find((o) => o.id === id);

  // Delivery countdown helpers
  function deliveryDaysLeft(dateStr?: string | null): number | null {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function buildOrderShareText(o: Order): string {
    const items = o.items ?? [];
    const lines = [
      `TAILOR BOOK — ORDER`,
      `==========================`,
      `Order #: ${o.orderNumber}`,
      `Customer: ${o.customerName}`,
      `Mobile: ${o.customerMobile}`,
      o.deliveryDate ? `Delivery Date: ${formatDate(o.deliveryDate)}` : ``,
      ``,
      `ITEMS`,
      ...items.map((it) => `- ${it.productType}${it.featureLabel ? ` (${it.featureLabel})` : ""} x${it.quantity} — ${it.personName ?? o.customerName} — ${formatCurrency(it.price * it.quantity)}`),
      ``,
      `Total: ${formatCurrency(Number(o.totalAmount))}`,
      o.advanceAmount ? `Advance Paid: ${formatCurrency(o.advanceAmount)}` : ``,
      o.balanceDue ? `Balance Due: ${formatCurrency(o.balanceDue)}` : ``,
      o.notes ? `Notes: ${o.notes}` : ``,
      `==========================`,
      `Thank you for choosing us!`,
    ].filter(Boolean).join("\n");
    return lines;
  }

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <MaterialIcons name="error" size={48} color={c.destructive} />
        <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground, marginTop: 12 }}>
          Order Not Found
        </Text>
        <Button label="Go Back" onPress={() => router.back()} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const currentOrder = order;

  // Group order items by family member / assignee
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, { name: string; relation: string; memberId: string | null; items: any[] }> = {};
    
    currentOrder.items?.forEach((it) => {
      const key = it.familyMemberId ? it.familyMemberId : "self";
      if (!groups[key]) {
        groups[key] = {
          name: it.familyMemberId ? (it.personName ?? "Family Member") : "Primary Customer (Self)",
          relation: it.familyMemberId ? (it.relation ?? "other") : "self",
          memberId: it.familyMemberId ?? null,
          items: [],
        };
      }
      groups[key].items.push(it);
    });

    return Object.values(groups);
  }, [currentOrder.items]);

  // Check which items are invoiced vs uninvoiced
  const hasUninvoicedItems = React.useMemo(() => {
    return currentOrder.items?.some((it) => !it.invoiceId) ?? false;
  }, [currentOrder.items]);

  const hasInvoicedItems = React.useMemo(() => {
    return currentOrder.items?.some((it) => it.invoiceId) ?? false;
  }, [currentOrder.items]);

  // Generate invoice for the whole order or per-member
  async function handleGenerateInvoice(memberId?: string | null) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setInvoiceLoading(true);
    try {
      const filterId = memberId === undefined ? undefined : (memberId === null ? "self" : memberId);
      const invoice = await generateInvoiceFromOrder(currentOrder.id, filterId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Invoice Generated",
        `Invoice ${invoice.invoiceNumber} created successfully!`,
        [
          {
            text: "View Invoice",
            onPress: () => router.push(`/invoices/${invoice.id}` as any),
          },
          { text: "Dismiss" },
        ]
      );
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to generate invoice");
    } finally {
      setInvoiceLoading(false);
    }
  }

  function confirmDelete() {
    Alert.alert("Delete Order", "Are you sure you want to permanently delete this order?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteOrder(currentOrder.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    ]);
  }

  async function handleShareOrder() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const text = buildOrderShareText(currentOrder);
    try {
      await Share.share({ message: text, title: `Order ${currentOrder.orderNumber}` });
    } catch {}
  }

  async function handleWhatsApp() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const text = encodeURIComponent(
      `Dear ${currentOrder.customerName},\n\nYour tailoring order details:\n\n${buildOrderShareText(currentOrder)}`
    );
    const mobile = currentOrder.customerMobile.replace(/\D/g, "");
    const url = `whatsapp://send?phone=91${mobile}&text=${text}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("WhatsApp not installed", "Please install WhatsApp to use this feature");
    }
  }

  function handleStatusChange(nextStatus: Order["status"]) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateOrderStatus(currentOrder.id, nextStatus);
  }

  const sc = statusConfig[currentOrder.status];
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
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
          <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
            <MaterialIcons name="arrow-back" size={24} color={c.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
              {order.orderNumber}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.mutedForeground, marginTop: 2 }}>
              {formatDate(order.createdAt)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Badge label={sc.label} variant={sc.variant} />
          <Pressable onPress={confirmDelete} style={{ padding: 8, backgroundColor: "#FEE2E2", borderRadius: 8 }}>
            <MaterialIcons name="delete" size={20} color={c.destructive} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: insets.bottom + 40 }}>
        {/* Customer & Info Card */}
        <Card style={{ padding: 16, gap: 10 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground }}>
            Customer Information
          </Text>
          <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>
            {order.customerName}
          </Text>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
            Mobile: {order.customerMobile}
          </Text>
          
          {order.deliveryDate && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <MaterialIcons name="local-shipping" size={16} color="#059669" />
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#059669" }}>
                Delivery Due: {formatDate(order.deliveryDate)}
              </Text>
              {(() => {
                const days = deliveryDaysLeft(order.deliveryDate);
                if (days === null) return null;
                const color = days < 0 ? "#DC2626" : days <= 2 ? "#D97706" : "#059669";
                const label = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`;
                return (
                  <View style={{ backgroundColor: color + "18", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color }}>{label}</Text>
                  </View>
                );
              })()}
            </View>
          )}

          {order.notes && (
            <View style={{ backgroundColor: c.muted + "40", borderRadius: 8, padding: 12, marginTop: 6 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>Notes:</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.foreground, marginTop: 4 }}>
                {order.notes}
              </Text>
            </View>
          )}
        </Card>

        {/* Order Status Selector */}
        <Card style={{ padding: 16, gap: 12 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground }}>
            Update Progress Status
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["pending", "completed", "cancelled"] as const).map((st) => (
              <Pressable
                key={st}
                onPress={() => handleStatusChange(st)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderRadius: 8,
                  backgroundColor: order.status === st ? statusConfig[st].color + "18" : c.muted,
                  borderWidth: 1,
                  borderColor: order.status === st ? statusConfig[st].color : c.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: "Inter_600SemiBold",
                    color: order.status === st ? statusConfig[st].color : c.mutedForeground,
                  }}
                >
                  {statusConfig[st].label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Invoice Generation Actions */}
        {hasUninvoicedItems && (
          <Card style={{ padding: 16, gap: 12, backgroundColor: c.primary + "06", borderColor: c.primary + "30" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialIcons name="receipt" size={20} color={c.primary} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.primary }}>
                Billing Action Pending
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
              Some items in this family order have not been billed. Generate a combined invoice or bill members separately below.
            </Text>
            <Button
              label="Generate Combined Invoice"
              onPress={() => handleGenerateInvoice()}
              loading={invoiceLoading}
              icon="receipt"
              style={{ marginTop: 4 }}
            />
          </Card>
        )}

        {/* Order Items Grouped by Person */}
        <View style={{ gap: 14 }}>
          <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.foreground, paddingLeft: 4 }}>
            Garment Items Grouped By Member
          </Text>

          {groupedItems.map((group) => {
            const groupHasUninvoiced = group.items.some((it) => !it.invoiceId);
            
            return (
              <Card key={group.name} style={{ padding: 16, gap: 12 }}>
                {/* Group Header */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.foreground }}>
                      {group.name}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                      Relation: {titleCase(group.relation)}
                    </Text>
                  </View>
                  
                  {groupHasUninvoiced && (
                    <Pressable
                      onPress={() => handleGenerateInvoice(group.memberId)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                        backgroundColor: c.primary + "18",
                        borderWidth: 1,
                        borderColor: c.primary + "30",
                      }}
                    >
                      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.primary }}>
                        Bill Member
                      </Text>
                    </Pressable>
                  )}
                </View>

                <Divider />

                {/* Items in this Group */}
                <View style={{ gap: 10 }}>
                  {group.items.map((it) => {
                    // Look up invoice details if invoiced
                    const inv = it.invoiceId ? invoices.find((i) => i.id === it.invoiceId) : null;
                    const measValues = it.measurementValues ?? null;
                    const measEntries = measValues ? Object.entries(measValues) : [];
                    // Photos live on the source measurement, not the order
                    // item, so look them up via the measurements store.
                    const sourceMeas = it.measurementId
                      ? measurements.find((m) => m.id === it.measurementId)
                      : null;
                    const itemPhotos: string[] = (sourceMeas?.photos as string[] | undefined) ?? [];

                    return (
                      <View
                        key={it.id}
                        style={{
                          backgroundColor: c.muted + "20",
                          padding: 10,
                          borderRadius: 8,
                          gap: 8,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                              {it.productType} {it.featureLabel ? `(${it.featureLabel})` : ""}
                            </Text>
                            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                              Qty: {it.quantity} · Price: {formatCurrency(Number(it.price))}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 4 }}>
                            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.foreground }}>
                              {formatCurrency(Number(it.price) * it.quantity)}
                            </Text>
                            {it.invoiceId && inv ? (
                              <Pressable
                                onPress={() => router.push(`/invoices/${it.invoiceId}` as any)}
                                style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
                              >
                                <Badge label={inv.invoiceNumber} variant="success" />
                              </Pressable>
                            ) : (
                              <Badge label="Uninvoiced" variant="warning" />
                            )}
                          </View>
                        </View>

                        {/* Measurement values snapshot */}
                        {measEntries.length > 0 && (
                          <View style={{ backgroundColor: c.card, borderRadius: 6, padding: 8, gap: 4 }}>
                            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                              Measurements
                            </Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                              {measEntries.map(([k, v]) => (
                                <View key={k} style={{ backgroundColor: c.muted, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                                  <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.foreground }}>
                                    {titleCase(k)}: <Text style={{ fontFamily: "Inter_700Bold" }}>{String(v)}</Text>
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}

                        {/* Photos from the source measurement */}
                        {itemPhotos.length > 0 && (
                          <View style={{ gap: 4 }}>
                            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                              Photos
                            </Text>
                            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                              {itemPhotos.slice(0, 6).map((p, pIdx) => (
                                <Image
                                  key={pIdx}
                                  source={{ uri: p.startsWith("data:") ? p : `data:image/jpeg;base64,${p}` }}
                                  style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: c.muted }}
                                  resizeMode="cover"
                                />
                              ))}
                            </View>
                          </View>
                        )}

                        {/* Link to source measurement if present */}
                        {it.measurementId && (
                          <Pressable
                            onPress={() => router.push(`/measurements/${it.measurementId}` as any)}
                            style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}
                          >
                            <MaterialIcons name="straighten" size={14} color={c.primary} />
                            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.primary }}>
                              View Source Measurement
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              </Card>
            );
          })}
        </View>

        {/* Total Amount Footer */}
        <Card style={{ padding: 16, backgroundColor: c.card }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>
              Total Order Value
            </Text>
            <Text style={{ fontSize: 20, fontFamily: "Inter_800ExtraBold", color: c.primary }}>
              {formatCurrency(Number(order.totalAmount))}
            </Text>
          </View>

          {(order.advanceAmount ?? 0) > 0 && (
            <>
              <Divider style={{ marginVertical: 10 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: "#059669" }}>Advance Paid</Text>
                <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#059669" }}>-{formatCurrency(order.advanceAmount ?? 0)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, backgroundColor: (order.balanceDue ?? 0) === 0 ? "#D1FAE5" : "#FEF3C7", borderRadius: 8, padding: 10 }}>
                <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: (order.balanceDue ?? 0) === 0 ? "#059669" : "#D97706" }}>
                  {(order.balanceDue ?? 0) === 0 ? "✓ Fully Paid" : "Balance Due"}
                </Text>
                {(order.balanceDue ?? 0) > 0 && (
                  <Text style={{ fontSize: 18, fontFamily: "Inter_800ExtraBold", color: "#D97706" }}>
                    {formatCurrency(order.balanceDue ?? 0)}
                  </Text>
                )}
              </View>
            </>
          )}
        </Card>

        {/* Share / WhatsApp */}
        <Card style={{ padding: 16, gap: 10 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Share Order
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={handleShareOrder}
              style={({ pressed }) => ({
                flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
                backgroundColor: c.muted, borderRadius: 10, padding: 12,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.primary + "20", alignItems: "center", justifyContent: "center" }}>
                <MaterialIcons name="share" size={17} color={c.primary} />
              </View>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.foreground }}>Share</Text>
            </Pressable>
            <Pressable
              onPress={handleWhatsApp}
              style={({ pressed }) => ({
                flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
                backgroundColor: c.muted, borderRadius: 10, padding: 12,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#25D36620", alignItems: "center", justifyContent: "center" }}>
                <MaterialIcons name="message" size={17} color="#25D366" />
              </View>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.foreground }}>WhatsApp</Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
