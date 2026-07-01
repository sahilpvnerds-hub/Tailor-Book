import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { MeasurementKey } from "@/constants/measurementFields";
import { useWebModalBlur } from "@/hooks/useWebModalBlur";
import { useData } from "@/context/DataContext";
import { Button, Card, Input } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { InvoiceItem } from "@/types";
import { formatCurrency, formatDate } from "@/utils/storage";
import { base64ToDataUri } from "@/utils/photos";
import colors from "@/constants/colors";

const CUSTOMER_INLINE_LIMIT = 20;

function titleCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

export default function NewInvoiceScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    customerId?: string;
    customerName?: string;
    customerMobile?: string;
    measurementId?: string;
  }>();
  const { customers, productTypes, createInvoice, measurements, familyMembers } = useData();

  const sourceMeasurement = params.measurementId
    ? measurements.find((m) => m.id === params.measurementId)
    : undefined;
  const sourceFamilyMember = sourceMeasurement?.familyMemberId
    ? familyMembers.find((fm) => fm.id === sourceMeasurement.familyMemberId)
    : undefined;

  const [customerSearch, setCustomerSearch] = useState(params.customerName ?? "");
  const [selectedCustomerId, setSelectedCustomerId] = useState(params.customerId ?? "");
  const [showCustomerList, setShowCustomerList] = useState(!params.customerId);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  useWebModalBlur(showCustomerModal);
  const [modalSearch, setModalSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(
    sourceMeasurement?.deliveryDate?.split("T")[0] ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>(() => {
    // Pre-populate from the source measurement if provided.
    if (sourceMeasurement) {
      const pt = productTypes.find((p) => p.id === sourceMeasurement.productTypeId)
        ?? productTypes.find((p) => p.name === sourceMeasurement.productType);
      const m: Record<string, string> = {};
      MEASUREMENT_KEYS.forEach((k) => {
        const v = (sourceMeasurement as any)[k];
        if (typeof v === "number" && v > 0) m[k] = `${v}"`;
      });
      sourceMeasurement.customMeasurements?.forEach((cm) => {
        if (cm.value > 0) m[cm.label] = `${cm.value}"`;
      });
      return [{
        productType: sourceMeasurement.productType,
        productTypeId: pt?.id,
        featureLabel: sourceMeasurement.featureLabel,
        quantity: 1,
        price: pt?.amount ?? 0,
        measurementId: sourceMeasurement.id,
        measurementValues: m,
        familyMemberId: sourceMeasurement.familyMemberId ?? null,
        familyMemberName: sourceFamilyMember?.name ?? sourceMeasurement.familyMemberName,
        personName: sourceFamilyMember?.name ?? sourceMeasurement.familyMemberName ?? sourceMeasurement.customerName,
        relation: sourceFamilyMember?.relation ?? "self",
      }];
    }
    return [
      {
        productType: productTypes[0]?.name ?? "",
        productTypeId: productTypes[0]?.id,
        quantity: 1,
        price: productTypes[0]?.amount ?? 0,
      },
    ];
  });

  const filteredCustomers = customers.filter(
    (cu) =>
      cu.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      cu.mobile.includes(customerSearch)
  );
  const modalFiltered = customers.filter(
    (cu) =>
      cu.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
      cu.mobile.includes(modalSearch)
  );
  const useModalPicker = customers.length > CUSTOMER_INLINE_LIMIT;

  const selectedCustomer = customers.find((cu) => cu.id === selectedCustomerId);
  // Family members belonging to the selected primary customer
  const customerFamilyMembers = familyMembers.filter(
    (fm) => fm.primaryCustomerId === selectedCustomerId
  );
  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);

  function selectCustomer(id: string) {
    const cu = customers.find((c) => c.id === id);
    if (cu) {
      setSelectedCustomerId(id);
      setCustomerSearch(cu.name);
      setShowCustomerList(false);
      setShowCustomerModal(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function openModalPicker() {
    setShowCustomerModal(true);
    setModalSearch("");
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
      deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
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

        {/* Source measurement banner */}
        {sourceMeasurement && (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Linked Measurement
              </Text>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                {formatDate(sourceMeasurement.date ?? sourceMeasurement.measurementDate ?? sourceMeasurement.createdAt)}
              </Text>
            </View>
            <View style={{ gap: 8, marginBottom: sourceMeasurement.photos?.length ? 12 : 0 }}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                Customer: {sourceMeasurement.customerName}
              </Text>
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                Measurement For: {sourceFamilyMember?.name ?? sourceMeasurement.familyMemberName ?? sourceMeasurement.customerName} ({titleCase(sourceFamilyMember?.relation ?? "self")})
              </Text>
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                Product: {sourceMeasurement.productType}
              </Text>
            </View>
            {!!sourceMeasurement.photos?.length && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {sourceMeasurement.photos.map((p, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: base64ToDataUri(p) }}
                    style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: c.muted }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            )}
          </Card>
        )}

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
          ) : useModalPicker ? (
            <Pressable
              onPress={openModalPicker}
              style={({ pressed }) => ({
                backgroundColor: c.card,
                borderRadius: colors.radius,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderWidth: 1.5,
                borderColor: c.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <MaterialIcons name="person-search" size={20} color={c.mutedForeground} />
              <Text style={{ flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
                Choose a customer ({customers.length} total)
              </Text>
              <MaterialIcons name="arrow-forward" size={18} color={c.mutedForeground} />
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

              {/* Family member association (who is this item for?) */}
              {selectedCustomer && (
                <View style={{ gap: 5 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    For
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                    <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }}>
                      {/* Primary customer chip */}
                      <Pressable
                        onPress={() => {
                          setItems((prev) => {
                            const updated = [...prev];
                            updated[idx] = {
                              ...updated[idx],
                              familyMemberId: null,
                              familyMemberName: undefined,
                              personName: selectedCustomer.name,
                              relation: "self",
                            };
                            return updated;
                          });
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 20,
                          backgroundColor: !item.familyMemberId ? c.primary : c.muted,
                          borderWidth: 1,
                          borderColor: !item.familyMemberId ? c.primary : "transparent",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <MaterialIcons name="person" size={12} color={!item.familyMemberId ? "#FFFFFF" : c.mutedForeground} />
                        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: !item.familyMemberId ? "#FFFFFF" : c.mutedForeground }}>
                          {selectedCustomer.name}
                        </Text>
                      </Pressable>
                      {/* Family member chips */}
                      {customerFamilyMembers.map((fm) => (
                        <Pressable
                          key={fm.id}
                          onPress={() => {
                            setItems((prev) => {
                              const updated = [...prev];
                              updated[idx] = {
                                ...updated[idx],
                                familyMemberId: fm.id,
                                familyMemberName: fm.name,
                                personName: fm.name,
                                relation: fm.relation,
                              };
                              return updated;
                            });
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 20,
                            backgroundColor: item.familyMemberId === fm.id ? "#6366F1" : c.muted,
                            borderWidth: 1,
                            borderColor: item.familyMemberId === fm.id ? "#6366F1" : "transparent",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <MaterialIcons name="group" size={12} color={item.familyMemberId === fm.id ? "#FFFFFF" : c.mutedForeground} />
                          <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: item.familyMemberId === fm.id ? "#FFFFFF" : c.mutedForeground }}>
                            {fm.name}
                          </Text>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: item.familyMemberId === fm.id ? "rgba(255,255,255,0.7)" : c.mutedForeground }}>
                            ({fm.relation})
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

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
                    value={item.price === 0 ? "" : String(item.price)}
                    onChangeText={(v) => {
                      // Allow digits + single decimal point so mid-typing values like "12." don't get clipped
                      const cleaned = v.replace(/[^0-9.]/g, "");
                      const parts = cleaned.split(".");
                      const safe = parts.length > 1 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
                      const num = safe === "" ? 0 : parseFloat(safe);
                      updateItem(idx, "price", Number.isFinite(num) ? num : 0);
                    }}
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

        {/* Notes & Delivery Date */}
        <Input label="Notes" placeholder="Special instructions..." value={notes} onChangeText={(v) => setNotes(v.slice(0, 500))} icon="notes" multiline maxLength={500} />
        <DatePicker
          label="Delivery Date"
          value={deliveryDate}
          onChange={setDeliveryDate}
          placeholder="Select delivery date"
        />

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

      {/* Customer picker modal (used when there are many customers) */}
      <Modal visible={showCustomerModal} transparent animationType="slide" onRequestClose={() => setShowCustomerModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={{
              backgroundColor: c.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              paddingBottom: insets.bottom + 24,
              maxHeight: "85%",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
                Choose Customer
              </Text>
              <Pressable onPress={() => setShowCustomerModal(false)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={22} color={c.mutedForeground} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.input, borderRadius: colors.radius, borderWidth: 1.5, borderColor: c.border, paddingHorizontal: 14, marginBottom: 12 }}>
              <MaterialIcons name="search" size={18} color={c.mutedForeground} style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: c.foreground, paddingVertical: 12 }}
                placeholder="Search by name or mobile..."
                placeholderTextColor={c.mutedForeground}
                value={modalSearch}
                onChangeText={setModalSearch}
                autoFocus
              />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 480 }}>
              {modalFiltered.length === 0 ? (
                <View style={{ alignItems: "center", padding: 24, gap: 6 }}>
                  <MaterialIcons name="person-off" size={28} color={c.mutedForeground} />
                  <Text style={{ fontSize: 13, color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
                    No customers match "{modalSearch}"
                  </Text>
                </View>
              ) : (
                modalFiltered.map((cu) => (
                  <Pressable
                    key={cu.id}
                    onPress={() => selectCustomer(cu.id)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 12,
                      gap: 12,
                      backgroundColor: pressed ? c.muted : "transparent",
                      borderRadius: colors.radius,
                    })}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary + "18", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.primary }}>{cu.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>{cu.name}</Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>{cu.mobile}</Text>
                    </View>
                    <MaterialIcons name="arrow-forward" size={18} color={c.mutedForeground} />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// Source measurement values that map directly to the measurement table's typed fields.
const MEASUREMENT_KEYS = [
  "chest", "shoulder", "neck", "sleeve", "waist",
  "length", "hip", "thigh", "pantLength", "bottomWidth",
  "armhole", "wrist",
] as const;
