import React, { useEffect, useMemo, useState } from "react";
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
import { Button, Input } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { MEASUREMENT_FIELDS, getFieldsForProduct } from "@/constants/products";
import { MeasurementKey } from "@/constants/measurementFields";
import colors from "@/constants/colors";
import type { CustomMeasurementField, Measurement } from "@/types";

type MeasurementValues = Partial<Record<MeasurementKey, string>>;

type ProductDraft = {
  values: MeasurementValues;
  customValues: Record<string, string>;
  fieldErrors: Record<string, string>;
  /** Feature / sub-type labels the tailor picked for this product
   *  (e.g. "Half Boy Shirt"). Persisted on the measurement's
   *  `featureLabel` field and surfaced on the order/invoice later. */
  selectedFeatures: string[];
  expanded: boolean;
};

const SELF_PERSON_ID = "self";

function sanitizeMeasurement(raw: string): string {
  let cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) cleaned = parts[0] + "." + parts.slice(1).join("");
  if (cleaned.length > 5) cleaned = cleaned.slice(0, 5);
  return cleaned;
}

function isValidMeasurement(value: string): boolean {
  if (!value || value.trim() === "") return false;
  const n = parseFloat(value);
  return !isNaN(n) && n > 0;
}

function titleCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function latestMeasurementKey(measurement: Measurement) {
  return measurement.measurementDate ?? measurement.date ?? measurement.createdAt;
}

function customFieldMatchesScope(
  field: CustomMeasurementField,
  customerId: string,
  familyMemberId: string | null,
  productTypeId: string,
  productType: string,
) {
  const hasPersonScope = !!field.customerId || field.familyMemberId !== undefined;
  const hasProductScope = !!field.productTypeId || !!field.productType;

  if (!hasPersonScope && !hasProductScope) return true;

  if (field.customerId && field.customerId !== customerId) return false;
  if (field.customerId && (field.familyMemberId ?? null) !== (familyMemberId ?? null)) return false;
  if (!field.customerId && field.familyMemberId && field.familyMemberId !== familyMemberId) return false;

  if (field.productTypeId && field.productTypeId !== productTypeId) return false;
  if (!field.productTypeId && field.productType) {
    return field.productType.toLowerCase() === productType.toLowerCase();
  }

  return true;
}

