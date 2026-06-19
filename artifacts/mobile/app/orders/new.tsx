import React, { useState, useMemo } from "react";
import {
  Alert,
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
import { useData } from "@/context/DataContext";
import { Button, Card, Input } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { OrderItem, Relation } from "@/types";
import { formatCurrency, formatDate } from "@/utils/storage";
import colors from "@/constants/colors";

const CUSTOMER_INLINE_LIMIT = 20;

const MEASUREMENT_KEYS = [
  "chest", "shoulder", "neck", "sleeve", "waist", "length",
  "hip", "thigh", "pantLength", "bottomWidth", "armhole", "wrist"
];

function titleCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

export default function NewOrderScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    customerId?: string;
    measurementId?: string;
  }>();

  const { customers, productTypes, measurements, familyMembers, addOrder } = useData();

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(params.customerId ?? "");
  const [showCustomerList, setShowCustomerList] = useState(!params.customerId);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [loading, setLoading] = useState(false);

  // Selected customer details
  const selectedCustomer = customers.find((cu) => cu.id === selectedCustomerId);
  
  // Initialize customer search field with preselected customer name
  useState(() => {
    if (selectedCustomer) {
      setCustomerSearch(selectedCustomer.name);
    }
  });

  // Get family members for the customer
  const customerFamilyMembers = useMemo(() => {
    return familyMembers.filter((fm) => fm.primaryCustomerId === selectedCustomerId);
  }, [familyMembers, selectedCustomerId]);

  // Get measurements for the customer and family members
  const customerMeasurements = useMemo(() => {
    if (!selectedCustomerId) return [];
    return measurements.filter((m) => m.customerId === selectedCustomerId);
  }, [measurements, selectedCustomerId]);

  // State to track which measurements are selected
  // Key: measurementId, Value: true/false
  const [selectedMeasurementIds, setSelectedMeasurementIds] = useState<Record<string, boolean>>(() => {
    if (params.measurementId) {
      return { [params.measurementId]: true };
    }
    return {};
  });

  // Custom (manual) items to add to the order
  const [manualItems, setManualItems] = useState<any[]>([]);

  // Local state for pricing/quantities of measurements
  // Key: measurementId, Value: { price: number, quantity: number }
  const [measurementItemsConfig, setMeasurementItemsConfig] = useState<Record<string, { price: number; quantity: number }>>({});

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

  function selectCustomer(id: string) {
    const cu = customers.find((c) => c.id === id);
    if (cu) {
      setSelectedCustomerId(id);
      setCustomerSearch(cu.name);
      setShowCustomerList(false);
      setShowCustomerModal(false);
      setSelectedMeasurementIds({});
      setMeasurementItemsConfig({});
      setManualItems([]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function toggleMeasurement(measurementId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMeasurementIds((prev) => {
      const next = { ...prev, [measurementId]: !prev[measurementId] };
      // Prefill configuration if checked and missing
      if (next[measurementId] && !measurementItemsConfig[measurementId]) {
        const meas = measurements.find((m) => m.id === measurementId);
        const pt = productTypes.find((p) => p.name.toLowerCase() === meas?.productType.toLowerCase());
        setMeasurementItemsConfig((config) => ({
          ...config,
          [measurementId]: {
            price: pt?.amount ? Number(pt.amount) : 0,
            quantity: 1,
          },
        }));
      }
      return next;
    });
  }

  const activeMeasurementItems = useMemo(() => {
    return customerMeasurements.filter((m) => selectedMeasurementIds[m.id]);
  }, [customerMeasurements, selectedMeasurementIds]);

  const orderItemsList = useMemo(() => {
    const list: any[] = [];
    
    // 1. Add checked measurements
    activeMeasurementItems.forEach((meas) => {
      const config = measurementItemsConfig[meas.id] || { price: 0, quantity: 1 };
      const mValues: Record<string, string> = {};
      MEASUREMENT_KEYS.forEach((k) => {
        const v = (meas as any)[k];
        if (typeof v === "number" && v > 0) mValues[k] = `${v}"`;
      });
      meas.customMeasurements?.forEach((cm) => {
        if (cm.value > 0) mValues[cm.label] = `${cm.value}"`;
      });

      const member = meas.familyMemberId
        ? familyMembers.find((fm) => fm.id === meas.familyMemberId)
        : undefined;

      list.push({
        productType: meas.productType,
        featureLabel: meas.featureLabel,
        quantity: config.quantity,
        price: config.price,
        measurementId: meas.id,
        familyMemberId: meas.familyMemberId ?? null,
        personName: member?.name ?? meas.customerName ?? selectedCustomer?.name,
        relation: member?.relation ?? "self",
        measurementValues: mValues,
      });
    });

    // 2. Add manual items
    manualItems.forEach((it) => {
      const pt = productTypes.find((p) => p.id === it.productTypeId);
      const member = it.familyMemberId
        ? familyMembers.find((fm) => fm.id === it.familyMemberId)
        : undefined;

      list.push({
        productType: pt?.name ?? it.productType ?? "",
        featureLabel: it.featureLabel ?? null,
        quantity: it.quantity,
        price: it.price,
        measurementId: null,
        familyMemberId: it.familyMemberId ?? null,
        personName: member?.name ?? selectedCustomer?.name,
        relation: member?.relation ?? "self",
        measurementValues: null,
      });
    });

    return list;
  }, [activeMeasurementItems, measurementItemsConfig, manualItems, familyMembers, selectedCustomer, productTypes]);

  const totalAmount = useMemo(() => {
    return orderItemsList.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [orderItemsList]);

  const advancePaid = useMemo(() => {
    const n = Number(advanceAmount.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : Math.min(n, totalAmount);
  }, [advanceAmount, totalAmount]);

  const balanceDue = useMemo(() => totalAmount - advancePaid, [totalAmount, advancePaid]);

  function addManualItem() {
    const firstPt = productTypes[0];
    setManualItems((prev) => [
      ...prev,
      {
        productTypeId: firstPt?.id ?? "",
        productType: firstPt?.name ?? "",
        featureLabel: "",
        quantity: 1,
        price: firstPt?.amount ? Number(firstPt.amount) : 0,
        familyMemberId: null, // default to self
      },
    ]);
  }

  function removeManualItem(idx: number) {
    setManualItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateManualItem(idx: number, field: string, value: any) {
    setManualItems((prev) => {
      const updated = [...prev];
      if (field === "productTypeId") {
        const pt = productTypes.find((p) => p.id === value);
        updated[idx] = {
          ...updated[idx],
          productTypeId: value,
          productType: pt?.name ?? "",
          price: pt?.amount ? Number(pt.amount) : 0,
        };
      } else {
        updated[idx] = { ...updated[idx], [field]: value };
      }
      return updated;
    });
  }

  function updateMeasurementItemConfig(measurementId: string, field: "price" | "quantity", value: number) {
    setMeasurementItemsConfig((prev) => ({
      ...prev,
      [measurementId]: {
        ...(prev[measurementId] || { price: 0, quantity: 1 }),
        [field]: value,
      },
    }));
  }

  async function handleSave() {
    if (!selectedCustomerId || !selectedCustomer) {
      Alert.alert("Error", "Please select a customer");
      return;
    }
    if (orderItemsList.length === 0) {
      Alert.alert("Error", "Please include at least one measurement or item in the order");
      return;
    }

    setLoading(true);
    try {
      await addOrder({
        customerId: selectedCustomerId,
        customerName: selectedCustomer.name,
        customerMobile: selectedCustomer.mobile,
        deliveryDate: deliveryDate || undefined,
        notes: notes || undefined,
        advanceAmount: advancePaid,
        items: orderItemsList,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Family order created successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to create order");
    } finally {
      setLoading(false);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: c.background }}
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
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={24} color={c.foreground} />
        </Pressable>
        <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: c.foreground }}>
          Create Family Order
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: insets.bottom + 40 }}>
        {/* Customer Picker */}
        <Card style={{ padding: 16, gap: 12 }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.mutedForeground }}>
            Customer Details
          </Text>
          <View style={{ position: "relative" }}>
            <Input
              placeholder="Search Customer..."
              value={customerSearch}
              onChangeText={(text) => {
                setCustomerSearch(text);
                setShowCustomerList(true);
                if (selectedCustomerId) {
                  setSelectedCustomerId("");
                }
              }}
              onFocus={() => {
                if (useModalPicker) {
                  setShowCustomerModal(true);
                } else {
                  setShowCustomerList(true);
                }
              }}
              rightElement={
                useModalPicker ? (
                  <Pressable onPress={() => setShowCustomerModal(true)} style={{ padding: 8 }}>
                    <MaterialIcons name="search" size={20} color={c.mutedForeground} />
                  </Pressable>
                ) : undefined
              }
            />
            {showCustomerList && !useModalPicker && customerSearch.length > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: 50,
                  left: 0,
                  right: 0,
                  backgroundColor: c.card,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: c.border,
                  maxHeight: 200,
                  zIndex: 10,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 10,
                  elevation: 5,
                }}
              >
                <ScrollView keyboardShouldPersistTaps="handled">
                  {filteredCustomers.map((cu) => (
                    <Pressable
                      key={cu.id}
                      onPress={() => selectCustomer(cu.id)}
                      style={{
                        padding: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: c.border,
                      }}
                    >
                      <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                        {cu.name}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 2 }}>
                        {cu.mobile}
                      </Text>
                    </Pressable>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <Text style={{ padding: 16, textAlign: "center", color: c.mutedForeground }}>
                      No customers found
                    </Text>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {selectedCustomer && (
            <View style={{ backgroundColor: c.muted + "40", borderRadius: 8, padding: 12, marginTop: 4 }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                Primary Customer: {selectedCustomer.name}
              </Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 2 }}>
                Phone: {selectedCustomer.mobile}
              </Text>
            </View>
          )}
        </Card>

        {/* Measurements List to select from */}
        {selectedCustomerId ? (
          <Card style={{ padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.mutedForeground }}>
              Select Measurements to Include
            </Text>

            {customerMeasurements.length === 0 ? (
              <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground, textAlign: "center", paddingVertical: 12 }}>
                No measurements saved for this customer or family. Save measurements first.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {customerMeasurements.map((meas) => {
                  const isChecked = !!selectedMeasurementIds[meas.id];
                  const config = measurementItemsConfig[meas.id] || { price: 0, quantity: 1 };
                  
                  // Find relation/name of member
                  const member = meas.familyMemberId
                    ? familyMembers.find((fm) => fm.id === meas.familyMemberId)
                    : undefined;
                  const personLabel = member
                    ? `${member.name} (${titleCase(member.relation)})`
                    : "Primary Customer (Self)";

                  return (
                    <View
                      key={meas.id}
                      style={{
                        borderWidth: 1,
                        borderColor: isChecked ? c.primary : c.border,
                        borderRadius: 8,
                        padding: 12,
                        backgroundColor: isChecked ? c.primary + "06" : c.card,
                      }}
                    >
                      <Pressable
                        onPress={() => toggleMeasurement(meas.id)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                      >
                        <MaterialIcons
                          name={isChecked ? "check-box" : "check-box-outline-blank"}
                          size={24}
                          color={isChecked ? c.primary : c.mutedForeground}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                            {meas.productType} {meas.featureLabel ? `(${meas.featureLabel})` : ""}
                          </Text>
                          <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.mutedForeground, marginTop: 2 }}>
                            {personLabel} · {formatDate(meas.createdAt)}
                          </Text>
                        </View>
                      </Pressable>

                      {isChecked && (
                        <View style={{ flexDirection: "row", gap: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: c.border + "50", paddingTop: 10 }}>
                          <View style={{ flex: 2 }}>
                            <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.mutedForeground, marginBottom: 4 }}>
                              Price (₹)
                            </Text>
                            <TextInput
                              keyboardType="numeric"
                              style={{
                                borderWidth: 1,
                                borderColor: c.border,
                                borderRadius: 6,
                                paddingVertical: 6,
                                paddingHorizontal: 10,
                                fontSize: 14,
                                color: c.foreground,
                                backgroundColor: c.input,
                              }}
                              value={String(config.price)}
                              onChangeText={(val) => {
                                const num = Number(val.replace(/[^0-9]/g, ""));
                                updateMeasurementItemConfig(meas.id, "price", num);
                              }}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.mutedForeground, marginBottom: 4 }}>
                              Qty
                            </Text>
                            <TextInput
                              keyboardType="numeric"
                              style={{
                                borderWidth: 1,
                                borderColor: c.border,
                                borderRadius: 6,
                                paddingVertical: 6,
                                paddingHorizontal: 10,
                                fontSize: 14,
                                color: c.foreground,
                                backgroundColor: c.input,
                                textAlign: "center",
                              }}
                              value={String(config.quantity)}
                              onChangeText={(val) => {
                                const num = Math.max(1, Number(val.replace(/[^0-9]/g, "")) || 1);
                                updateMeasurementItemConfig(meas.id, "quantity", num);
                              }}
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        ) : null}

        {/* Manual/Custom Items */}
        {selectedCustomerId ? (
          <Card style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.mutedForeground }}>
                Other Custom Items
              </Text>
              <Pressable
                onPress={addManualItem}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <MaterialIcons name="add" size={16} color={c.primary} />
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.primary }}>
                  Add Item
                </Text>
              </Pressable>
            </View>

            {manualItems.map((item, idx) => (
              <View
                key={idx}
                style={{
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 8,
                  padding: 12,
                  backgroundColor: c.card,
                  gap: 12,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                    Custom Item #{idx + 1}
                  </Text>
                  <Pressable onPress={() => removeManualItem(idx)}>
                    <MaterialIcons name="delete" size={18} color={c.destructive} />
                  </Pressable>
                </View>

                {/* Product Type select */}
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
                    Product
                  </Text>
                  <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 6, backgroundColor: c.input, overflow: "hidden" }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 6, gap: 6 }}>
                      {productTypes.map((pt) => (
                        <Pressable
                          key={pt.id}
                          onPress={() => updateManualItem(idx, "productTypeId", pt.id)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 14,
                            backgroundColor: item.productTypeId === pt.id ? c.primary : c.muted,
                          }}
                        >
                          <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: item.productTypeId === pt.id ? c.primaryForeground : c.mutedForeground }}>
                            {pt.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                {/* Family member assignee */}
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
                    Assign To
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    <Pressable
                      onPress={() => updateManualItem(idx, "familyMemberId", null)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 14,
                        backgroundColor: item.familyMemberId === null ? c.primary : c.muted,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: item.familyMemberId === null ? c.primaryForeground : c.mutedForeground }}>
                        Self
                      </Text>
                    </Pressable>
                    {customerFamilyMembers.map((fm) => (
                      <Pressable
                        key={fm.id}
                        onPress={() => updateManualItem(idx, "familyMemberId", fm.id)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 14,
                          backgroundColor: item.familyMemberId === fm.id ? c.primary : c.muted,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: item.familyMemberId === fm.id ? c.primaryForeground : c.mutedForeground }}>
                          {fm.name} ({titleCase(fm.relation)})
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 2 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.mutedForeground, marginBottom: 4 }}>
                      Price (₹)
                    </Text>
                    <TextInput
                      keyboardType="numeric"
                      style={{
                        borderWidth: 1,
                        borderColor: c.border,
                        borderRadius: 6,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        fontSize: 14,
                        color: c.foreground,
                        backgroundColor: c.input,
                      }}
                      value={String(item.price)}
                      onChangeText={(val) => {
                        const num = Number(val.replace(/[^0-9]/g, ""));
                        updateManualItem(idx, "price", num);
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.mutedForeground, marginBottom: 4 }}>
                      Qty
                    </Text>
                    <TextInput
                      keyboardType="numeric"
                      style={{
                        borderWidth: 1,
                        borderColor: c.border,
                        borderRadius: 6,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        fontSize: 14,
                        color: c.foreground,
                        backgroundColor: c.input,
                        textAlign: "center",
                      }}
                      value={String(item.quantity)}
                      onChangeText={(val) => {
                        const num = Math.max(1, Number(val.replace(/[^0-9]/g, "")) || 1);
                        updateManualItem(idx, "quantity", num);
                      }}
                    />
                  </View>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Order Meta Info */}
        {selectedCustomerId ? (
          <Card style={{ padding: 16, gap: 14 }}>
            <DatePicker
              label="Delivery Date (Optional)"
              value={deliveryDate}
              onChange={setDeliveryDate}
            />

            {/* Advance Payment */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Advance Paid (₹)
              </Text>
              <TextInput
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={c.mutedForeground}
                style={{
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  fontSize: 16,
                  color: c.foreground,
                  backgroundColor: c.input,
                  fontFamily: "Inter_600SemiBold",
                }}
                value={advanceAmount}
                onChangeText={setAdvanceAmount}
              />
              {advancePaid > 0 && totalAmount > 0 && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: balanceDue === 0 ? "#D1FAE5" : "#FEF3C7", borderRadius: 8, padding: 10 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: balanceDue === 0 ? "#059669" : "#D97706" }}>
                    {balanceDue === 0 ? "✓ Fully Paid" : `Balance Due`}
                  </Text>
                  {balanceDue > 0 && (
                    <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#D97706" }}>
                      {formatCurrency(balanceDue)}
                    </Text>
                  )}
                </View>
              )}
            </View>

            <Input
              label="Order Notes (Optional)"
              placeholder="E.g. urgent, specific tailoring design instructions..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </Card>
        ) : null}

        {/* Total & Action */}
        {selectedCustomerId ? (
          <View style={{ gap: 12, marginTop: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: c.mutedForeground }}>
                Total Order Amount
              </Text>
              <Text style={{ fontSize: 24, fontFamily: "Inter_800ExtraBold", color: c.foreground }}>
                {formatCurrency(totalAmount)}
              </Text>
            </View>
            {advancePaid > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: "#059669" }}>
                  Advance Paid
                </Text>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#059669" }}>
                  -{formatCurrency(advancePaid)}
                </Text>
              </View>
            )}
            {advancePaid > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 }}>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>
                  Balance Due
                </Text>
                <Text style={{ fontSize: 20, fontFamily: "Inter_800ExtraBold", color: balanceDue === 0 ? "#059669" : "#D97706" }}>
                  {formatCurrency(balanceDue)}
                </Text>
              </View>
            )}

            <Button
              label="Save Family Order"
              onPress={handleSave}
              loading={loading}
              icon="save"
              size="lg"
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Customer Picker Modal (for long lists) */}
      <Modal visible={showCustomerModal} animationType="slide">
        <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border, gap: 12 }}>
            <Pressable onPress={() => setShowCustomerModal(false)} style={{ padding: 4 }}>
              <MaterialIcons name="close" size={24} color={c.foreground} />
            </Pressable>
            <TextInput
              autoFocus
              placeholder="Search customers..."
              style={{ flex: 1, fontSize: 16, color: c.foreground, fontFamily: "Inter_400Regular" }}
              value={modalSearch}
              onChangeText={setModalSearch}
            />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {modalFiltered.map((cu) => (
              <Pressable
                key={cu.id}
                onPress={() => selectCustomer(cu.id)}
                style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: c.border }}
              >
                <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                  {cu.name}
                </Text>
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 4 }}>
                  {cu.mobile}
                </Text>
              </Pressable>
            ))}
            {modalFiltered.length === 0 && (
              <Text style={{ padding: 24, textAlign: "center", color: c.mutedForeground }}>
                No customers found
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
