import React, { useMemo, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { Button, Card, Badge, Divider, Input } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { formatCurrency, formatDate } from "@/utils/storage";
import { Order } from "@/types";

function titleCase(value: string | null | undefined) {
  if (!value) return "";
  return value[0].toUpperCase() + value.slice(1);
}

const statusConfig = {
  pending: {
    label: "Pending",
    color: "#D97706",
    bg: "#FEF3C7",
    variant: "warning" as const,
  },
  "partially-delivered": {
    label: "Partially Delivered",
    color: "#7C3AED",
    bg: "#EDE9FE",
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

type ItemDeliveryStatus = "pending" | "delivered";

interface EditDraft {
  status: Order["status"];
  deliveryDate: string;
  discount: string; // rupee amount to subtract from totalAmount (≤ totalAmount)
  notes: string;
}

export default function OrderDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    orders,
    invoices,
    measurements,
    updateOrderStatus,
    updateItemDeliveryStatus,
    deleteOrder,
    generateInvoiceFromOrder,
    refresh,
  } = useData();

  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [markingDelivered, setMarkingDelivered] = useState<string | null>(null);

  // Per-item delivery status — local overlay so the user can track progress
  // even though the underlying Order entity only has a single status field.
  // Keyed by orderItem id; default = "pending" (or "delivered" if the order
  // is already completed).
  const [itemDelivery, setItemDelivery] = useState<Record<string, ItemDeliveryStatus>>({});

  const order = orders.find((o) => o.id === id);

  // ── Handle loading/no order case first ──────────────────────────────────────
  if (!order) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.background,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <MaterialIcons name="error" size={48} color={c.destructive} />
        <Text
          style={{
            fontSize: 18,
            fontFamily: "Inter_700Bold",
            color: c.foreground,
            marginTop: 12,
          }}
        >
          Order Not Found
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontFamily: "Inter_400Regular",
            color: c.mutedForeground,
            textAlign: "center",
            marginTop: 6,
          }}
        >
          This order may have been deleted from another device.
        </Text>
        <Button
          label="Go Back"
          onPress={() => router.back()}
          style={{ marginTop: 20 }}
        />
      </View>
    );
  }

  const currentOrder = order;

  // ── Helpers ──────────────────────────────────────────────────────────────
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
      ...items.map((it) =>
        `- ${it.productType}${it.featureLabel ? ` (${it.featureLabel})` : ""} x${it.quantity} — ${it.personName ?? o.customerName} — ${formatCurrency(Number(it.price) * it.quantity)}`
      ),
      ``,
      `Total: ${formatCurrency(Number(o.totalAmount))}`,
      o.advanceAmount ? `Advance Paid: ${formatCurrency(o.advanceAmount)}` : ``,
      o.balanceDue ? `Balance Due: ${formatCurrency(o.balanceDue)}` : ``,
      o.notes ? `Notes: ${o.notes}` : ``,
      `==========================`,
      `Thank you for choosing us!`,
    ]
      .filter(Boolean)
      .join("\n");
    return lines;
  }

  // Initialise / refresh per-item delivery map whenever the order changes.
  // Source of truth is the persisted deliveryStatus on each item.
  useEffect(() => {
    setItemDelivery((prev) => {
      const next: Record<string, ItemDeliveryStatus> = {};
      (currentOrder.items ?? []).forEach((it) => {
        // Use persisted deliveryStatus if available, fall back to order status for legacy data
        next[it.id] = it.deliveryStatus ?? (currentOrder.status === "completed" ? "delivered" : "pending");
      });
      return next;
    });
  }, [currentOrder?.id, currentOrder?.status, currentOrder?.items?.length]);

  // Group items by family member / assignee
  const groupedItems = useMemo(() => {
    const groups: Record<
      string,
      { key: string; name: string; relation: string; memberId: string | null; items: any[] }
    > = {};

    currentOrder.items?.forEach((it) => {
      const key = it.familyMemberId ? it.familyMemberId : "self";
      if (!groups[key]) {
        groups[key] = {
          key,
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

  // Whether all items are delivered (order is completed)
  const allItemsDelivered = useMemo(
    () =>
      (currentOrder.items ?? []).every(
        (it) => (itemDelivery[it.id] ?? "pending") === "delivered",
      ),
    [currentOrder.items, itemDelivery],
  );

  // Lock the order once it's marked completed: edit, delete, status changes,
  // per-item delivery toggles, and the mark-all banner all become no-ops.
  const isOrderLocked = currentOrder.status === "completed";

  // Find the single invoice for this order (one invoice per order)
  const orderInvoice = useMemo(() => {
    return invoices.find((inv) => inv.orderId === currentOrder.id);
  }, [invoices, currentOrder.id]);

  // ── Generate single invoice for the whole order (all uninvoiced items) ──
  async function generateSingleInvoice() {
    setInvoiceLoading(true);
    try {
      // Check if order already has an invoice
      const existingInvoice = invoices.find(
        (inv) => inv.orderId === currentOrder.id,
      );
      if (existingInvoice) {
        Alert.alert("Invoice Ready", `Invoice ${existingInvoice.invoiceNumber} is already generated.`);
        return;
      }
      const invoice = await generateInvoiceFromOrder(currentOrder.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Invoice Generated",
        `Invoice ${invoice.invoiceNumber} created successfully!`,
        [
          { text: "View Invoice", onPress: () => router.push(`/invoices/${invoice.id}` as any) },
          { text: "Dismiss" },
        ],
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to generate invoice");
    } finally {
      setInvoiceLoading(false);
    }
  }

  // ── Per-item delivery with confirmation ────────────────────────────────
  // Toggle item delivery status and auto-calculate order status.
  // No separate invoicing — a single invoice is generated only when ALL
  // items are delivered.
  function confirmMarkItemDelivered(itemId: string) {
    if (isOrderLocked) return;
    const item = (currentOrder.items ?? []).find((it) => it.id === itemId);
    if (!item) return;
    const nextStatus: ItemDeliveryStatus =
      (itemDelivery[itemId] ?? "pending") === "delivered" ? "pending" : "delivered";

    Alert.alert(
      nextStatus === "delivered" ? "Mark as Delivered" : "Mark as Pending",
      nextStatus === "delivered"
        ? `${item.productType}${item.featureLabel ? ` (${item.featureLabel})` : ""} for ${
            item.personName ?? currentOrder.customerName
          }?`
        : `Revert this item to pending?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setMarkingDelivered(itemId);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // Persist delivery status to storage and auto-calculate order status
            await updateItemDeliveryStatus(itemId, nextStatus);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setMarkingDelivered(null);
          },
        },
      ],
    );
  }

  // ── Mark ALL items delivered with confirmation ─────────────────────────
  function confirmMarkAllDelivered() {
    if (!currentOrder.items || currentOrder.items.length === 0) return;
    if (isOrderLocked) return;
    if (allItemsDelivered) {
      Alert.alert(
        "Already Delivered",
        "Every item in this order is already marked as delivered.",
      );
      return;
    }
    Alert.alert(
      "Mark All Items Delivered?",
      `This will mark all ${currentOrder.items.length} item(s) as delivered. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark All",
          onPress: async () => {
            setMarkingDelivered("__all__");
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              // Mark all items as delivered
              for (const it of currentOrder.items ?? []) {
                await updateItemDeliveryStatus(it.id, "delivered");
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              // Refresh to sync with API and get updated state
              await refresh();
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Failed to update status");
            } finally {
              setMarkingDelivered(null);
            }
          },
        },
      ],
    );
  }

  // ── Delete order ───────────────────────────────────────────────────────
  function confirmDelete() {
    if (deleting) return;
    if (isOrderLocked) {
      Alert.alert("Order Locked", "Completed orders cannot be deleted.");
      return;
    }
    const hasInvoices = (currentOrder.items ?? []).some((it) => it.invoiceId);
    Alert.alert(
      "Delete Order",
      hasInvoices
        ? "Some items in this order have already been invoiced. Deleting the order will keep the invoices but unlink them from this order. Continue?"
        : "Are you sure you want to permanently delete this order?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteOrder(currentOrder.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              // Go back to the previous screen (orders are reached from
              // the dashboard, invoice tab, or customer detail).
              router.back();
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Failed to delete order");
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  // ── Share / WhatsApp ───────────────────────────────────────────────────
  async function handleShareOrder() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const text = buildOrderShareText(currentOrder);
    setShareLoading(true);
    try {
      await Share.share({ message: text, title: `Order ${currentOrder.orderNumber}` });
    } catch {} finally {
      setShareLoading(false);
    }
  }

  async function handleWhatsApp() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const text = encodeURIComponent(
      `Dear ${currentOrder.customerName},\n\nYour tailoring order details:\n\n${buildOrderShareText(currentOrder)}`,
    );
    const mobile = currentOrder.customerMobile.replace(/\D/g, "");
    const url = `whatsapp://send?phone=91${mobile}&text=${text}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        "WhatsApp not installed",
        "Please install WhatsApp to use this feature",
      );
    }
  }

  // ── Edit modal (status, delivery date, discount, notes) ────────────────
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    status: currentOrder.status,
    deliveryDate: currentOrder.deliveryDate ?? "",
    discount: "0",
    notes: currentOrder.notes ?? "",
  });

  // Re-seed the draft whenever the modal opens or the underlying order
  // changes. Without this, stale draft values can overwrite user input.
  useEffect(() => {
    if (!showEditModal) return;
    setEditDraft({
      status: currentOrder.status,
      deliveryDate: currentOrder.deliveryDate ?? "",
      discount: "0",
      notes: currentOrder.notes ?? "",
    });
  }, [showEditModal, currentOrder.status, currentOrder.deliveryDate, currentOrder.notes]);

  function openEditModal() {
    if (isOrderLocked) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    setSavingEdit(true);
    try {
      const discountNum = Math.max(0, Math.min(Number(editDraft.discount) || 0, Number(currentOrder.totalAmount) || 0));
      // Apply status change via the existing helper (this also updates the
      // local cache and propagates to the API when reachable).
      if (editDraft.status !== currentOrder.status) {
        await updateOrderStatus(currentOrder.id, editDraft.status);
      }
      // Update deliveryDate / notes / discount locally. The server doesn't
      // have a dedicated edit endpoint yet, so we patch the local cache
      // and let the next refresh resync.
      const { getStorageItem, saveAllOrders } = await import("@/utils/storage");
      const allOrders = (await getStorageItem<Order[]>("@tailorbook/orders")) ?? [];
      const nextTotal = Math.max(
        0,
        Number(currentOrder.totalAmount) - discountNum,
      );
      const nextAdvance = Number(currentOrder.advanceAmount ?? 0);
      const nextBalance = Math.max(0, nextTotal - nextAdvance);
      const updated = allOrders.map((o) =>
        o.id === currentOrder.id
          ? {
              ...o,
              status: editDraft.status,
              deliveryDate: editDraft.deliveryDate || null,
              notes: editDraft.notes.trim() || null,
              totalAmount: nextTotal,
              balanceDue: nextBalance,
              updatedAt: new Date().toISOString(),
            }
          : o,
      );
      await saveAllOrders(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowEditModal(false);
      // Pull fresh data from storage into React state so the UI shows
      // the new deliveryDate / notes / discount / status values.
      await refresh();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save changes");
    } finally {
      setSavingEdit(false);
    }
  }

  const sc = statusConfig[currentOrder.status];
  const topPad = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* ── Header ──────────────────────────────────────────────────── */}
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
            <Text
              style={{
                fontSize: 18,
                fontFamily: "Inter_700Bold",
                color: c.foreground,
              }}
              numberOfLines={1}
            >
              {order.orderNumber}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_500Medium",
                color: c.mutedForeground,
                marginTop: 2,
              }}
            >
              Created {formatDate(order.createdAt)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Badge label={sc.label} variant={sc.variant} />
          <Pressable
            onPress={openEditModal}
            disabled={isOrderLocked}
            style={{
              padding: 8,
              backgroundColor: c.muted,
              borderRadius: 8,
              opacity: isOrderLocked ? 0.35 : 1,
            }}
            hitSlop={4}
          >
            <MaterialIcons name="edit" size={20} color={c.primary} />
          </Pressable>
          <Pressable
            onPress={confirmDelete}
            disabled={deleting || isOrderLocked}
            style={{
              padding: 8,
              backgroundColor: "#FEE2E2",
              borderRadius: 8,
              opacity: deleting || isOrderLocked ? 0.35 : 1,
            }}
            hitSlop={4}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={c.destructive} />
            ) : (
              <MaterialIcons name="delete" size={20} color={c.destructive} />
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Customer card ─────────────────────────────────────────── */}
        <Card style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text
              style={{
                fontSize: 13,
                fontFamily: "Inter_600SemiBold",
                color: c.mutedForeground,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Customer Information
            </Text>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: c.primary + "18",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.primary }}>
                {order.customerName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: c.foreground }}>
            {order.customerName}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <MaterialIcons name="phone" size={14} color={c.mutedForeground} />
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
              {order.customerMobile}
            </Text>
          </View>

          {order.deliveryDate && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginTop: 4,
                flexWrap: "wrap",
              }}
            >
              <MaterialIcons name="local-shipping" size={16} color="#059669" />
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#059669" }}>
                Delivery: {formatDate(order.deliveryDate)}
              </Text>
              {(() => {
                const days = deliveryDaysLeft(order.deliveryDate);
                if (days === null) return null;
                const color = days < 0 ? "#DC2626" : days <= 2 ? "#D97706" : "#059669";
                const label =
                  days < 0
                    ? `${Math.abs(days)}d overdue`
                    : days === 0
                    ? "Due today"
                    : `${days}d left`;
                return (
                  <View
                    style={{
                      backgroundColor: color + "18",
                      borderRadius: 10,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color }}>
                      {label}
                    </Text>
                  </View>
                );
              })()}
            </View>
          )}

          {order.notes && (
            <View
              style={{
                backgroundColor: c.muted + "40",
                borderRadius: 8,
                padding: 12,
                marginTop: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Inter_600SemiBold",
                  color: c.mutedForeground,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                Notes
              </Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.foreground }}>
                {order.notes}
              </Text>
            </View>
          )}
        </Card>

        {/* ── Mark-all-delivered banner ────────────────────────────── */}
        {currentOrder.items && currentOrder.items.length > 0 && (
          <Card
            style={{
              padding: 14,
              gap: 8,
              backgroundColor: allItemsDelivered ? "#D1FAE5" : c.primary + "06",
              borderColor: allItemsDelivered ? "#A7F3D0" : c.primary + "30",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialIcons
                name={allItemsDelivered ? "check-circle" : "local-shipping"}
                size={20}
                color={allItemsDelivered ? "#059669" : c.primary}
              />
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Inter_700Bold",
                  color: allItemsDelivered ? "#065F46" : c.primary,
                  flex: 1,
                }}
              >
                {allItemsDelivered
                  ? "All items delivered"
                  : `${Object.values(itemDelivery).filter((s) => s === "delivered").length} of ${
                      currentOrder.items.length
                    } items delivered`}
              </Text>
            </View>
            {!allItemsDelivered && (
              <Pressable
                onPress={confirmMarkAllDelivered}
                disabled={markingDelivered === "__all__"}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  backgroundColor: c.primary,
                  paddingVertical: 10,
                  borderRadius: 10,
                  opacity: markingDelivered === "__all__" ? 0.7 : pressed ? 0.9 : 1,
                })}
              >
                {markingDelivered === "__all__" ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialIcons name="done-all" size={18} color="#FFFFFF" />
                )}
                <Text style={{ color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_700Bold" }}>
                  Mark all items delivered
                </Text>
              </Pressable>
            )}
          </Card>
        )}

        {/* ── Items grouped by person ─────────────────────────────── */}
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text
              style={{
                fontSize: 15,
                fontFamily: "Inter_700Bold",
                color: c.foreground,
                paddingLeft: 4,
              }}
            >
              Garment Items ({currentOrder.items?.length ?? 0})
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_500Medium",
                color: c.mutedForeground,
              }}
            >
              by member
            </Text>
          </View>

          {groupedItems.map((group) => {
            const groupItemsDelivered = group.items.every(
              (it) => (itemDelivery[it.id] ?? "pending") === "delivered",
            );

            return (
              <Card key={group.key} style={{ padding: 14, gap: 12 }}>
                {/* Group header */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: c.muted,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons
                        name={group.relation === "self" ? "person" : "people"}
                        size={18}
                        color={c.mutedForeground}
                      />
                    </View>
                    <View>
                      <Text
                        style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.foreground }}
                      >
                        {group.name}
                      </Text>
                      <Text
                        style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}
                      >
                        {titleCase(group.relation)} · {group.items.length} item
                        {group.items.length === 1 ? "" : "s"}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {groupItemsDelivered && (
                      <Badge label="Delivered" variant="success" />
                    )}
                  </View>
                </View>

                <Divider />

                {/* Items in this group */}
                <View style={{ gap: 10 }}>
                  {group.items.map((it) => {
                    const inv = it.invoiceId ? invoices.find((i) => i.id === it.invoiceId) : null;
                    const measValues = it.measurementValues ?? null;
                    const measEntries = measValues ? Object.entries(measValues) : [];
                    const sourceMeas = it.measurementId
                      ? measurements.find((m) => m.id === it.measurementId)
                      : null;
                    const itemPhotos: string[] = (sourceMeas?.photos as string[] | undefined) ?? [];
                    const delivered = (itemDelivery[it.id] ?? "pending") === "delivered";
                    const busy = markingDelivered === it.id;

                    return (
                      <View
                        key={it.id}
                        style={{
                          backgroundColor: c.muted + "20",
                          padding: 10,
                          borderRadius: 10,
                          gap: 8,
                          borderWidth: 1,
                          borderColor: delivered ? "#A7F3D0" : "transparent",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text
                              style={{
                                fontSize: 14,
                                fontFamily: "Inter_600SemiBold",
                                color: c.foreground,
                              }}
                            >
                              {it.productType}{" "}
                              {it.featureLabel ? (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontFamily: "Inter_500Medium",
                                    color: c.mutedForeground,
                                  }}
                                >
                                  ({it.featureLabel})
                                </Text>
                              ) : null}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                fontFamily: "Inter_400Regular",
                                color: c.mutedForeground,
                              }}
                            >
                              Qty: {it.quantity} · {formatCurrency(Number(it.price))}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 4 }}>
                            <Text
                              style={{
                                fontSize: 14,
                                fontFamily: "Inter_700Bold",
                                color: c.foreground,
                              }}
                            >
                              {formatCurrency(Number(it.price) * it.quantity)}
                            </Text>
                            {it.invoiceId && inv ? (
                              <Pressable
                                onPress={() =>
                                  router.push(`/invoices/${it.invoiceId}` as any)
                                }
                              >
                                <Badge label={inv.invoiceNumber} variant="success" />
                              </Pressable>
                            ) : (
                              <Badge label="Uninvoiced" variant="warning" />
                            )}
                          </View>
                        </View>

                        {/* Measurements */}
                        {measEntries.length > 0 && (
                          <View
                            style={{
                              backgroundColor: c.card,
                              borderRadius: 6,
                              padding: 8,
                              gap: 4,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontFamily: "Inter_600SemiBold",
                                color: c.mutedForeground,
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                              }}
                            >
                              Measurements
                            </Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                              {measEntries.map(([k, v]) => (
                                <View
                                  key={k}
                                  style={{
                                    backgroundColor: c.muted,
                                    borderRadius: 6,
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontFamily: "Inter_500Medium",
                                      color: c.foreground,
                                    }}
                                  >
                                    {titleCase(k)}:{" "}
                                    <Text style={{ fontFamily: "Inter_700Bold" }}>
                                      {String(v)}
                                    </Text>
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}

                        {/* Photos */}
                        {itemPhotos.length > 0 && (
                          <View style={{ gap: 4 }}>
                            <Text
                              style={{
                                fontSize: 10,
                                fontFamily: "Inter_600SemiBold",
                                color: c.mutedForeground,
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                              }}
                            >
                              Photos
                            </Text>
                            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                              {itemPhotos.slice(0, 6).map((p, pIdx) => (
                                <Image
                                  key={pIdx}
                                  source={{
                                    uri: p.startsWith("data:")
                                      ? p
                                      : `data:image/jpeg;base64,${p}`,
                                  }}
                                  style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 6,
                                    backgroundColor: c.muted,
                                  }}
                                  resizeMode="cover"
                                />
                              ))}
                            </View>
                          </View>
                        )}

                        {/* Per-item actions */}
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 6,
                            marginTop: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          <Pressable
                            onPress={() => confirmMarkItemDelivered(it.id)}
                            disabled={busy || isOrderLocked}
                            style={({ pressed }) => ({
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 8,
                              backgroundColor: delivered ? "#D1FAE5" : c.muted,
                              borderWidth: 1,
                              borderColor: delivered ? "#A7F3D0" : c.border,
                              opacity: isOrderLocked ? 0.4 : pressed ? 0.85 : 1,
                            })}
                          >
                            <MaterialIcons
                              name={delivered ? "undo" : "check-circle"}
                              size={14}
                              color={delivered ? "#059669" : c.mutedForeground}
                            />
                            <Text
                              style={{
                                fontSize: 11,
                                fontFamily: "Inter_600SemiBold",
                                color: delivered ? "#059669" : c.mutedForeground,
                              }}
                            >
                              {delivered ? "Pending" : "Mark as Delivered"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Card>
            );
          })}
        </View>

        {/* ── Total card ──────────────────────────────────────────── */}
        <Card style={{ padding: 16, backgroundColor: c.card }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>
              Total Order Value
            </Text>
            <Text style={{ fontSize: 22, fontFamily: "Inter_800ExtraBold", color: c.primary }}>
              {formatCurrency(Number(order.totalAmount))}
            </Text>
          </View>

          {Number(order.advanceAmount ?? 0) > 0 && (
            <>
              <Divider style={{ marginVertical: 10 }} />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: "#059669" }}>
                  Advance Paid
                </Text>
                <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#059669" }}>
                  -{formatCurrency(Number(order.advanceAmount ?? 0))}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 6,
                  backgroundColor: Number(order.balanceDue ?? 0) === 0 ? "#D1FAE5" : "#FEF3C7",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: "Inter_700Bold",
                    color: Number(order.balanceDue ?? 0) === 0 ? "#059669" : "#D97706",
                  }}
                >
                  {Number(order.balanceDue ?? 0) === 0 ? "✓ Fully Paid" : "Balance Due"}
                </Text>
                {Number(order.balanceDue ?? 0) > 0 && (
                  <Text
                    style={{
                      fontSize: 18,
                      fontFamily: "Inter_800ExtraBold",
                      color: "#D97706",
                    }}
                  >
                    {formatCurrency(Number(order.balanceDue ?? 0))}
                  </Text>
                )}
              </View>
            </>
          )}
        </Card>

        {/* ── View / Generate Invoice ─────────────────────────────── */}
        {/* Invoice button is only visible when order is "completed" (all items
            delivered) or when a single invoice has already been generated */}
        {(currentOrder.status === "completed" || orderInvoice) && (
          <Card style={{ padding: 14, gap: 8, backgroundColor: c.card }}>
            {orderInvoice ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/invoices/${orderInvoice.id}` as any);
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  backgroundColor: c.muted,
                  paddingVertical: 12,
                  borderRadius: 10,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <MaterialIcons name="visibility" size={18} color={c.primary} />
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: c.primary }}>
                  View Invoice {orderInvoice.invoiceNumber}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={generateSingleInvoice}
                disabled={invoiceLoading}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  backgroundColor: c.primary,
                  paddingVertical: 12,
                  borderRadius: 10,
                  opacity: invoiceLoading ? 0.7 : pressed ? 0.9 : 1,
                })}
              >
                {invoiceLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialIcons name="receipt-long" size={18} color="#FFFFFF" />
                )}
                <Text style={{ color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_700Bold" }}>
                  Generate Invoice
                </Text>
              </Pressable>
            )}
          </Card>
        )}

        {/* ── Share row ───────────────────────────────────────────── */}
        <Card style={{ padding: 14, gap: 10 }}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Inter_600SemiBold",
              color: c.mutedForeground,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Share Order
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={handleShareOrder}
              disabled={shareLoading}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: c.muted,
                borderRadius: 10,
                padding: 12,
                opacity: pressed || shareLoading ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: c.primary + "20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name="share" size={17} color={c.primary} />
              </View>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                Share
              </Text>
            </Pressable>
            <Pressable
              onPress={handleWhatsApp}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: c.muted,
                borderRadius: 10,
                padding: 12,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: "#25D36620",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name="message" size={17} color="#25D366" />
              </View>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_600SemiBold",
                  color: c.foreground,
                }}
              >
                WhatsApp
              </Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>

      {/* ── Edit modal ────────────────────────────────────────────── */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <Pressable
            onPress={() => !savingEdit && setShowEditModal(false)}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: c.card,
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                paddingTop: 18,
                paddingHorizontal: 20,
                paddingBottom: insets.bottom + 22,
                gap: 16,
                maxHeight: "92%",
              }}
            >
              {/* Modal handle + header */}
              <View style={{ alignItems: "center" }}>
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: c.border,
                  }}
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
                  Edit Order
                </Text>
                <Pressable
                  onPress={() => setShowEditModal(false)}
                  disabled={savingEdit}
                  hitSlop={8}
                >
                  <MaterialIcons name="close" size={22} color={c.mutedForeground} />
                </Pressable>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 16 }}
              >
                {/* Status */}
                <View style={{ gap: 8 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Inter_600SemiBold",
                      color: c.mutedForeground,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Status
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(["pending", "completed", "cancelled"] as const).map((st) => (
                      <Pressable
                        key={st}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setEditDraft((d) => ({ ...d, status: st }));
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          alignItems: "center",
                          borderRadius: 10,
                          backgroundColor:
                            editDraft.status === st ? statusConfig[st].color + "18" : c.muted,
                          borderWidth: 1,
                          borderColor:
                            editDraft.status === st ? statusConfig[st].color : c.border,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontFamily: "Inter_600SemiBold",
                            color:
                              editDraft.status === st
                                ? statusConfig[st].color
                                : c.mutedForeground,
                          }}
                        >
                          {statusConfig[st].label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Delivery date */}
                <DatePicker
                  label="Delivery Date"
                  value={editDraft.deliveryDate}
                  onChange={(v) => setEditDraft((d) => ({ ...d, deliveryDate: v }))}
                />

                {/* Discount */}
                <View style={{ gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Inter_600SemiBold",
                      color: c.mutedForeground,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Discount (₹)
                  </Text>
                  <TextInput
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={c.mutedForeground}
                    value={editDraft.discount}
                    onChangeText={(v) =>
                      setEditDraft((d) => ({
                        ...d,
                        discount: v.replace(/[^0-9]/g, "").slice(0, 7),
                      }))
                    }
                    maxLength={7}
                    style={{
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: 8,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      fontSize: 16,
                      color: c.foreground,
                      backgroundColor: c.input,
                      fontFamily: "Inter_600SemiBold",
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Inter_400Regular",
                      color: c.mutedForeground,
                    }}
                  >
                    Current total: {formatCurrency(Number(currentOrder.totalAmount))}.
                    {" "}After discount:{" "}
                    {formatCurrency(
                      Math.max(
                        0,
                        Number(currentOrder.totalAmount) - (Number(editDraft.discount) || 0),
                      ),
                    )}
                  </Text>
                </View>

                {/* Notes */}
                <Input
                  label="Notes"
                  placeholder="Order notes (optional)"
                  value={editDraft.notes}
                  onChangeText={(v) => setEditDraft((d) => ({ ...d, notes: v.slice(0, 500) }))}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />

                {/* Action row */}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                  <Button
                    label="Cancel"
                    onPress={() => setShowEditModal(false)}
                    variant="outline"
                    style={{ flex: 1 }}
                    disabled={savingEdit}
                  />
                  <Button
                    label="Save Changes"
                    onPress={handleSaveEdit}
                    loading={savingEdit}
                    style={{ flex: 2 }}
                  />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