export default function NewMeasurementScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const {
    addMeasurementSession,
    addCustomField,
    customers,
    customFields,
    familyMembers,
    measurements,
    productTypes,
  } = useData();
  const params = useLocalSearchParams<{
    customerId?: string;
    customerName?: string;
    /** Optional — pre-selects the family member in the "Select Person"
     *  picker. Omit / pass "self" to default to the primary customer. */
    familyMemberId?: string;
  }>();

  const [selectedCustomerId, setSelectedCustomerId] = useState(params.customerId ?? "");
  // Pre-seed the selected person from the route param so tapping a
  // measurement row in the customer page (which already knows whether
  // it belongs to a family member) drops the user on the right person.
  const [selectedPersonId, setSelectedPersonId] = useState<string>(
    params.familyMemberId ?? SELF_PERSON_ID,
  );
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [activeProductId, setActiveProductId] = useState("");
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductDraft>>({});
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");

  const selectedCustomer = customers.find((cu) => cu.id === selectedCustomerId);
  const customerFamily = familyMembers.filter((fm) => fm.primaryCustomerId === selectedCustomerId);
  const selectedFamilyMember = selectedPersonId === SELF_PERSON_ID
    ? undefined
    : customerFamily.find((fm) => fm.id === selectedPersonId);

  const personOptions = useMemo(
    () => [
      { id: SELF_PERSON_ID, label: selectedCustomer?.name ?? "Self", subLabel: "Self" },
      ...customerFamily.map((fm) => ({
        id: fm.id,
        label: fm.name,
        subLabel: titleCase(fm.relation),
      })),
    ],
    [customerFamily, selectedCustomer?.name],
  );

  const selectedPersonLabel = selectedFamilyMember
    ? `${selectedFamilyMember.name} (${titleCase(selectedFamilyMember.relation)})`
    : `${selectedCustomer?.name ?? params.customerName ?? "Customer"} (Self)`;

  function latestPreviousMeasurement(productId: string, productName: string, personId: string) {
    return measurements
      .filter((m) => {
        const samePerson = personId === SELF_PERSON_ID ? !m.familyMemberId : m.familyMemberId === personId;
        const sameProduct =
          (productId && m.productTypeId === productId) ||
          m.productType.toLowerCase() === productName.toLowerCase();
        return m.customerId === selectedCustomerId && samePerson && sameProduct;
      })
      .sort((a, b) =>
        latestMeasurementKey(b).localeCompare(latestMeasurementKey(a)) ||
        b.createdAt.localeCompare(a.createdAt)
      )[0];
  }

  function customFieldsForProduct(productId: string, productName: string) {
    const familyMemberId = selectedPersonId === SELF_PERSON_ID ? null : selectedPersonId;
    return customFields.filter((field) =>
      customFieldMatchesScope(field, selectedCustomerId, familyMemberId, productId, productName)
    );
  }

  function buildDraft(productId: string, expanded = true): ProductDraft {
    const product = productTypes.find((p) => p.id === productId);
    const draft: ProductDraft = {
      values: {},
      customValues: {},
      fieldErrors: {},
      selectedFeatures: [],
      expanded,
    };
    if (!product || !selectedCustomerId) return draft;

    const latest = latestPreviousMeasurement(product.id, product.name, selectedPersonId);
    if (!latest) return draft;

    for (const fieldKey of getFieldsForProduct(product.name)) {
      const val = (latest as any)[fieldKey];
      if (val !== undefined && val !== null) {
        draft.values[fieldKey] = String(val);
      }
    }

    for (const cm of latest.customMeasurements ?? []) {
      const match = customFieldsForProduct(product.id, product.name)
        .find((cf) => cf.fieldName.toLowerCase() === cm.label.toLowerCase());
      if (match) draft.customValues[match.id] = String(cm.value);
    }

    if (latest.featureLabel) {
      // Recover the previous selection so the tailor sees the same
      // sub-types ticked when editing/refreshing.
      draft.selectedFeatures = latest.featureLabel
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return draft;
  }

  useEffect(() => {
    if (productTypes.length === 0 || selectedProductIds.length > 0) return;
    const firstId = productTypes[0].id;
    setSelectedProductIds([firstId]);
    setActiveProductId(firstId);
  }, [productTypes, selectedProductIds.length]);

  useEffect(() => {
    setProductDrafts((prev) => {
      const next: Record<string, ProductDraft> = {};
      for (const productId of selectedProductIds) {
        const seed = buildDraft(productId, productId === activeProductId || selectedProductIds.length === 1);
        const existing = prev[productId];
        // CRITICAL: preserve any in-progress values/customValues/feature
        // picks the user has already typed. Without this, picking a
        // second product clobbers product 1's draft because
        // `buildDraft` reseeds from the previous measurement.
        next[productId] = {
          ...seed,
          ...(existing ?? {}),
          values: { ...seed.values, ...(existing?.values ?? {}) },
          customValues: { ...seed.customValues, ...(existing?.customValues ?? {}) },
          fieldErrors: existing?.fieldErrors ?? {},
          selectedFeatures: existing?.selectedFeatures ?? seed.selectedFeatures,
          expanded: existing?.expanded ?? seed.expanded,
        };
      }
      return next;
    });
  }, [selectedCustomerId, selectedPersonId, selectedProductIds.join("|"), productTypes, customFields, measurements]);

  function setProductDraft(productId: string, updater: (draft: ProductDraft) => ProductDraft) {
    setProductDrafts((prev) => ({
      ...prev,
      [productId]: updater(prev[productId] ?? buildDraft(productId)),
    }));
  }

  function handleCustomerChange(customerId: string) {
    setSelectedCustomerId(customerId);
    setSelectedPersonId(SELF_PERSON_ID);
  }

  function handleAddProduct(productId: string) {
    setSelectedProductIds((prev) => (prev.includes(productId) ? prev : [...prev, productId]));
    setActiveProductId(productId);
    setShowProductModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleRemoveProduct(productId: string) {
    if (selectedProductIds.length <= 1) {
      Alert.alert("Product Required", "At least one product must be added.");
      return;
    }
    setSelectedProductIds((prev) => {
      const next = prev.filter((id) => id !== productId);
      if (activeProductId === productId) setActiveProductId(next[0] ?? "");
      return next;
    });
    setProductDrafts((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  function handleFieldChange(productId: string, key: MeasurementKey, raw: string) {
    const clean = sanitizeMeasurement(raw);
    setProductDraft(productId, (draft) => {
      const fieldErrors = { ...draft.fieldErrors };
      delete fieldErrors[key];
      return {
        ...draft,
        values: { ...draft.values, [key]: clean },
        fieldErrors,
      };
    });
  }

  function handleCustomFieldChange(productId: string, fieldId: string, raw: string) {
    setProductDraft(productId, (draft) => ({
      ...draft,
      customValues: { ...draft.customValues, [fieldId]: sanitizeMeasurement(raw) },
    }));
  }

  async function handleAddCustomField() {
    const trimmed = newFieldName.trim();
    if (!trimmed) return;
    if (trimmed.length < 2) {
      Alert.alert("Validation", "Field name must be at least 2 characters");
      return;
    }
    const product = productTypes.find((p) => p.id === activeProductId) ?? productTypes.find((p) => selectedProductIds.includes(p.id));
    if (!selectedCustomerId || !product) {
      Alert.alert("Product required", "Please select a customer and product before adding a custom field.");
      return;
    }
    await addCustomField(trimmed, {
      customerId: selectedCustomerId,
      familyMemberId: selectedPersonId === SELF_PERSON_ID ? null : selectedPersonId,
      productTypeId: product.id,
      productType: product.name,
    });
    setNewFieldName("");
    setShowCustomModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function validate(): boolean {
    const nextDrafts: Record<string, ProductDraft> = { ...productDrafts };
    let firstInvalidProduct = "";

    for (const productId of selectedProductIds) {
      const product = productTypes.find((p) => p.id === productId);
      if (!product) continue;
      const fields = MEASUREMENT_FIELDS.filter((f) =>
        getFieldsForProduct(product.name).includes(f.key as MeasurementKey),
      );
      const draft = nextDrafts[productId] ?? buildDraft(productId);
      const errors: Record<string, string> = {};
      for (const field of fields) {
        const val = draft.values[field.key as MeasurementKey] ?? "";
        if (!isValidMeasurement(val)) errors[field.key] = `${field.label} is required`;
      }
      if (Object.keys(errors).length > 0 && !firstInvalidProduct) firstInvalidProduct = productId;
      nextDrafts[productId] = { ...draft, fieldErrors: errors, expanded: draft.expanded || Object.keys(errors).length > 0 };
    }

    setProductDrafts(nextDrafts);
    if (firstInvalidProduct) setActiveProductId(firstInvalidProduct);
    return !firstInvalidProduct;
  }

  async function handleSave() {
    if (!selectedCustomerId || !selectedCustomer) {
      Alert.alert("Error", "Please select a customer");
      return;
    }
    if (selectedProductIds.length === 0) {
      Alert.alert("Error", "Please add at least one product type");
      return;
    }

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (new Date(date).getTime() < todayStart.getTime()) {
      Alert.alert("Error", "Measurement Date cannot be in the past.");
      return;
    }
    if (!validate()) {
      Alert.alert("Incomplete Measurements", "Please fill all required fields in the highlighted product.");
      return;
    }

    const items = selectedProductIds.map((productId) => {
      const product = productTypes.find((p) => p.id === productId)!;
      const draft = productDrafts[productId] ?? buildDraft(productId);
      const measurementData: Omit<Measurement, "id" | "tailorId" | "createdAt"> = {
        customerId: selectedCustomerId,
        customerName: selectedCustomer.name,
        familyMemberId: selectedFamilyMember?.id,
        familyMemberName: selectedFamilyMember?.name,
        date: new Date(date).toISOString(),
        // Delivery date is captured on the order, not on the measurement.
        // We don't set it here so the order's date is the source of truth.
        productType: product.name,
        productTypeId: product.id,
        featureLabel:
          draft.selectedFeatures.length > 0 ? draft.selectedFeatures.join(", ") : undefined,
        customMeasurements: customFieldsForProduct(product.id, product.name)
          .map((cf) => ({ label: cf.fieldName, value: parseFloat(draft.customValues[cf.id] || "0") }))
          .filter((cm) => cm.value > 0),
        notes: notes.trim(),
        // Photos are no longer attached to the measurement itself —
        // they're uploaded when the order is created so they travel with
        // the order. The measurement's `photos` field stays as an empty
        // array (the type is optional in the model).
        photos: [],
      };

      for (const fieldKey of getFieldsForProduct(product.name)) {
        const val = draft.values[fieldKey];
        if (val) (measurementData as any)[fieldKey] = parseFloat(val);
      }
      return measurementData;
    });

    try {
      setLoading(true);
      await addMeasurementSession(items);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert("Save Failed", error instanceof Error ? error.message : "Unable to save measurements");
    } finally {
      setLoading(false);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : 0;
  const availableProducts = productTypes.filter((p) => !selectedProductIds.includes(p.id));
  const totalRequired = selectedProductIds.reduce((count, productId) => {
    const product = productTypes.find((p) => p.id === productId);
    return count + (product ? getFieldsForProduct(product.name).length : 0);
  }, 0);
  const filledCount = selectedProductIds.reduce((count, productId) => {
    const product = productTypes.find((p) => p.id === productId);
    const draft = productDrafts[productId];
    if (!product || !draft) return count;
    return count + getFieldsForProduct(product.name).filter((key) => isValidMeasurement(draft.values[key] ?? "")).length;
  }, 0);
  const errorCount = Object.values(productDrafts).reduce((sum, draft) => sum + Object.keys(draft.fieldErrors).length, 0);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
        <Pressable onPress={() => router.back()} style={{ backgroundColor: c.muted, borderRadius: 10, padding: 8 }}>
          <MaterialIcons name="arrow-back" size={20} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
            New Measurement
          </Text>
          {totalRequired > 0 && (
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
              {filledCount}/{totalRequired} fields filled
            </Text>
          )}
        </View>
        <Button label="Save" onPress={handleSave} loading={loading} size="sm" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 50 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {errorCount > 0 && (
          <View
            style={{
              backgroundColor: "#FEE2E2",
              borderRadius: colors.radius,
              padding: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: "#FECACA",
            }}
          >
            <MaterialIcons name="error-outline" size={18} color="#DC2626" />
            <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#DC2626" }}>
              {errorCount} field{errorCount > 1 ? "s" : ""} required. Check the highlighted product cards.
            </Text>
          </View>
        )}

        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Customer
          </Text>
          {params.customerId ? (
            <View style={{ backgroundColor: c.card, borderRadius: colors.radius, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: c.primary + "40" }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary + "20", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: c.primary }}>
                  {(selectedCustomer?.name ?? "?")[0]}
                </Text>
              </View>
              <Text style={{ flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                {selectedCustomer?.name ?? params.customerName}
              </Text>
              <MaterialIcons name="check-circle" size={20} color={c.primary} />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {customers.map((cust) => (
                  <Pressable
                    key={cust.id}
                    onPress={() => handleCustomerChange(cust.id)}
                    style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: colors.radius, backgroundColor: selectedCustomerId === cust.id ? c.primary : c.card, borderWidth: 1.5, borderColor: selectedCustomerId === cust.id ? c.primary : c.border }}
                  >
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: selectedCustomerId === cust.id ? "#FFFFFF" : c.foreground }}>
                      {cust.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {selectedCustomer && (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Select Person
            </Text>
            <View style={{ backgroundColor: c.card, borderRadius: colors.radius, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
              {personOptions.map((person, idx) => {
                const selected = selectedPersonId === person.id;
                return (
                  <Pressable
                    key={person.id}
                    onPress={() => setSelectedPersonId(person.id)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: selected ? c.primary + "10" : c.card, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: c.border }}
                  >
                    <MaterialIcons name={selected ? "radio-button-checked" : "radio-button-unchecked"} size={20} color={selected ? c.primary : c.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>{person.label}</Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>{person.subLabel}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ backgroundColor: c.primary + "12", borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: c.primary + "30", gap: 4 }}>
          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.primary, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Measurement For
          </Text>
          <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>
            {selectedPersonLabel}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <DatePicker label="Measurement Date" value={date} onChange={setDate} placeholder="Select date" />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Products
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {selectedProductIds.map((productId) => {
                const product = productTypes.find((p) => p.id === productId);
                if (!product) return null;
                const active = activeProductId === productId;
                return (
                  <Pressable
                    key={productId}
                    onPress={() => {
                      setActiveProductId(productId);
                      setProductDraft(productId, (draft) => ({ ...draft, expanded: true }));
                    }}
                    style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: active ? c.primary : c.muted, borderWidth: 1, borderColor: active ? c.primary : "transparent" }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: active ? "#FFFFFF" : c.mutedForeground }}>
                      {product.name}
                    </Text>
                  </Pressable>
                );
              })}
              {availableProducts.length > 0 && (
                <Pressable
                  onPress={() => setShowProductModal(true)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}
                >
                  <MaterialIcons name="add" size={16} color={c.primary} />
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.primary }}>Add Product</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>

        <View style={{ gap: 12 }}>
          {selectedProductIds.map((productId) => {
            const product = productTypes.find((p) => p.id === productId);
            if (!product) return null;
            const draft = productDrafts[productId] ?? buildDraft(productId);
            const fields = MEASUREMENT_FIELDS.filter((f) =>
              getFieldsForProduct(product.name).includes(f.key as MeasurementKey),
            );
            // Filter features by the selected person's gender so the
            // tailor doesn't see options like "Ladies Blouse" on a male
            // customer. `selectedPersonGender` may be undefined when the
            // person is a family member stored without gender; in that
            // case we fall back to "both"/undefined features.
            const personGender =
              selectedFamilyMember?.gender ?? selectedCustomer?.gender;
            const productFeatures = (product.features ?? []).filter((f) => {
              if (!f.gender || f.gender === "both") return true;
              if (!personGender || personGender === "unisex") return true;
              return f.gender === personGender;
            });
            const productCustomFields = customFieldsForProduct(product.id, product.name);
            const expanded = draft.expanded;
            const productErrorCount = Object.keys(draft.fieldErrors).length;

            return (
              <View key={productId} style={{ backgroundColor: c.card, borderRadius: colors.radius, borderWidth: 1, borderColor: productErrorCount ? "#FCA5A5" : c.border, overflow: "hidden" }}>
                <Pressable
                  onPress={() => {
                    setActiveProductId(productId);
                    setProductDraft(productId, (d) => ({ ...d, expanded: !d.expanded }));
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: productErrorCount ? "#FEF2F2" : c.card }}
                >
                  <MaterialIcons name={expanded ? "expand-more" : "chevron-right"} size={22} color={productErrorCount ? "#DC2626" : c.foreground} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: productErrorCount ? "#DC2626" : c.foreground }}>
                      {product.name}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                      {fields.filter((f) => isValidMeasurement(draft.values[f.key as MeasurementKey] ?? "")).length}/{fields.length} fields
                    </Text>
                  </View>
                  <Pressable onPress={() => handleRemoveProduct(productId)} style={{ padding: 6 }}>
                    <MaterialIcons name="close" size={18} color={c.mutedForeground} />
                  </Pressable>
                </Pressable>

                {expanded && (
                  <View>
                    {fields.map((field, idx) => {
                      const key = field.key as MeasurementKey;
                      const raw = draft.values[key] ?? "";
                      const isFilled = isValidMeasurement(raw);
                      const hasError = !!draft.fieldErrors[key];

                      return (
                        <View key={field.key}>
                          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 11, backgroundColor: hasError ? "#FEF2F2" : isFilled ? c.primary + "08" : "transparent" }}>
                            <View style={{ width: 106 }}>
                              <Text style={{ fontSize: 14, fontFamily: isFilled ? "Inter_600SemiBold" : "Inter_400Regular", color: hasError ? "#DC2626" : isFilled ? c.primary : c.foreground }}>
                                {field.label}<Text style={{ color: "#DC2626" }}> *</Text>
                              </Text>
                            </View>
                            <TextInput
                              style={{ flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground, backgroundColor: c.input, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: hasError ? "#DC2626" : isFilled ? c.primary + "60" : c.border }}
                              placeholder="-"
                              placeholderTextColor={c.mutedForeground}
                              value={raw}
                              onChangeText={(v) => handleFieldChange(productId, key, v)}
                              keyboardType="decimal-pad"
                              maxLength={5}
                            />
                            <Text style={{ marginLeft: 6, fontSize: 13, color: c.mutedForeground, width: 14 }}>
                              {isFilled ? '"' : ""}
                            </Text>
                          </View>
                          {hasError && (
                            <View style={{ paddingHorizontal: 16, paddingBottom: 6, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEF2F2" }}>
                              <MaterialIcons name="error-outline" size={12} color="#DC2626" />
                              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#DC2626" }}>
                                {draft.fieldErrors[key]}
                              </Text>
                            </View>
                          )}
                          {idx < fields.length - 1 && <View style={{ height: 1, backgroundColor: c.border, marginLeft: 16 }} />}
                        </View>
                      );
                    })}

                    {productFeatures.length > 0 && (
                      <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8, backgroundColor: c.muted + "40" }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Sub-types / Features
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          {productFeatures.map((f) => {
                            const checked = draft.selectedFeatures.includes(f.label);
                            return (
                              <Pressable
                                key={f.label}
                                onPress={() => {
                                  setProductDraft(productId, (d) => {
                                    const next = checked
                                      ? d.selectedFeatures.filter((s) => s !== f.label)
                                      : [...d.selectedFeatures, f.label];
                                    return { ...d, selectedFeatures: next };
                                  });
                                  Haptics.selectionAsync();
                                }}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 6,
                                  paddingHorizontal: 12,
                                  paddingVertical: 7,
                                  borderRadius: 18,
                                  backgroundColor: checked ? c.primary : c.card,
                                  borderWidth: 1,
                                  borderColor: checked ? c.primary : c.border,
                                }}
                              >
                                <MaterialIcons
                                  name={checked ? "check-box" : "check-box-outline-blank"}
                                  size={16}
                                  color={checked ? "#FFFFFF" : c.mutedForeground}
                                />
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontFamily: checked ? "Inter_600SemiBold" : "Inter_400Regular",
                                    color: checked ? "#FFFFFF" : c.foreground,
                                  }}
                                >
                                  {f.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {productCustomFields.length > 0 && (
                      <View style={{ borderTopWidth: 1, borderTopColor: c.border }}>
                        <Text style={{ paddingHorizontal: 16, paddingTop: 12, fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Custom
                        </Text>
                        {productCustomFields.map((cf, idx) => (
                          <View key={cf.id}>
                            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 11 }}>
                              <View style={{ width: 106 }}>
                                <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.foreground }}>{cf.fieldName}</Text>
                              </View>
                              <TextInput
                                style={{ flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground, backgroundColor: c.input, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: c.border }}
                                placeholder="-"
                                placeholderTextColor={c.mutedForeground}
                                value={draft.customValues[cf.id] ?? ""}
                                onChangeText={(v) => handleCustomFieldChange(productId, cf.id, v)}
                                keyboardType="decimal-pad"
                                maxLength={5}
                              />
                              <Text style={{ marginLeft: 6, fontSize: 13, color: c.mutedForeground, width: 14 }}>"</Text>
                            </View>
                            {idx < productCustomFields.length - 1 && <View style={{ height: 1, backgroundColor: c.border, marginLeft: 16 }} />}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={() => setShowCustomModal(true)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: c.card, borderRadius: colors.radius, borderWidth: 1.5, borderColor: c.border, borderStyle: "dashed", opacity: pressed ? 0.8 : 1 })}
        >
          <MaterialIcons name="add-circle-outline" size={20} color={c.primary} />
          <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: c.primary }}>
            Add Custom Measurement
          </Text>
        </Pressable>

        <View style={{ backgroundColor: c.muted, borderRadius: colors.radius, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <MaterialIcons name="info-outline" size={16} color={c.mutedForeground} />
          <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
            Photos are uploaded with the order, not with the measurement.
          </Text>
        </View>

        <Input label="Notes" placeholder="Additional notes..." value={notes} onChangeText={(v) => setNotes(v.slice(0, 500))} icon="notes" multiline maxLength={500} />
      </ScrollView>

      <Modal visible={showProductModal} transparent animationType="slide" onRequestClose={() => setShowProductModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }} onPress={() => setShowProductModal(false)}>
          <Pressable style={{ backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 24, gap: 10 }}>
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>Add Product</Text>
            {availableProducts.map((pt) => (
              <Pressable key={pt.id} onPress={() => handleAddProduct(pt.id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <MaterialIcons name="add-circle-outline" size={20} color={c.primary} />
                <Text style={{ flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>{pt.name}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showCustomModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={{ backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24, gap: 16 }}>
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>Add Custom Field</Text>
            <Input label="Field Name" placeholder="e.g. Collar Width, Arm Opening" value={newFieldName} onChangeText={(v) => setNewFieldName(v.slice(0, 60))} icon="straighten" autoFocus maxLength={60} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button label="Cancel" onPress={() => { setShowCustomModal(false); setNewFieldName(""); }} variant="outline" style={{ flex: 1 }} />
              <Button label="Add Field" onPress={handleAddCustomField} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}
