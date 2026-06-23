import React, { useState, useMemo, useEffect } from "react";
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
import { useData } from "@/context/DataContext";
import { Button, Card, Input } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { OrderItem, Relation, Measurement, ProductType, Gender } from "@/types";
import { formatCurrency } from "@/utils/storage";
import { getFieldsForProduct, MEASUREMENT_FIELDS } from "@/constants/products";
import { MeasurementKey } from "@/constants/measurementFields";
import { base64ToDataUri, pickMeasurementPhotos } from "@/utils/photos";
import colors from "@/constants/colors";

const CUSTOMER_INLINE_LIMIT = 20;

const MEASUREMENT_KEYS = [
  "chest", "shoulder", "neck", "sleeve", "waist", "length",
  "hip", "thigh", "pantLength", "bottomWidth", "armhole", "wrist"
];

function titleCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function featureMatchesGender(featureGender: "male" | "female" | "both" | undefined, assigneeGender?: Gender) {
  if (!featureGender || featureGender === "both") return true;
  if (!assigneeGender || assigneeGender === "unisex") return true;
  return featureGender === assigneeGender;
}

interface LocalItem {
  id: string; // React key
  productTypeId: string;
  productType: string;
  quantity: number;
  price: number;
  familyMemberId: string | null; // null = self
  selectedFeatures: string[];
  
  // Measurement details
  measurementId: string | null;
  measurementValues: Record<string, string>;
  customValues: Record<string, string>;
  photos: string[];
  notes: string;
  
  expanded: boolean;
}

