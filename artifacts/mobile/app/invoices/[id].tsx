import React, { useState } from "react";
import { Alert, Image, Linking, Modal, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { Badge, Button, Card, Divider } from "@/components/ui";
import { displayOrderLabel, formatCurrency, formatDate } from "@/utils/storage";
import { base64ToDataUri } from "@/utils/photos";
import { Invoice } from "@/types";
import colors from "@/constants/colors";
import { i18n } from "@/utils/i18n";

function titleCase(value?: string | null) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function invoiceItemPersonLabel(item: Invoice["items"][number], customerName: string) {
  const name = item.personName ?? item.familyMemberName ?? customerName;
  const relation = item.relation ?? (item.familyMemberId ? "other" : "self");
  return `${name} (${titleCase(relation)})`;
}

function buildInvoiceText(invoice: Invoice): string {
  const t = i18n.t;
  const lines = [
    t("share.invoiceHeader", "TAILOR BOOK - INVOICE"),
    `============================`,
    `${t("share.invoiceNo", "Invoice #")}: ${invoice.invoiceNumber}`,
    `${t("share.orderNo", "Order #")}: ${displayOrderLabel(invoice)}`,
    `${t("share.date", "Date")}: ${formatDate(invoice.createdAt)}`,
    ``,
    t("share.customerDetails", "CUSTOMER DETAILS"),
    `${t("common.name", "Name")}: ${invoice.customerName}`,
    `${t("common.mobile", "Mobile")}: ${invoice.customerMobile}`,
    ``,
    t("share.orderItems", "ORDER ITEMS"),
    ...invoice.items.flatMap((item, idx) => {
      const itemLines = [
        `${idx + 1}. ${t("share.product", "Product")}: ${item.productType}${item.featureLabel ? ` (${item.featureLabel})` : ""}`,
        `   ${t("share.person", "Person")}: ${invoiceItemPersonLabel(item, invoice.customerName)}`,
        `   ${t("share.qtyRate", "Qty/Rate")}: ${item.quantity} x ${formatCurrency(item.price)} = ${formatCurrency(item.price * item.quantity)}`,
      ];
      if (item.measurementValues && Object.keys(item.measurementValues).length > 0) {
        const measList = Object.entries(item.measurementValues).map(([k, v]) => `${titleCase(k)}: ${v}`).join(", ");
        itemLines.push(`   ${t("share.measurements", "Measurements")}: ${measList}`);
      }
      return itemLines;
    }),
    ``,
    `${t("share.subtotal", "Subtotal")}: ${formatCurrency(invoice.subtotal)}`,
    `${t("share.total", "Total")}: ${formatCurrency(invoice.total)}`,
    `${t("share.paid", "Paid")}: ${formatCurrency(invoice.paidAmount ?? 0)}`,
    `${t("share.balance", "Balance")}: ${formatCurrency((invoice.total ?? 0) - (invoice.paidAmount ?? 0))}`,
    ``,
    `${t("share.status", "Status")}: ${invoice.status.toUpperCase()}`,
    invoice.notes ? `${t("share.notes", "Notes")}: ${invoice.notes}` : "",
    `============================`,
    t("share.footer", "Thank you for choosing us!"),
  ]
    .filter((l) => l !== undefined && l !== null)
    .join("\n");
  return lines;
}

export default function InvoiceDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { invoices, updateInvoiceStatus, measurements } = useData();
  const invoice = invoices.find((i) => i.id === id);

  const [paymentInput, setPaymentInput] = useState("");

  // Collect photos from the underlying measurement(s) referenced by each line item.
  const linkedMeasurementIds = Array.from(
    new Set(
      (invoice?.items ?? [])
        .map((it) => it.measurementId)
        .filter((mid): mid is string => !!mid)
    )
  );
  const linkedMeasurements = linkedMeasurementIds
    .map((mid) => measurements.find((m) => m.id === mid))
    .filter((m): m is NonNullable<typeof m> => !!m);
  const allLinkedPhotos = linkedMeasurements.flatMap((m) => m.photos ?? []);
  const [photoView, setPhotoView] = useState<string | null>(null);
  const [labelModalOpen, setLabelModalOpen] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : 0;

  if (!invoice) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>Invoice not found</Text>
      </View>
    );
  }

  async function handleShare() {
    const text = buildInvoiceText(invoice!);
    try {
      await Share.share({ message: text, title: `Invoice ${invoice!.invoiceNumber}` });
    } catch {}
  }

  async function handleWhatsApp() {
    const text = encodeURIComponent(
      `Dear ${invoice!.customerName},\n\nYour tailoring invoice has been created.\n\n${buildInvoiceText(invoice!)}`
    );
    const mobile = invoice!.customerMobile.replace(/\D/g, "");
    const url = `whatsapp://send?phone=91${mobile}&text=${text}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("WhatsApp not installed", "Please install WhatsApp to use this feature");
    }
  }

  async function handleEmail() {
    const subject = encodeURIComponent(`Invoice ${invoice!.invoiceNumber} from Tailor Book`);
    const body = encodeURIComponent(buildInvoiceText(invoice!));
    const email = "";
    await Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
  }

  async function handleStatusChange(status: Invoice["status"]) {
    if (status === "completed") {
      // Mark complete makes it fully paid!
      await updateInvoiceStatus(invoice!.id, "completed", invoice!.total);
    } else {
      await updateInvoiceStatus(invoice!.id, status);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleRecordPayment() {
    const amt = parseFloat(paymentInput);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid payment amount.");
      return;
    }
    const currentPaid = invoice!.paidAmount ?? 0;
    const nextPaid = currentPaid + amt;
    const balance = invoice!.total - currentPaid;

    if (amt > balance) {
      Alert.alert(
        "Excess Amount",
        `The amount ₹${amt} exceeds the remaining balance of ₹${balance}.`
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const nextStatus = nextPaid >= invoice!.total ? "completed" : "pending";
      await updateInvoiceStatus(invoice!.id, nextStatus, nextPaid);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Payment Recorded", `Payment of ₹${amt} recorded successfully.`);
      setPaymentInput("");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to record payment");
    }
  }

  const statusVariantMap = {
    pending: "warning" as const,
    completed: "success" as const,
    cancelled: "destructive" as const,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + topPad + 16,
          paddingHorizontal: 20,
          paddingBottom: 24,
          backgroundColor: "#059669",
          gap: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 8 }}>
            <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" }}>
            Invoice
          </Text>
          <Badge label={invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)} variant={statusVariantMap[invoice.status]} />
        </View>

        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 24, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
            {invoice.invoiceNumber}
          </Text>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)" }}>
            {formatDate(invoice.createdAt)}
          </Text>
          {/* Order label chip — tap to open printable label view */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setLabelModalOpen(true);
            }}
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              marginTop: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "rgba(255,255,255,0.22)",
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <MaterialIcons name="label" size={14} color="#FFFFFF" />
            <Text
              style={{
                fontSize: 13,
                fontFamily: "Inter_700Bold",
                color: "#FFFFFF",
                letterSpacing: 0.5,
              }}
            >
              Order {displayOrderLabel(invoice)}
            </Text>
          </Pressable>
        </View>

        {/* Total */}
        <View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: colors.radius, padding: 16, alignItems: "center" }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" }}>Grand Total</Text>
          <Text style={{ fontSize: 32, fontFamily: "Inter_700Bold", color: "#FFFFFF", marginTop: 4 }}>
            {formatCurrency(invoice.total)}
          </Text>
        </View>
      </View>

      <View style={{ padding: 20, gap: 16 }}>
        {/* Delivery Date */}
        {invoice.deliveryDate && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: "#FFF7ED",
              borderRadius: colors.radius,
              padding: 14,
              borderWidth: 1,
              borderColor: "#FED7AA",
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#F97316" + "20",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="event" size={20} color="#F97316" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#9A3412" }}>
                Delivery Date
              </Text>
              <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#9A3412" }}>
                {formatDate(invoice.deliveryDate)}
              </Text>
            </View>
          </View>
        )}

        {/* Photos from linked measurements */}
        {allLinkedPhotos.length > 0 && (
          <Card>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
              Measurement Photos ({allLinkedPhotos.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {allLinkedPhotos.map((p, idx) => (
                <Pressable key={idx} onPress={() => setPhotoView(p)}>
                  <Image
                    source={{ uri: base64ToDataUri(p) }}
                    style={{ width: 100, height: 100, borderRadius: 12, backgroundColor: c.muted }}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          </Card>
        )}

        {/* Customer */}
        <Card>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
            Customer
          </Text>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary + "20", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.primary }}>{invoice.customerName[0]}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: c.foreground }}>{invoice.customerName}</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>{invoice.customerMobile}</Text>
            </View>
          </View>
        </Card>

        {/* Items */}
        <Card>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
            Order Items
          </Text>
          <View style={{ gap: 0 }}>
            {invoice.items.map((item, idx) => {
              const itemMeasurement = item.measurementId ? measurements.find((m) => m.id === item.measurementId) : undefined;
              return (
                <React.Fragment key={idx}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                        {item.productType} {item.featureLabel ? `(${item.featureLabel})` : ""}
                      </Text>
                      <View
                        style={{
                          alignSelf: "flex-start",
                          marginTop: 3,
                          backgroundColor: "#EEF2FF",
                          borderRadius: 6,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <MaterialIcons name={item.familyMemberId ? "group" : "person"} size={11} color="#6366F1" />
                        <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#6366F1" }}>
                          {invoiceItemPersonLabel(item, invoice.customerName)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 2 }}>
                        {item.quantity} x {formatCurrency(item.price)}
                      </Text>
                      
                      {item.measurementValues && Object.keys(item.measurementValues).length > 0 && (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                          {Object.entries(item.measurementValues).map(([key, val]) => (
                            <View key={key} style={{ backgroundColor: c.muted, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
                                {titleCase(key)}: {val}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {itemMeasurement?.photos && itemMeasurement.photos.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8 }}>
                          {itemMeasurement.photos.map((p, pIdx) => (
                            <Pressable key={pIdx} onPress={() => setPhotoView(p)}>
                              <Image
                                source={{ uri: base64ToDataUri(p) }}
                                style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: c.muted }}
                                resizeMode="cover"
                              />
                            </Pressable>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.foreground }}>
                      {formatCurrency(item.price * item.quantity)}
                    </Text>
                  </View>
                  {idx < invoice.items.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </View>

          <Divider style={{ marginVertical: 8 }} />

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 4 }}>
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>Total</Text>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#059669" }}>{formatCurrency(invoice.total)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>Amount Paid</Text>
              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#059669" }}>{formatCurrency(invoice.paidAmount ?? 0)}</Text>
            </View>
            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              backgroundColor: (invoice.total - (invoice.paidAmount ?? 0)) <= 0 ? "#D1FAE5" : "#FEF3C7",
              borderRadius: 8, padding: 10,
            }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: (invoice.total - (invoice.paidAmount ?? 0)) <= 0 ? "#059669" : "#D97706" }}>
                {(invoice.total - (invoice.paidAmount ?? 0)) <= 0 ? "✓ Fully Paid" : "Balance Due"}
              </Text>
              {(invoice.total - (invoice.paidAmount ?? 0)) > 0 && (
                <Text style={{ fontSize: 16, fontFamily: "Inter_800ExtraBold", color: "#D97706" }}>
                  {formatCurrency(invoice.total - (invoice.paidAmount ?? 0))}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Notes */}
        {invoice.notes && (
          <Card>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Notes
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.foreground }}>{invoice.notes}</Text>
          </Card>
        )}

        {/* Part Payment Section */}
        {(invoice.total - (invoice.paidAmount ?? 0)) > 0 && (
          <Card style={{ gap: 12 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Record Payment
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.foreground }}>
              Enter payment amount to record a partial or full payment.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <View style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: c.muted,
                borderRadius: colors.radius,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: c.border,
                height: 46,
              }}>
                <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: c.foreground, marginRight: 4 }}>₹</Text>
                <TextInput
                  value={paymentInput}
                  onChangeText={setPaymentInput}
                  keyboardType="numeric"
                  placeholder="Amount"
                  placeholderTextColor={c.mutedForeground}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontFamily: "Inter_600SemiBold",
                    color: c.foreground,
                    padding: 0,
                  }}
                />
              </View>
              <Button
                label="Pay"
                onPress={handleRecordPayment}
                variant="primary"
                style={{ height: 46, paddingHorizontal: 20 }}
              />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pressable
                onPress={() => setPaymentInput(String(Math.min(100, invoice.total - (invoice.paidAmount ?? 0))))}
                style={{ backgroundColor: c.muted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
              >
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.foreground }}>+₹100</Text>
              </Pressable>
              <Pressable
                onPress={() => setPaymentInput(String(Math.min(500, invoice.total - (invoice.paidAmount ?? 0))))}
                style={{ backgroundColor: c.muted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
              >
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.foreground }}>+₹500</Text>
              </Pressable>
              <Pressable
                onPress={() => setPaymentInput(String(invoice.total - (invoice.paidAmount ?? 0)))}
                style={{ backgroundColor: c.primary + "15", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
              >
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.primary }}>Full Balance (₹{invoice.total - (invoice.paidAmount ?? 0)})</Text>
              </Pressable>
            </View>
          </Card>
        )}

        {/* Status update */}
        {invoice.status === "pending" && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              label="Mark Complete"
              onPress={() => handleStatusChange("completed")}
              variant="primary"
              style={{ flex: 1 }}
              icon="check-circle"
            />
            <Button
              label="Cancel"
              onPress={() => handleStatusChange("cancelled")}
              variant="destructive"
              style={{ flex: 1 }}
            />
          </View>
        )}

        {/* Share options */}
        <Card>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
            Share Invoice
          </Text>
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: c.muted,
                borderRadius: colors.radius,
                padding: 14,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.primary + "20", alignItems: "center", justifyContent: "center" }}>
                <MaterialIcons name="share" size={18} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>Share Invoice</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>Share via any app</Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={c.mutedForeground} />
            </Pressable>



            <Pressable
              onPress={handleEmail}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: c.muted,
                borderRadius: colors.radius,
                padding: 14,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#6366F120", alignItems: "center", justifyContent: "center" }}>
                <MaterialIcons name="email" size={18} color="#6366F1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>Send via Email</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>Open email app</Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={c.mutedForeground} />
            </Pressable>
          </View>
        </Card>
      </View>

      {/* Printable Order Label Modal */}
      <Modal
        visible={labelModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLabelModalOpen(false)}
      >
        <Pressable
          onPress={() => setLabelModalOpen(false)}
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
              padding: 20,
              gap: 14,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialIcons name="label" size={20} color={c.primary} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontFamily: "Inter_700Bold",
                  color: c.foreground,
                }}
              >
                Order Label
              </Text>
              <Pressable onPress={() => setLabelModalOpen(false)} hitSlop={8}>
                <MaterialIcons name="close" size={20} color={c.mutedForeground} />
              </Pressable>
            </View>

            <View
              style={{
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: c.border,
                borderRadius: colors.radius,
                padding: 18,
                gap: 8,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Inter_600SemiBold",
                  color: c.mutedForeground,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                }}
              >
                Order Number
              </Text>
              <Text
                style={{
                  fontSize: 32,
                  fontFamily: "Inter_700Bold",
                  color: c.primary,
                  letterSpacing: 1,
                }}
              >
                {displayOrderLabel(invoice)}
              </Text>
              <View
                style={{ width: "60%", height: 1, backgroundColor: c.border, marginVertical: 4 }}
              />
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: "Inter_600SemiBold",
                  color: c.foreground,
                  textAlign: "center",
                }}
              >
                {invoice.customerName}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_400Regular",
                  color: c.mutedForeground,
                }}
              >
                {invoice.customerMobile}
              </Text>
              <View style={{ width: "100%", marginTop: 6, gap: 4 }}>
                {invoice.items.map((item, idx) => (
                  <View key={idx} style={{ gap: 2 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Inter_500Medium",
                          color: c.foreground,
                        }}
                      >
                        {item.productType} {item.featureLabel ? `(${item.featureLabel})` : ""} x{item.quantity}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Inter_500Medium",
                          color: c.mutedForeground,
                        }}
                      >
                        {formatDate(invoice.createdAt)}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: "Inter_400Regular",
                        color: c.mutedForeground,
                      }}
                    >
                      {invoiceItemPersonLabel(item, invoice.customerName)}
                    </Text>
                    {item.measurementValues && Object.keys(item.measurementValues).length > 0 && (
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: "Inter_400Regular",
                          color: c.mutedForeground,
                          marginTop: 1,
                        }}
                      >
                        {Object.entries(item.measurementValues).map(([k, v]) => `${titleCase(k)}: ${v}`).join(", ")}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>

            <Button
              label="Print / Share Label"
              icon="share"
              onPress={async () => {
                const text =
                  `TAILOR BOOK — ORDER LABEL\n` +
                  `==============================\n` +
                  `Order: ${displayOrderLabel(invoice)}\n` +
                  `Invoice: ${invoice.invoiceNumber}\n` +
                  `Customer: ${invoice.customerName}\n` +
                  `Mobile: ${invoice.customerMobile}\n` +
                  `Date: ${formatDate(invoice.createdAt)}\n\n` +
                  `ITEMS\n` +
                  invoice.items
                    .map((i) => {
                      let desc = `- ${i.productType}${i.featureLabel ? ` (${i.featureLabel})` : ""} x${i.quantity} - ${invoiceItemPersonLabel(i, invoice.customerName)}`;
                      if (i.measurementValues && Object.keys(i.measurementValues).length > 0) {
                        const measList = Object.entries(i.measurementValues).map(([k, v]) => `${titleCase(k)}: ${v}`).join(", ");
                        desc += `\n  Measurements: ${measList}`;
                      }
                      desc += ` - ${formatCurrency(i.price * i.quantity)}`;
                      return desc;
                    })
                    .join("\n") +
                  `\n\nTotal: ${formatCurrency(invoice.total)}`;
                try {
                  await Share.share({ message: text, title: `Order ${displayOrderLabel(invoice)}` });
                } catch {}
              }}
              fullWidth
              size="md"
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Photo viewer modal */}
      <Modal visible={!!photoView} transparent animationType="fade" onRequestClose={() => setPhotoView(null)}>
        <Pressable
          onPress={() => setPhotoView(null)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" }}
        >
          {photoView && (
            <Image
              source={{ uri: base64ToDataUri(photoView) }}
              style={{ width: "92%", height: "78%", borderRadius: 12 }}
              resizeMode="contain"
            />
          )}
          <Pressable
            onPress={() => setPhotoView(null)}
            style={{ position: "absolute", top: insets.top + 20, right: 20, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
          >
            <MaterialIcons name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
