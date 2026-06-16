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
import { Button, Input } from "@/components/ui";
import { InvoiceItem } from "@/types";
import { formatCurrency } from "@/utils/storage";
import colors from "@/constants/colors";

export default function NewInvoiceScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ customerId?: string; customerName?: string; customerMobile?: string }>();
  const { customers, productTypes, createInvoice } = useData();

  const [customerSearch, setCustomerSearch] = useState(params.customerName ?? "");
  const [selectedCustomerId, setSelectedCustomerId] = useState(params.customerId ?? "");
  const [showCustomerList, setShowCustomerList] = useState(!params.customerId);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([
    { productType: productTypes[0]?.name ?? "", productTypeId: productTypes[0]?.id, quantity: 1, price: productTypes[0]?.amount ?? 0 },
  ]);

  const filteredCustomers = customers.filter(
    (cu) =>
      cu.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      cu.mobile.includes(customerSearch)
  );

  const selectedCustomer = customers.find((cu) => cu.id === selectedCustomerId);
  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);

  function selectCustomer(id: string) {
    const cu = customers.find((c) => c.id === id);
    if (cu) {
      setSelectedCustomerId(id);
      setCustomerSearch(cu.name);
      setShowCustomerList(false);
    }
  }

  function addItem() {
    const first = productTypes[0];
    setItems((prev) => [...prev, {
      productType: first?.name ?? "",
      productTypeId: first?.id,
      quantity: 1,
      price: first?.amount ?? 0,
    }]);
  }

  function removeItem(idx: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof InvoiceItem, value: any) {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      // Auto-fill price when product type changes
      if (field === "productTypeId") {
        const pt = productTypes.find((p) => p.id === value);
        if (pt) {
          updated[idx].productType = pt.name;
          updated[idx].price = pt.amount;
        }
      }
      return updated;
    });
  }

  async function handleCreate() {
    if (!selectedCustomerId) { Alert.alert("Error", "Please select a customer"); return; }
    if (items.some((it) => !it.productType)) { Alert.alert("Error", "Each item needs a product type"); return; }
    if (items.some((it) => it.price <= 0)) { Alert.alert("Error", "Each item must have a valid price"); return; }

    const customer = customers.find((cu) => cu.id === selectedCustomerId);
    if (!customer) { Alert.alert("Error", "Customer not found"); return; }

    setLoading(true);
    const invoice = await createInvoice({
      customerId: selectedCustomerId,
      customerName: customer.name,
      customerMobile: customer.mobile,
      items,
      notes: notes.trim() || undefined,
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
      <View style={{ paddingTop: insets.top + topPad + 16, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} style={{ backgroundColor: c.muted, borderRadius: 10, padding: 8 }}>
          <MaterialIcons name="arrow-back" size={20} color={c.foreground} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>New Invoice</Text>
        <Button label="Create" onPress={handleCreate} loading={loading} size="sm" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 50 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Customer Search */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Customer *
          </Text>

          {selectedCustomer && !showCustomerList ? (
            <Pressable
              onPress={() => { setShowCustomerList(true); setSelectedCustomerId(""); }}
              style={{ backgroundColor: c.card, borderRadius: colors.radius, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: c.primary }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary + "20", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: c.primary }}>{selectedCustomer.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>{selectedCustomer.name}</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>{selectedCustomer.mobile}</Text>
              </View>
              <MaterialIcons name="edit" size={16} color={c.mutedForeground} />
            </Pressable>
          ) : (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.input, borderRadius: colors.radius, borderWidth: 1.5, borderColor: c.border, paddingHorizontal: 14 }}>
                <MaterialIcons name="search" size={18} color={c.mutedForeground} style={{ marginRight: 8 }} />
                <TextInput
                  style={{ flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: c.foreground, paddingVertical: 12 }}
                  placeholder="Search by name or mobile..."
                  placeholderTextColor={c.mutedForeground}
                  value={customerSearch}
                  onChangeText={(v) => { setCustomerSearch(v); setShowCustomerList(true); }}
                  autoFocus={!params.customerId}
                />
                {customerSearch.length > 0 && (
                  <Pressable onPress={() => { setCustomerSearch(""); setSelectedCustomerId(""); }}>
                    <MaterialIcons name="close" size={18} color={c.mutedForeground} />
                  </Pressable>
                )}
              </View>
              {filteredCustomers.length > 0 && (
                <View style={{ backgroundColor: c.card, borderRadius: colors.radius, borderWidth: 1, borderColor: c.border, overflow: "hidden", maxHeight: 200 }}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filteredCustomers.map((cu, i) => (
                      <Pressable
                        key={cu.id}
                        onPress={() => selectCustomer(cu.id)}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          padding: 12,
                          gap: 10,
                          backgroundColor: pressed ? c.muted : "transparent",
                          borderBottomWidth: i < filteredCustomers.length - 1 ? 1 : 0,
                          borderBottomColor: c.border,
                        })}
                      >
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.primary + "18", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.primary }}>{cu.name[0]}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>{cu.name}</Text>
                          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>{cu.mobile}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Items */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Order Items
            </Text>
            <Pressable onPress={addItem} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MaterialIcons name="add" size={16} color={c.primary} />
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.primary }}>Add Item</Text>
            </Pressable>
          </View>

          {items.map((item, idx) => (
            <View key={idx} style={{ backgroundColor: c.card, borderRadius: colors.radius, padding: 14, gap: 12, borderWidth: 1, borderColor: c.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>Item {idx + 1}</Text>
                {items.length > 1 && (
                  <Pressable onPress={() => removeItem(idx)} style={{ padding: 4 }}>
                    <MaterialIcons name="remove-circle" size={20} color={c.destructive} />
                  </Pressable>
                )}
              </View>

              {/* Product Type */}
              <View style={{ gap: 5 }}>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4 }}>Product</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                  <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }}>
                    {productTypes.map((pt) => (
                      <Pressable
                        key={pt.id}
                        onPress={() => updateItem(idx, "productTypeId", pt.id)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 20,
                          backgroundColor: item.productTypeId === pt.id ? c.primary : c.muted,
                          borderWidth: 1,
                          borderColor: item.productTypeId === pt.id ? c.primary : "transparent",
                        }}
                      >
                        <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: item.productTypeId === pt.id ? "#FFFFFF" : c.mutedForeground }}>
                          {pt.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Qty & Price */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 }}>Qty</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.input, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: c.border }}>
                    <Pressable onPress={() => updateItem(idx, "quantity", Math.max(1, item.quantity - 1))}>
                      <MaterialIcons name="remove" size={18} color={c.foreground} />
                    </Pressable>
                    <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>{item.quantity}</Text>
                    <Pressable onPress={() => updateItem(idx, "quantity", item.quantity + 1)}>
                      <MaterialIcons name="add" size={18} color={c.foreground} />
                    </Pressable>
                  </View>
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 }}>Price (₹)</Text>
                  <TextInput
                    style={{ backgroundColor: c.input, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground, borderWidth: 1, borderColor: c.border }}
                    value={String(item.price)}
                    onChangeText={(v) => updateItem(idx, "price", parseFloat(v) || 0)}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.primary }}>
                  Item total: {formatCurrency(item.price * item.quantity)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Notes */}
        <Input label="Notes" placeholder="Special instructions..." value={notes} onChangeText={setNotes} icon="notes" multiline />

        {/* Total */}
        <View style={{ backgroundColor: c.primary, borderRadius: 18, padding: 18, gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" }}>
              {items.length} item{items.length > 1 ? "s" : ""}
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" }}>
              Subtotal: {formatCurrency(subtotal)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>Total</Text>
            <Text style={{ fontSize: 26, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
              {formatCurrency(subtotal)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