export default function NewOrderScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    customerId?: string;
  }>();

  const {
    customers,
    productTypes,
    measurements,
    familyMembers,
    addOrder,
    addMeasurement,
    updateMeasurement,
    addFamilyMember,
    customFields
  } = useData();

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

  const [localItems, setLocalItems] = useState<LocalItem[]>([]);

  // Find latest measurement for a person and product type
  function findLatestMeasurement(customerId: string, familyMemberId: string | null, productTypeName: string): Measurement | null {
    if (!customerId) return null;
    return measurements
      .filter((m) => {
        const samePerson = familyMemberId === null ? !m.familyMemberId : m.familyMemberId === familyMemberId;
        return m.customerId === customerId && samePerson && m.productType.toLowerCase() === productTypeName.toLowerCase();
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
  }

  // Pre-fill or build measurement details
  function getMeasurementState(customerId: string, familyMemberId: string | null, productTypeName: string) {
    const latest = findLatestMeasurement(customerId, familyMemberId, productTypeName);
    if (!latest) {
      return {
        measurementId: null,
        measurementValues: {},
        customValues: {},
        photos: [],
        notes: ""
      };
    }

    const mVals: Record<string, string> = {};
    MEASUREMENT_KEYS.forEach((k) => {
      const v = (latest as any)[k];
      if (typeof v === "number" && v > 0) mVals[k] = String(v);
    });

    const cVals: Record<string, string> = {};
    latest.customMeasurements?.forEach((cm) => {
      const match = customFields.find((cf) => cf.fieldName.toLowerCase() === cm.label.toLowerCase());
      if (match) cVals[match.id] = String(cm.value);
    });

    return {
      measurementId: latest.id,
      measurementValues: mVals,
      customValues: cVals,
      photos: latest.photos ?? [],
      notes: latest.notes ?? ""
    };
  }

  function getProductForItem(item: LocalItem): ProductType | undefined {
    return productTypes.find((p) => p.id === item.productTypeId)
      ?? productTypes.find((p) => p.name.toLowerCase() === item.productType.toLowerCase());
  }

  function getAssigneeGender(familyMemberId: string | null): Gender | undefined {
    return familyMemberId
      ? familyMembers.find((fm) => fm.id === familyMemberId)?.gender
      : selectedCustomer?.gender;
  }

  function getMatchingFeatures(product: ProductType | undefined, familyMemberId: string | null) {
    const assigneeGender = getAssigneeGender(familyMemberId);
    const seen = new Set<string>();
    return (product?.features ?? []).filter((feature) => {
      const key = feature.label.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return featureMatchesGender(feature.gender, assigneeGender);
    });
  }

  function getValidSelectedFeatures(item: LocalItem) {
    const matchingLabels = new Set(
      getMatchingFeatures(getProductForItem(item), item.familyMemberId).map((feature) => feature.label)
    );
    return item.selectedFeatures.filter((label) => matchingLabels.has(label));
  }

  // Set up first item when customer is selected
  useEffect(() => {
    if (selectedCustomerId && localItems.length === 0 && productTypes.length > 0) {
      const pt = productTypes[0];
      const measState = getMeasurementState(selectedCustomerId, null, pt.name);
      setLocalItems([
        {
          id: Math.random().toString(),
          productTypeId: pt.id,
          productType: pt.name,
          quantity: 1,
          price: pt.amount ? Number(pt.amount) : 0,
          familyMemberId: null,
          selectedFeatures: [],
          ...measState,
          expanded: true
        }
      ]);
    }
  }, [selectedCustomerId, productTypes]);

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
      setLocalItems([]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  const orderItemsList = useMemo(() => {
    return localItems.map((item) => {
      const member = item.familyMemberId
        ? familyMembers.find((fm) => fm.id === item.familyMemberId)
        : undefined;

      const mValues: Record<string, string> = {};
      Object.entries(item.measurementValues).forEach(([k, v]) => {
        if (v && Number(v) > 0) mValues[k] = `${v}"`;
      });
      // Merge custom measurements labels
      Object.entries(item.customValues).forEach(([fid, val]) => {
        const cf = customFields.find((f) => f.id === fid);
        if (cf && val && Number(val) > 0) {
          mValues[cf.fieldName] = `${val}"`;
        }
      });

      return {
        productTypeId: item.productTypeId || undefined,
        productType: item.productType,
        featureLabel: getValidSelectedFeatures(item).join(", ") || null,
        quantity: item.quantity,
        price: item.price,
        measurementId: item.measurementId,
        familyMemberId: item.familyMemberId,
        personName: member?.name ?? selectedCustomer?.name,
        relation: member?.relation ?? "self",
        measurementValues: Object.keys(mValues).length > 0 ? mValues : null,
      };
    });
  }, [localItems, familyMembers, selectedCustomer, customFields, productTypes]);

  const totalAmount = useMemo(() => {
    return orderItemsList.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [orderItemsList]);

  const advancePaid = useMemo(() => {
    const n = Number(advanceAmount.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : Math.min(n, totalAmount);
  }, [advanceAmount, totalAmount]);

  const balanceDue = useMemo(() => totalAmount - advancePaid, [totalAmount, advancePaid]);

  function addLocalItem() {
    if (productTypes.length === 0) return;
    const pt = productTypes[0];
    const measState = getMeasurementState(selectedCustomerId, null, pt.name);
    setLocalItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        productTypeId: pt.id,
        productType: pt.name,
        quantity: 1,
        price: pt.amount ? Number(pt.amount) : 0,
        familyMemberId: null,
        selectedFeatures: [],
        ...measState,
        expanded: true
      }
    ]);
  }

  function removeLocalItem(id: string) {
    setLocalItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateItemProduct(idx: number, productTypeId: string) {
    const pt = productTypes.find((p) => p.id === productTypeId);
    if (!pt) return;
    setLocalItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      const measState = getMeasurementState(selectedCustomerId, item.familyMemberId, pt.name);
      updated[idx] = {
        ...item,
        productTypeId,
        productType: pt.name,
        price: pt.amount ? Number(pt.amount) : 0,
        selectedFeatures: [],
        ...measState
      };
      return updated;
    });
  }

  function updateItemAssignee(idx: number, familyMemberId: string | null) {
    setLocalItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      const measState = getMeasurementState(selectedCustomerId, familyMemberId, item.productType);
      const nextItem = { ...item, familyMemberId };
      updated[idx] = {
        ...nextItem,
        selectedFeatures: getValidSelectedFeatures(nextItem),
        ...measState
      };
      return updated;
    });
  }

  function toggleItemFeature(idx: number, label: string) {
    setLocalItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      const isSelected = item.selectedFeatures.includes(label);
      const nextFeatures = isSelected
        ? item.selectedFeatures.filter((f) => f !== label)
        : [...item.selectedFeatures, label];
      updated[idx] = {
        ...item,
        selectedFeatures: nextFeatures
      };
      return updated;
    });
  }

  // Modals States
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [showMeasModal, setShowMeasModal] = useState(false);
  const [measDraftValues, setMeasDraftValues] = useState<Record<string, string>>({});
  const [measDraftCustom, setMeasDraftCustom] = useState<Record<string, string>>({});
  const [measDraftPhotos, setMeasDraftPhotos] = useState<string[]>([]);
  const [measDraftNotes, setMeasDraftNotes] = useState("");
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [familyDraftName, setFamilyDraftName] = useState("");
  const [familyDraftRelation, setFamilyDraftRelation] = useState<Relation>("other");
  const [savingFamily, setSavingFamily] = useState(false);
  const [familyAssignTargetIdx, setFamilyAssignTargetIdx] = useState<number | null>(null);

  function openMeasurementEditor(idx: number) {
    const item = localItems[idx];
    setActiveItemIndex(idx);
    setMeasDraftValues(item.measurementValues);
    setMeasDraftCustom(item.customValues);
    setMeasDraftPhotos(item.photos);
    setMeasDraftNotes(item.notes);
    setShowMeasModal(true);
  }

  async function handleSaveMeasurement() {
    if (activeItemIndex === null || !selectedCustomer) return;
    const item = localItems[activeItemIndex];
    setSavingMeasurement(true);
    try {
      const valuesToSave: Record<string, number> = {};
      const fields = getFieldsForProduct(item.productType);
      fields.forEach((k) => {
        const val = measDraftValues[k];
        if (val) valuesToSave[k] = parseFloat(val);
      });

      const customToSave = customFields
        .map((cf) => ({
          label: cf.fieldName,
          value: parseFloat(measDraftCustom[cf.id] || "0")
        }))
        .filter((cm) => cm.value > 0);

      const payload = {
        customerId: selectedCustomerId,
        customerName: selectedCustomer.name,
        familyMemberId: item.familyMemberId || undefined,
        productType: item.productType,
        productTypeId: item.productTypeId || undefined,
        featureLabel: getValidSelectedFeatures(item).join(", ") || undefined,
        measurementDate: new Date().toISOString().split("T")[0],
        photos: measDraftPhotos,
        notes: measDraftNotes || undefined,
        customMeasurements: customToSave,
        ...valuesToSave
      };

      let finalMeasId = item.measurementId;
      if (item.measurementId) {
        await updateMeasurement(item.measurementId, payload);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const newMeas = await addMeasurement(payload as any);
        finalMeasId = newMeas.id;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setLocalItems((prev) => {
        const updated = [...prev];
        updated[activeItemIndex] = {
          ...updated[activeItemIndex],
          measurementId: finalMeasId,
          measurementValues: measDraftValues,
          customValues: measDraftCustom,
          photos: measDraftPhotos,
          notes: measDraftNotes
        };
        return updated;
      });
      setShowMeasModal(false);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to save measurement");
    } finally {
      setSavingMeasurement(false);
    }
  }

  async function handleAddPhotos() {
    const picked = await pickMeasurementPhotos(measDraftPhotos.length);
    if (picked.length === 0) return;
    setMeasDraftPhotos((prev) => [...prev, ...picked.map((p) => p.base64).filter(Boolean)]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleRemovePhoto(idx: number) {
    setMeasDraftPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  function openFamilyCreator(idx: number) {
    setFamilyAssignTargetIdx(idx);
    setFamilyDraftName("");
    setFamilyDraftRelation("other");
    setShowFamilyModal(true);
  }

  async function handleSaveFamilyMember() {
    if (!selectedCustomerId || !familyDraftName.trim()) {
      Alert.alert("Error", "Please enter family member's name");
      return;
    }
    setSavingFamily(true);
    try {
      const member = await addFamilyMember({
        primaryCustomerId: selectedCustomerId,
        name: familyDraftName.trim(),
        relation: familyDraftRelation,
        gender: "unisex"
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (familyAssignTargetIdx !== null) {
        updateItemAssignee(familyAssignTargetIdx, member.id);
      }
      setShowFamilyModal(false);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to add family member");
    } finally {
      setSavingFamily(false);
    }
  }

  async function handleSave() {
    if (!selectedCustomerId || !selectedCustomer) {
      Alert.alert("Error", "Please select a customer");
      return;
    }
    if (orderItemsList.length === 0) {
      Alert.alert("Error", "Please include at least one item in the order");
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
      Alert.alert("Success", "Order created successfully!", [
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
          Create Order
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
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

        {/* Dynamic Items Section */}
        {selectedCustomerId && (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>
                Order Items ({localItems.length})
              </Text>
              <Pressable
                onPress={addLocalItem}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.primary + "10", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 }}
              >
                <MaterialIcons name="add" size={16} color={c.primary} />
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.primary }}>
                  Add Item
                </Text>
              </Pressable>
            </View>

            {localItems.map((item, idx) => {
              const pt = getProductForItem(item);
              const matchingFeatures = getMatchingFeatures(pt, item.familyMemberId);

              // Measurements summary text
              const measSummaryList: string[] = [];
              getFieldsForProduct(item.productType).forEach((k) => {
                const val = item.measurementValues[k];
                if (val) measSummaryList.push(`${titleCase(k)}: ${val}"`);
              });
              Object.entries(item.customValues).forEach(([fid, val]) => {
                const cf = customFields.find((f) => f.id === fid);
                if (cf && val) measSummaryList.push(`${cf.fieldName}: ${val}"`);
              });
              const summaryParts: string[] = [];
              if (item.selectedFeatures.length > 0) {
                summaryParts.push(item.selectedFeatures.join(", "));
              }
              if (measSummaryList.length > 0) {
                summaryParts.push(measSummaryList.join("  ·  "));
              }
              const summaryText = summaryParts.join("  ·  ") || "Tap to add measurements & features";

              return (
                <Card key={item.id} style={{ padding: 16, borderWidth: 1, borderColor: c.border }}>
                  {!item.expanded ? (
                    /* Collapsed State */
                    <Pressable
                      onPress={() => {
                        setLocalItems((prev) => {
                          const updated = [...prev];
                          updated[idx] = { ...updated[idx], expanded: true };
                          return updated;
                        });
                      }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                    >
                      {/* Photo Thumbnail */}
                      {item.photos[0] ? (
                        <Image
                          source={{ uri: base64ToDataUri(item.photos[0]) }}
                          style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: c.muted }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" }}>
                          <MaterialIcons name="image" size={20} color={c.mutedForeground} />
                        </View>
                      )}

                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.foreground }}>
                            {item.productType}
                          </Text>
                          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                            {item.quantity} x {formatCurrency(item.price)}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, color: c.mutedForeground, fontFamily: "Inter_400Regular" }} numberOfLines={1}>
                          {summaryText}
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {localItems.length > 1 && (
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              removeLocalItem(item.id);
                            }}
                            style={{ padding: 4 }}
                          >
                            <MaterialIcons name="delete" size={20} color={c.destructive} />
                          </Pressable>
                        )}
                        <MaterialIcons name="keyboard-arrow-down" size={24} color={c.mutedForeground} />
                      </View>
                    </Pressable>
                  ) : (
                    /* Expanded State */
                    <View style={{ gap: 14 }}>
                      {/* Expanded Header */}
                      <Pressable
                        onPress={() => {
                          setLocalItems((prev) => {
                            const updated = [...prev];
                            updated[idx] = { ...updated[idx], expanded: false };
                            return updated;
                          });
                        }}
                        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.border + "50" }}
                      >
                        <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.foreground }}>
                          Item #{idx + 1} ({item.productType})
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          {localItems.length > 1 && (
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                removeLocalItem(item.id);
                              }}
                              style={{ padding: 4 }}
                            >
                              <MaterialIcons name="delete" size={20} color={c.destructive} />
                            </Pressable>
                          )}
                          <MaterialIcons name="keyboard-arrow-up" size={24} color={c.mutedForeground} />
                        </View>
                      </Pressable>

                      {/* Product Type Chips */}
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Product Type
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                          <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }}>
                            {productTypes.map((p) => (
                              <Pressable
                                key={p.id}
                                onPress={() => updateItemProduct(idx, p.id)}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 7,
                                  borderRadius: 20,
                                  backgroundColor: item.productTypeId === p.id ? c.primary : c.muted,
                                  borderWidth: 1,
                                  borderColor: item.productTypeId === p.id ? c.primary : "transparent",
                                }}
                              >
                                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: item.productTypeId === p.id ? "#FFFFFF" : c.mutedForeground }}>
                                  {p.name}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </ScrollView>
                      </View>

                      {/* Quantity and Price Inputs */}
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            Price (₹)
                          </Text>
                          <TextInput
                            keyboardType="numeric"
                            value={String(item.price)}
                            onChangeText={(val) => {
                              const num = Number(val.replace(/[^0-9]/g, ""));
                              setLocalItems((prev) => {
                                const updated = [...prev];
                                updated[idx].price = num;
                                return updated;
                              });
                            }}
                            style={{
                              borderWidth: 1,
                              borderColor: c.border,
                              borderRadius: 8,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              fontSize: 14,
                              color: c.foreground,
                              backgroundColor: c.input,
                              fontFamily: "Inter_600SemiBold",
                            }}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            Qty
                          </Text>
                          <TextInput
                            keyboardType="numeric"
                            value={String(item.quantity)}
                            onChangeText={(val) => {
                              const num = Math.max(1, Number(val.replace(/[^0-9]/g, "")) || 1);
                              setLocalItems((prev) => {
                                const updated = [...prev];
                                updated[idx].quantity = num;
                                return updated;
                              });
                            }}
                            style={{
                              borderWidth: 1,
                              borderColor: c.border,
                              borderRadius: 8,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              fontSize: 14,
                              color: c.foreground,
                              backgroundColor: c.input,
                              textAlign: "center",
                              fontFamily: "Inter_600SemiBold",
                            }}
                          />
                        </View>
                      </View>

                      {/* Assign To Chips (Self + Family Members + Add Family button) */}
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Assign To
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                          <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4, alignItems: "center" }}>
                            <Pressable
                              onPress={() => updateItemAssignee(idx, null)}
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 7,
                                borderRadius: 20,
                                backgroundColor: item.familyMemberId === null ? c.primary : c.muted,
                                borderWidth: 1,
                                borderColor: item.familyMemberId === null ? c.primary : "transparent",
                              }}
                            >
                              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: item.familyMemberId === null ? "#FFFFFF" : c.mutedForeground }}>
                                Self
                              </Text>
                            </Pressable>
                            {customerFamilyMembers.map((fm) => (
                              <Pressable
                                key={fm.id}
                                onPress={() => updateItemAssignee(idx, fm.id)}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 7,
                                  borderRadius: 20,
                                  backgroundColor: item.familyMemberId === fm.id ? c.primary : c.muted,
                                  borderWidth: 1,
                                  borderColor: item.familyMemberId === fm.id ? c.primary : "transparent",
                                }}
                              >
                                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: item.familyMemberId === fm.id ? "#FFFFFF" : c.mutedForeground }}>
                                  {fm.name} ({titleCase(fm.relation)})
                                </Text>
                              </Pressable>
                            ))}
                            <Pressable
                              onPress={() => openFamilyCreator(idx)}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: c.primary,
                                borderStyle: "dashed",
                              }}
                            >
                              <MaterialIcons name="add" size={14} color={c.primary} />
                              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.primary }}>
                                Add Family
                              </Text>
                            </Pressable>
                          </View>
                        </ScrollView>
                      </View>

                      {/* Subtypes/Features Checklist */}
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Features / Sub-types
                        </Text>
                        {matchingFeatures.length > 0 ? (
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {matchingFeatures.map((feat) => {
                              const isSel = item.selectedFeatures.includes(feat.label);
                              return (
                                <Pressable
                                  key={feat.label}
                                  onPress={() => toggleItemFeature(idx, feat.label)}
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 8,
                                    backgroundColor: isSel ? c.primary + "10" : c.muted + "20",
                                    borderWidth: 1,
                                    borderColor: isSel ? c.primary : c.border,
                                  }}
                                >
                                  <MaterialIcons
                                    name={isSel ? "check-box" : "check-box-outline-blank"}
                                    size={16}
                                    color={isSel ? c.primary : c.mutedForeground}
                                  />
                                  <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: isSel ? c.primary : c.foreground }}>
                                    {feat.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        ) : (
                          <View style={{ padding: 10, borderRadius: 8, backgroundColor: c.muted + "20", borderWidth: 1, borderColor: c.border }}>
                            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
                              {pt?.features?.length ? "No sub-types match this assignee" : "No sub-types added in Product Master"}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Measurement Box with Add/Edit Measurement */}
                      <View style={{ gap: 6, marginTop: 4 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Measurements Details
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: 12,
                            borderRadius: 10,
                            backgroundColor: c.muted + "30",
                            borderWidth: 1,
                            borderColor: c.border,
                          }}
                        >
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: item.measurementId ? c.foreground : c.mutedForeground }}>
                              {summaryText}
                            </Text>
                            {item.photos.length > 0 && (
                              <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                                {item.photos.slice(0, 4).map((p, pIdx) => (
                                  <Image
                                    key={pIdx}
                                    source={{ uri: base64ToDataUri(p) }}
                                    style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: c.muted }}
                                  />
                                ))}
                              </View>
                            )}
                          </View>
                          <Pressable
                            onPress={() => openMeasurementEditor(idx)}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              backgroundColor: c.primary,
                              paddingVertical: 6,
                              paddingHorizontal: 12,
                              borderRadius: 8,
                            }}
                          >
                            <MaterialIcons name={item.measurementId ? "edit" : "add"} size={16} color="#FFFFFF" />
                            <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
                              {item.measurementId ? "Edit" : "Add"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}

        {/* Order Meta Info */}
        {selectedCustomerId && (
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
        )}

        {/* Total & Action */}
        {selectedCustomerId && (
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
              label="Save Order"
              onPress={handleSave}
              loading={loading}
              icon="save"
              size="lg"
            />
          </View>
        )}
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

      {/* Inline Measurement Modal */}
      {activeItemIndex !== null && (
        <Modal visible={showMeasModal} animationType="slide">
          <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Pressable onPress={() => setShowMeasModal(false)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={24} color={c.foreground} />
              </Pressable>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
                Edit Measurements ({localItems[activeItemIndex]?.productType})
              </Text>
              <Button
                label="Save"
                onPress={handleSaveMeasurement}
                loading={savingMeasurement}
                size="sm"
              />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
              {/* Standard Fields */}
              <View style={{ gap: 12 }}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Standard Measurements (inches)
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}>
                  {MEASUREMENT_FIELDS.filter((f) =>
                    getFieldsForProduct(localItems[activeItemIndex]?.productType).includes(f.key as MeasurementKey)
                  ).map((field) => (
                    <View key={field.key} style={{ width: "50%", paddingHorizontal: 6, marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 4 }}>
                        {field.label}
                      </Text>
                      <TextInput
                        keyboardType="numeric"
                        placeholder="--"
                        value={measDraftValues[field.key] || ""}
                        onChangeText={(val) => {
                          const clean = val.replace(/[^0-9.]/g, "");
                          setMeasDraftValues((prev) => ({ ...prev, [field.key]: clean }));
                        }}
                        style={{
                          borderWidth: 1,
                          borderColor: c.border,
                          borderRadius: 8,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          fontSize: 14,
                          color: c.foreground,
                          backgroundColor: c.input,
                          fontFamily: "Inter_600SemiBold",
                        }}
                      />
                    </View>
                  ))}
                </View>
              </View>

              {/* Custom Fields */}
              {customFields.length > 0 && (
                <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16 }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Custom Measurement Fields
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}>
                    {customFields.map((cf) => (
                      <View key={cf.id} style={{ width: "50%", paddingHorizontal: 6, marginBottom: 12 }}>
                        <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 4 }}>
                          {cf.fieldName}
                        </Text>
                        <TextInput
                          keyboardType="numeric"
                          placeholder="--"
                          value={measDraftCustom[cf.id] || ""}
                          onChangeText={(val) => {
                            const clean = val.replace(/[^0-9.]/g, "");
                            setMeasDraftCustom((prev) => ({ ...prev, [cf.id]: clean }));
                          }}
                          style={{
                            borderWidth: 1,
                            borderColor: c.border,
                            borderRadius: 8,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            fontSize: 14,
                            color: c.foreground,
                            backgroundColor: c.input,
                            fontFamily: "Inter_600SemiBold",
                          }}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Photos Section */}
              <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16 }}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Photos ({measDraftPhotos.length}/4)
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {measDraftPhotos.map((p, pIdx) => (
                    <View key={pIdx} style={{ position: "relative" }}>
                      <Image
                        source={{ uri: base64ToDataUri(p) }}
                        style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: c.muted }}
                        resizeMode="cover"
                      />
                      <Pressable
                        onPress={() => handleRemovePhoto(pIdx)}
                        style={{
                          position: "absolute",
                          top: -6,
                          right: -6,
                          backgroundColor: "#EF4444",
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 2,
                          borderColor: c.card
                        }}
                      >
                        <MaterialIcons name="close" size={12} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                  {measDraftPhotos.length < 4 && (
                    <Pressable
                      onPress={handleAddPhotos}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: c.primary,
                        borderStyle: "dashed",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: c.primary + "06"
                      }}
                    >
                      <MaterialIcons name="add-a-photo" size={24} color={c.primary} />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Notes */}
              <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16 }}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Measurement Notes
                </Text>
                <TextInput
                  placeholder="Any specific fit adjustments or instructions..."
                  value={measDraftNotes}
                  onChangeText={setMeasDraftNotes}
                  multiline
                  numberOfLines={4}
                  style={{
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    color: c.foreground,
                    backgroundColor: c.input,
                    minHeight: 80,
                    textAlignVertical: "top",
                  }}
                />
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Add Family Member Modal */}
      <Modal visible={showFamilyModal} transparent animationType="fade">
        <Pressable
          onPress={() => setShowFamilyModal(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: c.card, borderRadius: 16, padding: 20, gap: 16, borderWidth: 1, borderColor: c.border }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
                Add Family Member
              </Text>
              <Pressable onPress={() => setShowFamilyModal(false)}>
                <MaterialIcons name="close" size={22} color={c.mutedForeground} />
              </Pressable>
            </View>

            <Input
              label="Name"
              placeholder="Enter name..."
              value={familyDraftName}
              onChangeText={setFamilyDraftName}
            />

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground }}>
                Relation
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {(["father", "mother", "wife", "husband", "son", "daughter", "brother", "sister", "other"] as Relation[]).map((rel) => (
                  <Pressable
                    key={rel}
                    onPress={() => setFamilyDraftRelation(rel)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 14,
                      backgroundColor: familyDraftRelation === rel ? c.primary : c.muted,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: familyDraftRelation === rel ? "#FFFFFF" : c.mutedForeground }}>
                      {titleCase(rel)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
              <Button
                label="Cancel"
                onPress={() => setShowFamilyModal(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                label="Add"
                onPress={handleSaveFamilyMember}
                loading={savingFamily}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
