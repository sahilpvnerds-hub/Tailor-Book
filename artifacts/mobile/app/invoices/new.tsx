import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { Button, Card, Input } from "@/components/ui";
import { DEFAULT_PRODUCTS, GST_RATES } from "@/constants/products";
import { InvoiceItem } from "@/types";
import { formatCurrency } from "@/utils/storage";
import colors from "@/constants/colors";

export default function NewInvoiceScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    customerId?: string;
    customerName?: string;
    customerMobile?: string;
    productType?: string;
    measurementId?: string;
  }>();
  const { customers, createInvoice } = useData();

  const [selectedCustomerId, setSelectedCustomerId] = useState(params.customerId ?? "");
  const [gstRate, setGstRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      productType: params.productType ?? DEFAULT_PRODUCTS[0].name,
      quantity: 1,
      price: DEFAULT_PRODUCTS.find((p) => p.name === params.productType)?.price ?? DEFAULT_PRODUCTS[0].price,
      measurementId: params.measurementId,
    },
  ]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { productType: DEFAULT_PRODUCTS[0].name, quantity: 1, price: DEFAULT_PRODUCTS[0].price },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, key: keyof InvoiceItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (key === "productType") {
          const product = DEFAULT_PRODUCTS.find((p) => p.name === value);
          return { ...item, productType: value as string, price: product?.price ?? item.price };
        }
        return { ...item, [key]: value };
      })
    );
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const gstAmount = (subtotal * gstRate) / 100;
  const total = subtotal + gstAmount;

  async function handleCreate() {
    if (!selectedCustomerId) { Alert.alert("Error", "Please select a customer"); return; }
    if (items.length === 0) { Alert.alert("Error", "Add at least one item"); return; }
    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (!customer) { Alert.alert("Error", "Customer not found"); return; }

    setLoading(true);
    const invoice = await createInvoice({
      customerId: selectedCustomerId,
      customerName: customer.name,
      customerMobile: customer.mobile,
      items,
      gstRate,
      notes,
    });
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/invoices/${invoice.id}` as any);
  }

  const topPad = Platform.OS === "web" ? 67 : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
          gap: 14,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ backgroundColor: c.muted, borderRadius: 10, padding: 8 }}>
          <MaterialIcons name="arrow-back" size={20} color={c.foreground} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: c.foreground }}>
          New Invoice
        </Text>
        <Button label="Create" onPress={handleCreate} loading={loading} size="sm" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Customer */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
            Customer *
          </Text>
          {params.customerId && selectedCustomer ? (
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.primary + "20", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", color: c.primary }}>{selectedCustomer.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>{selectedCustomer.name}</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>{selectedCustomer.mobile}</Text>
              </View>
            </Card>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {customers.map((cust) => (
                  <Pressable
                    key={cust.id}
                    onPress={() => setSelectedCustomerId(cust.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: colors.radius,
                      backgroundColor: selectedCustomerId === cust.id ? c.primary : c.card,
                      borderWidth: 1,
                      borderColor: selectedCustomerId === cust.id ? c.primary : c.border,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: selectedCustomerId === cust.id ? c.primaryForeground : c.foreground }}>
                      {cust.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Items */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>Order Items</Text>
            <Pressable onPress={addItem} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MaterialIcons name="add" size={16} color={c.primary} />
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.primary }}>Add Item</Text>
            </Pressable>
          </View>

          {items.map((item, index) => (
            <Card key={index} style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                  Item {index + 1}
                </Text>
                {items.length > 1 && (
                  <Pressable onPress={() => removeItem(index)}>
                    <MaterialIcons name="close" size={18} color={c.destructive} />
                  </Pressable>
                )}
              </View>

              {/* Product select */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {DEFAULT_PRODUCTS.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => updateItem(index, "productType", p.name)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 16,
                        backgroundColor: item.productType === p.name ? c.primary : c.muted,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: item.productType === p.name ? c.primaryForeground : c.mutedForeground }}>
                        {p.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>Qty</Text>
                  <TextInput
                    style={{
                      fontSize: 15,
                      fontFamily: "Inter_400Regular",
                      color: c.foreground,
                      backgroundColor: c.input,
                      borderRadius: 8,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: c.border,
                      textAlign: "center",
                    }}
                    value={String(item.quantity)}
                    onChangeText={(v) => updateItem(index, "quantity", parseInt(v) || 1)}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 2, gap: 4 }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>Price (₹)</Text>
                  <TextInput
                    style={{
                      fontSize: 15,
                      fontFamily: "Inter_400Regular",
                      color: c.foreground,
                      backgroundColor: c.input,
                      borderRadius: 8,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: c.border,
                    }}
                    value={String(item.price)}
                    onChangeText={(v) => updateItem(index, "price", parseFloat(v) || 0)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ gap: 4, justifyContent: "flex-end" }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>Total</Text>
                  <View style={{ backgroundColor: c.muted, borderRadius: 8, padding: 10 }}>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.foreground }}>
                      {formatCurrency(item.price * item.quantity)}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* GST */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>GST Rate</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {GST_RATES.map((rate) => (
              <Pressable
                key={rate}
                onPress={() => setGstRate(rate)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: gstRate === rate ? c.primary : c.muted,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: gstRate === rate ? c.primaryForeground : c.mutedForeground }}>
                  {rate}%
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Summary */}
        <Card style={{ gap: 10 }}>
          <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground, marginBottom: 4 }}>
            Summary
          </Text>
          {[
            { label: "Subtotal", value: formatCurrency(subtotal) },
            { label: `GST (${gstRate}%)`, value: formatCurrency(gstAmount) },
          ].map((row) => (
            <View key={row.label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>{row.label}</Text>
              <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: c.foreground }}>{row.value}</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: c.border }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>Total</Text>
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.primary }}>{formatCurrency(total)}</Text>
          </View>
        </Card>

        {/* Notes */}
        <Input
          label="Notes"
          placeholder="Additional notes..."
          value={notes}
          onChangeText={setNotes}
          icon="notes"
          multiline
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
