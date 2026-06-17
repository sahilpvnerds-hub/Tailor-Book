import React, { useEffect, useState } from "react";
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
import { Button, Input } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { MEASUREMENT_FIELDS, getFieldsForProduct } from "@/constants/products";
import { MeasurementKey } from "@/constants/measurementFields";
import { base64ToDataUri, pickMeasurementPhotos } from "@/utils/photos";
import colors from "@/constants/colors";

type MeasurementValues = Partial<Record<MeasurementKey, string>>;

// ── Validation helpers ────────────────────────────────────────────────────────

/** Strip any character that is not a digit or decimal point. */
function sanitizeMeasurement(raw: string): string {
  // Allow digits and at most one decimal point, max 5 characters total.
  let cleaned = raw.replace(/[^0-9.]/g, "");
  // Remove extra decimal points (keep only the first)
  const parts = cleaned.split(".");
  if (parts.length > 2) cleaned = parts[0] + "." + parts.slice(1).join("");
  // Enforce max 5 characters
  if (cleaned.length > 5) cleaned = cleaned.slice(0, 5);
  return cleaned;
}

function isValidMeasurement(value: string): boolean {
  if (!value || value.trim() === "") return false;
  const n = parseFloat(value);
  return !isNaN(n) && n > 0;
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function NewMeasurementScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { addMeasurement, addCustomField, customers, customFields, productTypes } = useData();
  const params = useLocalSearchParams<{ customerId?: string; customerName?: string }>();

  const [selectedCustomerId, setSelectedCustomerId] = useState(params.customerId ?? "");
  const [selectedProductId, setSelectedProductId] = useState(productTypes[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [values, setValues] = useState<MeasurementValues>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  // Per-field validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Custom field modal
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");

  const selectedProduct = productTypes.find((p) => p.id === selectedProductId);
  const activeFields = selectedProduct ? getFieldsForProduct(selectedProduct.name) : [];
  const allFields = MEASUREMENT_FIELDS.filter((f) => activeFields.includes(f.key as MeasurementKey));

  useEffect(() => {
    if (productTypes.length > 0 && !selectedProductId) {
      setSelectedProductId(productTypes[0].id);
    }
  }, [productTypes]);

  // Clear errors when product changes
  useEffect(() => {
    setFieldErrors({});
  }, [selectedProductId]);

  // ── Field change handler with sanitisation ──────────────────────────────────
  function handleFieldChange(key: string, raw: string) {
    const clean = sanitizeMeasurement(raw);
    setValues((prev) => ({ ...prev, [key]: clean }));
    // Clear error on edit
    if (fieldErrors[key]) {
      setFieldErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
    }
  }

  // ── Photo helpers ───────────────────────────────────────────────────────────
  async function handleAddPhotos() {
    const picked = await pickMeasurementPhotos(photos.length);
    if (picked.length === 0) return;
    setPhotos((prev) => [...prev, ...picked.map((p) => p.base64).filter(Boolean)]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleRemovePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Custom field ────────────────────────────────────────────────────────────
  async function handleAddCustomField() {
    if (!newFieldName.trim()) return;
    await addCustomField(newFieldName.trim());
    setNewFieldName("");
    setShowCustomModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errors: Record<string, string> = {};

    // Check all active measurement fields are filled and valid
    for (const field of allFields) {
      const val = values[field.key as MeasurementKey] ?? "";
      if (!isValidMeasurement(val)) {
        errors[field.key] = `${field.label} is required`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }
    return true;
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedCustomerId) {
      Alert.alert("Error", "Please select a customer");
      return;
    }
    const customer = customers.find((cu) => cu.id === selectedCustomerId);
    if (!customer) { Alert.alert("Error", "Customer not found"); return; }
    if (!selectedProductId) { Alert.alert("Error", "Please select a product type"); return; }

    if (!validate()) {
      Alert.alert(
        "Incomplete Measurements",
        "All measurement fields are required. Please fill in every field before saving.",
      );
      return;
    }

    const customMeasurements = customFields
      .map((cf) => ({ label: cf.fieldName, value: parseFloat(customValues[cf.id] || "0") }))
      .filter((cm) => cm.value > 0);

    const measurementData: any = {
      customerId: selectedCustomerId,
      customerName: customer.name,
      date: new Date(date).toISOString(),
      deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
      productType: selectedProduct?.name ?? "",
      productTypeId: selectedProductId,
      customMeasurements,
      notes: notes.trim(),
      photos,
    };

    for (const field of allFields) {
      const val = values[field.key as MeasurementKey];
      if (val) measurementData[field.key] = parseFloat(val);
    }

    setLoading(true);
    await addMeasurement(measurementData);
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  const topPad = Platform.OS === "web" ? 67 : 0;
  const filledCount = allFields.filter((f) => isValidMeasurement(values[f.key as MeasurementKey] ?? "")).length;
  const errorCount = Object.keys(fieldErrors).length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ── Header ── */}
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
        <Pressable
          onPress={() => router.back()}
          style={{ backgroundColor: c.muted, borderRadius: 10, padding: 8 }}
        >
          <MaterialIcons name="arrow-back" size={20} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
            New Measurement
          </Text>
          {allFields.length > 0 && (
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
              {filledCount}/{allFields.length} fields filled
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
        {/* ── Validation error summary ── */}
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
              {errorCount} field{errorCount > 1 ? "s" : ""} required — please fill in all measurements.
            </Text>
          </View>
        )}

        {/* ── Customer ── */}
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Inter_600SemiBold",
              color: c.mutedForeground,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            Customer
          </Text>
          {params.customerId ? (
            <View
              style={{
                backgroundColor: c.card,
                borderRadius: colors.radius,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderWidth: 1,
                borderColor: c.primary + "40",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: c.primary + "20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: c.primary }}>
                  {(customers.find((cu) => cu.id === params.customerId)?.name ?? "?")[0]}
                </Text>
              </View>
              <Text style={{ flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                {customers.find((cu) => cu.id === params.customerId)?.name ?? params.customerName}
              </Text>
              <MaterialIcons name="check-circle" size={20} color={c.primary} />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -20, paddingHorizontal: 20 }}
            >
              <View style={{ flexDirection: "row", gap: 8 }}>
                {customers.map((cust) => (
                  <Pressable
                    key={cust.id}
                    onPress={() => setSelectedCustomerId(cust.id)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: colors.radius,
                      backgroundColor: selectedCustomerId === cust.id ? c.primary : c.card,
                      borderWidth: 1.5,
                      borderColor: selectedCustomerId === cust.id ? c.primary : c.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: "Inter_600SemiBold",
                        color: selectedCustomerId === cust.id ? "#FFFFFF" : c.foreground,
                      }}
                    >
                      {cust.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* ── Product Type ── */}
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Inter_600SemiBold",
              color: c.mutedForeground,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            Product Type
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -20, paddingHorizontal: 20 }}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              {productTypes.map((pt) => (
                <Pressable
                  key={pt.id}
                  onPress={() => { setSelectedProductId(pt.id); setValues({}); }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: selectedProductId === pt.id ? c.primary : c.muted,
                    borderWidth: 1,
                    borderColor: selectedProductId === pt.id ? c.primary : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: "Inter_500Medium",
                      color: selectedProductId === pt.id ? "#FFFFFF" : c.mutedForeground,
                    }}
                  >
                    {pt.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ── Dates — both use the shared DatePicker component ── */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <DatePicker
              label="Measurement Date"
              value={date}
              onChange={setDate}
              placeholder="Select date"
            />
          </View>
          <View style={{ flex: 1 }}>
            <DatePicker
              label="Delivery Date"
              value={deliveryDate}
              onChange={setDeliveryDate}
              placeholder="Select date"
            />
          </View>
        </View>

        {/* ── Measurement Fields ── */}
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Inter_600SemiBold",
              color: c.mutedForeground,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            {selectedProduct?.name ?? "Measurements"} (inches)
          </Text>

          <View
            style={{
              backgroundColor: c.card,
              borderRadius: 18,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            {allFields.map((field, idx) => {
              const key = field.key as MeasurementKey;
              const raw = values[key] ?? "";
              const isFilled = isValidMeasurement(raw);
              const hasError = !!fieldErrors[key];

              return (
                <View key={field.key}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 11,
                      backgroundColor: hasError
                        ? "#FEF2F2"
                        : isFilled
                        ? c.primary + "08"
                        : "transparent",
                    }}
                  >
                    {/* Field label */}
                    <View style={{ width: 106 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: isFilled ? "Inter_600SemiBold" : "Inter_400Regular",
                          color: hasError ? "#DC2626" : isFilled ? c.primary : c.foreground,
                        }}
                      >
                        {field.label}
                        {/* Required star */}
                        <Text style={{ color: "#DC2626" }}> *</Text>
                      </Text>
                    </View>

                    {/* Numeric input */}
                    <TextInput
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontFamily: "Inter_600SemiBold",
                        color: c.foreground,
                        backgroundColor: c.input,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderWidth: 1,
                        borderColor: hasError
                          ? "#DC2626"
                          : isFilled
                          ? c.primary + "60"
                          : c.border,
                      }}
                      placeholder="—"
                      placeholderTextColor={c.mutedForeground}
                      value={raw}
                      onChangeText={(v) => handleFieldChange(key, v)}
                      keyboardType="decimal-pad"
                      maxLength={5}
                    />

                    {/* Inch symbol when filled */}
                    <Text style={{ marginLeft: 6, fontSize: 13, color: c.mutedForeground, width: 14 }}>
                      {isFilled ? '"' : ""}
                    </Text>
                  </View>

                  {/* Inline error */}
                  {hasError && (
                    <View
                      style={{
                        paddingHorizontal: 16,
                        paddingBottom: 6,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: "#FEF2F2",
                      }}
                    >
                      <MaterialIcons name="error-outline" size={12} color="#DC2626" />
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#DC2626" }}>
                        {fieldErrors[key]}
                      </Text>
                    </View>
                  )}

                  {idx < allFields.length - 1 && (
                    <View style={{ height: 1, backgroundColor: c.border, marginLeft: 16 }} />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Custom Fields ── */}
        {customFields.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_600SemiBold",
                color: c.mutedForeground,
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              Custom Fields
            </Text>
            <View
              style={{
                backgroundColor: c.card,
                borderRadius: 18,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              {customFields.map((cf, idx) => (
                <View key={cf.id}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 11,
                    }}
                  >
                    <View style={{ width: 106 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.foreground }}>
                        {cf.fieldName}
                      </Text>
                    </View>
                    <TextInput
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontFamily: "Inter_600SemiBold",
                        color: c.foreground,
                        backgroundColor: c.input,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderWidth: 1,
                        borderColor: c.border,
                      }}
                      placeholder="—"
                      placeholderTextColor={c.mutedForeground}
                      value={customValues[cf.id] ?? ""}
                      onChangeText={(v) =>
                        setCustomValues((prev) => ({ ...prev, [cf.id]: sanitizeMeasurement(v) }))
                      }
                      keyboardType="decimal-pad"
                      maxLength={5}
                    />
                    <Text style={{ marginLeft: 6, fontSize: 13, color: c.mutedForeground, width: 14 }}>"</Text>
                  </View>
                  {idx < customFields.length - 1 && (
                    <View style={{ height: 1, backgroundColor: c.border, marginLeft: 16 }} />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Add Custom Field ── */}
        <Pressable
          onPress={() => setShowCustomModal(true)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 14,
            backgroundColor: c.card,
            borderRadius: colors.radius,
            borderWidth: 1.5,
            borderColor: c.border,
            borderStyle: "dashed",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <MaterialIcons name="add-circle-outline" size={20} color={c.primary} />
          <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: c.primary }}>
            Add Custom Measurement
          </Text>
        </Pressable>

        {/* ── Photo Upload ── */}
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Inter_600SemiBold",
              color: c.mutedForeground,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            Photos ({photos.length}/4)
          </Text>
          {photos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              {photos.map((photo, idx) => (
                <View key={idx} style={{ position: "relative" }}>
                  <Image
                    source={{ uri: base64ToDataUri(photo) }}
                    style={{ width: 90, height: 90, borderRadius: 12, backgroundColor: c.muted }}
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={() => handleRemovePhoto(idx)}
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      backgroundColor: "#EF4444",
                      borderRadius: 12,
                      width: 24,
                      height: 24,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: c.card,
                    }}
                  >
                    <MaterialIcons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
          {photos.length < 4 && (
            <Pressable
              onPress={handleAddPhotos}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 14,
                backgroundColor: c.card,
                borderRadius: colors.radius,
                borderWidth: 1.5,
                borderColor: c.border,
                borderStyle: "dashed",
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <MaterialIcons name="add-a-photo" size={20} color={c.primary} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: c.primary }}>
                Add Photos
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                  color: c.mutedForeground,
                  marginLeft: "auto" as any,
                }}
              >
                Up to 4
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Notes ── */}
        <Input
          label="Notes"
          placeholder="Additional notes..."
          value={notes}
          onChangeText={setNotes}
          icon="notes"
          multiline
        />
      </ScrollView>

      {/* ── Custom Field Modal ── */}
      <Modal visible={showCustomModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={{
              backgroundColor: c.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: insets.bottom + 24,
              gap: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
              Add Custom Field
            </Text>
            <Input
              label="Field Name"
              placeholder="e.g. Collar Width, Arm Opening"
              value={newFieldName}
              onChangeText={setNewFieldName}
              icon="straighten"
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                label="Cancel"
                onPress={() => { setShowCustomModal(false); setNewFieldName(""); }}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button label="Add Field" onPress={handleAddCustomField} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}
