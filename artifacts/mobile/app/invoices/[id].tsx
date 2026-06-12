import React, { useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, Share, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { Badge, Button, Card, Divider } from "@/components/ui";
import { formatCurrency, formatDate } from "@/utils/storage";
import { Invoice } from "@/types";
import colors from "@/constants/colors";

function buildInvoiceText(invoice: Invoice): string {
  const lines = [
    `TAILOR BOOK - INVOICE`,
    `============================`,
    `Invoice #: ${invoice.invoiceNumber}`,
    `Date: ${formatDate(invoice.createdAt)}`,
    ``,
    `CUSTOMER DETAILS`,
    `Name: ${invoice.customerName}`,
    `Mobile: ${invoice.customerMobile}`,
    ``,
    `ORDER ITEMS`,
    ...invoice.items.map(
      (item) =>
        `${item.productType} x${item.quantity} @ ${formatCurrency(item.price)} = ${formatCurrency(item.price * item.quantity)}`
    ),
    ``,
    `Subtotal: ${formatCurrency(invoice.subtotal)}`,
    invoice.gstRate > 0 ? `GST (${invoice.gstRate}%): ${formatCurrency(invoice.gstAmount)}` : "",
    `TOTAL: ${formatCurrency(invoice.total)}`,
    ``,
    `Status: ${invoice.status.toUpperCase()}`,
    invoice.notes ? `Notes: ${invoice.notes}` : "",
    `============================`,
    `Thank you for choosing us!`,
  ]
    .filter((l) => l !== undefined && l !== null)
    .join("\n");
  return lines;
}

export default function InvoiceDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { invoices, updateInvoiceStatus } = useData();
  const invoice = invoices.find((i) => i.id === id);

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
    await updateInvoiceStatus(invoice!.id, status);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
            {invoice.items.map((item, idx) => (
              <React.Fragment key={idx}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, alignItems: "center" }}>
                  <View>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_500Medium", color: c.foreground }}>{item.productType}</Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                      {item.quantity} x {formatCurrency(item.price)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.foreground }}>
                    {formatCurrency(item.price * item.quantity)}
                  </Text>
                </View>
                {idx < invoice.items.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </View>

          <Divider style={{ marginVertical: 8 }} />

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>Subtotal</Text>
              <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: c.foreground }}>{formatCurrency(invoice.subtotal)}</Text>
            </View>
            {invoice.gstRate > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>GST ({invoice.gstRate}%)</Text>
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: c.foreground }}>{formatCurrency(invoice.gstAmount)}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 4 }}>
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>Total</Text>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#059669" }}>{formatCurrency(invoice.total)}</Text>
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
              onPress={handleWhatsApp}
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
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#25D36620", alignItems: "center", justifyContent: "center" }}>
                <MaterialIcons name="message" size={18} color="#25D366" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>Send via WhatsApp</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>Open in WhatsApp</Text>
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
    </ScrollView>
  );
}
