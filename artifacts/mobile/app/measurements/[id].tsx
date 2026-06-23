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
import { useData } from "@/context/DataContext";
import { Badge, Button, Card, Divider, Input } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { MEASUREMENT_FIELDS, getFieldsForProduct } from "@/constants/products";
import { MeasurementKey } from "@/constants/measurementFields";
import { formatDate } from "@/utils/storage";
import { base64ToDataUri, pickMeasurementPhotos } from "@/utils/photos";
import colors from "@/constants/colors";

function titleCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

export default function MeasurementDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { measurements, deleteMeasurement, updateMeasurement, customers, familyMembers } = useData();
  const measurement = measurements.find((m) => m.id === id);

  const [editing, setEditing] = useState(false);
  const [editPhotos, setEditPhotos] = useState<string[]>(measurement?.photos ?? []);
  const [editNotes, setEditNotes] = useState(measurement?.notes ?? "");
  const [editDeliveryDate, setEditDeliveryDate] = useState(measurement?.deliveryDate?.split("T")[0] ?? "");
  // Editable copies of the measurement's per-field values. Initialised
  // on open and merged into the existing measurement on save — and the
  // save cascades the new values to every order / invoice that
  // references this measurement.
  const [editFieldValues, setEditFieldValues] = useState<Record<string, string>>({});
  const [editCustomValues, setEditCustomValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [photoView, setPhotoView] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : 0;

  if (!measurement) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>Not found</Text>
      </View>
    );
  }

  async function handleDelete() {
    Alert.alert("Delete Measurement", "Delete this measurement record?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const result = await deleteMeasurement(measurement!.id);
          // DataContext returns `{ ok: false, references }` if the
          // measurement is still referenced by an order or invoice.
          if (result && result.ok === false) {
            const refs = result.references ?? { orders: [], invoices: [] };
            const orderText = refs.orders.length > 0 ? refs.orders.join(", ") : "";
            const invoiceText = refs.invoices.length > 0 ? refs.invoices.join(", ") : "";
            const parts: string[] = [];
            if (orderText) parts.push(`orders: ${orderText}`);
            if (invoiceText) parts.push(`invoices: ${invoiceText}`);
            Alert.alert(
              "Cannot delete",
              `This measurement is used in ${parts.join(" and ")}. Delete or edit those orders/invoices first.`,
            );
            return;
          }
          router.back();
        },
      },
    ]);
  }

  function openEdit() {
    setEditPhotos(measurement!.photos ?? []);
    setEditNotes(measurement!.notes ?? "");
    setEditDeliveryDate(measurement!.deliveryDate?.split("T")[0] ?? "");
    // Seed the per-field edit state from the current measurement so
    // the tailor can correct any value.
    const fieldValues: Record<string, string> = {};
    for (const key of getFieldsForProduct(measurement!.productType)) {
      const raw = (measurement as any)[key];
      if (raw !== undefined && raw !== null) fieldValues[key] = String(raw);
    }
    setEditFieldValues(fieldValues);
    const customValues: Record<string, string> = {};
    for (const cm of measurement!.customMeasurements ?? []) {
      customValues[cm.label] = String(cm.value);
    }
    setEditCustomValues(customValues);
    setEditing(true);
  }

  async function handleSaveEdit() {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (editDeliveryDate && new Date(editDeliveryDate).getTime() < todayStart.getTime()) {
      Alert.alert("Error", "Delivery Date cannot be in the past.");
      return;
    }

    setSaving(true);
    // Compose the patch — note the field values are merged with the
    // existing measurement so we don't drop keys the user didn't
    // touch.
    const patch: Record<string, any> = {
      photos: editPhotos,
      notes: editNotes.trim(),
      deliveryDate: editDeliveryDate ? new Date(editDeliveryDate).toISOString() : undefined,
    };
    for (const [key, val] of Object.entries(editFieldValues)) {
      if (val && val.trim() !== "") {
        const parsed = parseFloat(val);
        if (!isNaN(parsed)) patch[key] = parsed;
      }
    }
    // Persist edited custom measurements too — keep the existing
    // label/value shape, just with the updated number.
    const existingCustom = measurement!.customMeasurements ?? [];
    const updatedCustom = existingCustom.map((cm) => {
      const next = editCustomValues[cm.label];
      if (next === undefined) return cm;
      const parsed = parseFloat(next);
      return { label: cm.label, value: isNaN(parsed) ? cm.value : parsed };
    });
    patch.customMeasurements = updatedCustom;
    await updateMeasurement(measurement!.id, patch);
    setSaving(false);
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleEditAddPhotos() {
    const picked = await pickMeasurementPhotos(editPhotos.length);
    if (picked.length === 0) return;
    setEditPhotos((prev) => [...prev, ...picked.map((p) => p.base64).filter(Boolean)]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleEditRemovePhoto(idx: number) {
    setEditPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  const filledFields = MEASUREMENT_FIELDS.filter(
    (f) => (measurement as any)[f.key] !== undefined
  );
  const customer = customers.find((cu) => cu.id === measurement.customerId);
  const familyMember = measurement.familyMemberId
    ? familyMembers.find((fm) => fm.id === measurement.familyMemberId)
    : undefined;
  const personName = familyMember?.name ?? measurement.familyMemberName ?? customer?.name ?? measurement.customerName;
  const relation = familyMember?.relation ?? "self";
  const personLabel = `${personName} (${titleCase(relation)})`;

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
          backgroundColor: "#6366F1",
          gap: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 8 }}>
            <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" }}>
            Measurement
          </Text>
          <Pressable onPress={openEdit} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 8 }}>
            <MaterialIcons name="edit" size={18} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={handleDelete} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 8 }}>
            <MaterialIcons name="delete" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
            {personLabel}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Badge label={measurement.productType} variant="secondary" />
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" }}>
              {formatDate(measurement.date ?? measurement.measurementDate ?? measurement.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ padding: 20, gap: 16 }}>
        <Card>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
            Measurement Details
          </Text>
          <View style={{ gap: 10 }}>
            <View>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>Customer</Text>
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>{customer?.name ?? measurement.customerName}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>Measurement For</Text>
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>{personLabel}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>Product</Text>
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>{measurement.productType}</Text>
            </View>
          </View>
        </Card>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button label="Edit Measurement" onPress={openEdit} variant="outline" style={{ flex: 1 }} icon="edit" />
          <Button
            label="Create Order"
            onPress={() => {
              const cust = customer ?? customers.find((cu) => cu.id === measurement.customerId);
              if (cust) {
                router.push({
                  pathname: "/orders/new",
                  params: { customerId: cust.id, measurementId: measurement.id },
                });
              }
            }}
            style={{ flex: 1 }}
            icon="shopping-bag"
          />
        </View>

        {/* Delivery Date */}
        {measurement.deliveryDate && (
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
                {formatDate(measurement.deliveryDate)}
              </Text>
            </View>
          </View>
        )}

        {/* Photos */}
        {measurement.photos && measurement.photos.length > 0 && (
          <Card>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
              Photos ({measurement.photos.length})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {measurement.photos.map((photo, idx) => (
                <Pressable key={idx} onPress={() => setPhotoView(photo)}>
                  <Image
                    source={{ uri: base64ToDataUri(photo) }}
                    style={{ width: 110, height: 110, borderRadius: 12, backgroundColor: c.muted }}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          </Card>
        )}

        {/* Measurements */}
        <Card>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
            Measurements (inches)
          </Text>
          {filledFields.length === 0 ? (
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
              No measurements recorded
            </Text>
          ) : (
            <View style={{ gap: 0 }}>
              {filledFields.map((field, idx) => (
                <React.Fragment key={field.key}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                      {field.label}
                    </Text>
                    <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>
                      {(measurement as any)[field.key]}"
                    </Text>
                  </View>
                  {idx < filledFields.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </View>
          )}
        </Card>

        {/* Custom measurements */}
        {measurement.customMeasurements?.length > 0 && (
          <Card>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
              Custom
            </Text>
            <View style={{ gap: 0 }}>
              {measurement.customMeasurements.map((m, idx) => (
                <React.Fragment key={m.label}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>{m.label}</Text>
                    <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>{m.value}"</Text>
                  </View>
                  {idx < measurement.customMeasurements.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </View>
          </Card>
        )}

        {/* Notes */}
        {measurement.notes && (
          <Card>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Notes
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.foreground }}>
              {measurement.notes}
            </Text>
          </Card>
        )}

      </View>

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

      {/* Edit modal */}
      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
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
              gap: 14,
              maxHeight: "85%",
            }}
          >
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
              Edit Measurement
            </Text>

            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {getFieldsForProduct(measurement!.productType).length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Measurement Values (inches)
                  </Text>
                  {getFieldsForProduct(measurement!.productType).map((key) => {
                    const meta = MEASUREMENT_FIELDS.find((f) => f.key === key);
                    const label = meta?.label ?? key;
                    return (
                      <View
                        key={key}
                        style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}
                      >
                        <Text style={{ width: 110, fontSize: 13, fontFamily: "Inter_500Medium", color: c.foreground }}>
                          {label}
                        </Text>
                        <TextInput
                          style={{ flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground, backgroundColor: c.input, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: c.border }}
                          placeholder="-"
                          placeholderTextColor={c.mutedForeground}
                          value={editFieldValues[key as string] ?? ""}
                          onChangeText={(v) => {
                            // Same sanitisation as the new-measurement
                            // form: digits + single dot, capped at 5 chars.
                            const cleaned = v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 5);
                            setEditFieldValues((prev) => ({ ...prev, [key as string]: cleaned }));
                          }}
                          keyboardType="decimal-pad"
                          maxLength={5}
                        />
                        <Text style={{ width: 14, fontSize: 12, color: c.mutedForeground }}>"</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {Object.keys(editCustomValues).length > 0 && (
                <View style={{ gap: 6, marginTop: 6 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Custom Values (inches)
                  </Text>
                  {Object.entries(editCustomValues).map(([label, val]) => (
                    <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
                      <Text style={{ width: 110, fontSize: 13, fontFamily: "Inter_500Medium", color: c.foreground }}>
                        {label}
                      </Text>
                      <TextInput
                        style={{ flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground, backgroundColor: c.input, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: c.border }}
                        placeholder="-"
                        placeholderTextColor={c.mutedForeground}
                        value={val}
                        onChangeText={(v) => {
                          const cleaned = v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 5);
                          setEditCustomValues((prev) => ({ ...prev, [label]: cleaned }));
                        }}
                        keyboardType="decimal-pad"
                        maxLength={5}
                      />
                      <Text style={{ width: 14, fontSize: 12, color: c.mutedForeground }}>"</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <DatePicker
              label="Delivery Date"
              value={editDeliveryDate}
              onChange={setEditDeliveryDate}
              placeholder="Select delivery date"
            />

            <Input
              label="Notes"
              placeholder="Additional notes..."
              value={editNotes}
              onChangeText={setEditNotes}
              icon="notes"
              multiline
            />

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Photos ({editPhotos.length}/4)
              </Text>
              {editPhotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {editPhotos.map((p, idx) => (
                    <View key={idx} style={{ position: "relative" }}>
                      <Image
                        source={{ uri: base64ToDataUri(p) }}
                        style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: c.muted }}
                        resizeMode="cover"
                      />
                      <Pressable
                        onPress={() => handleEditRemovePhoto(idx)}
                        style={{ position: "absolute", top: -6, right: -6, backgroundColor: "#EF4444", borderRadius: 12, width: 22, height: 22, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.card }}
                      >
                        <MaterialIcons name="close" size={12} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
              {editPhotos.length < 4 && (
                <Pressable
                  onPress={handleEditAddPhotos}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    padding: 12,
                    backgroundColor: c.muted,
                    borderRadius: colors.radius,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderStyle: "dashed",
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <MaterialIcons name="add-a-photo" size={18} color={c.primary} />
                  <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.primary }}>
                    Add Photo
                  </Text>
                </Pressable>
              )}
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <Button label="Cancel" onPress={() => setEditing(false)} variant="outline" style={{ flex: 1 }} />
              <Button label="Save" onPress={handleSaveEdit} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}
