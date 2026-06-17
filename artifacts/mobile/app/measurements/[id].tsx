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
import { MEASUREMENT_FIELDS } from "@/constants/products";
import { formatDate } from "@/utils/storage";
import { base64ToDataUri, pickMeasurementPhotos } from "@/utils/photos";
import colors from "@/constants/colors";

export default function MeasurementDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { measurements, deleteMeasurement, updateMeasurement, customers } = useData();
  const measurement = measurements.find((m) => m.id === id);

  const [editing, setEditing] = useState(false);
  const [editPhotos, setEditPhotos] = useState<string[]>(measurement?.photos ?? []);
  const [editNotes, setEditNotes] = useState(measurement?.notes ?? "");
  const [editDeliveryDate, setEditDeliveryDate] = useState(measurement?.deliveryDate?.split("T")[0] ?? "");
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

  function handleDelete() {
    Alert.alert("Delete Measurement", "Delete this measurement record?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteMeasurement(measurement!.id);
          router.back();
        },
      },
    ]);
  }

  function openEdit() {
    setEditPhotos(measurement!.photos ?? []);
    setEditNotes(measurement!.notes ?? "");
    setEditDeliveryDate(measurement!.deliveryDate?.split("T")[0] ?? "");
    setEditing(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    await updateMeasurement(measurement!.id, {
      photos: editPhotos,
      notes: editNotes.trim(),
      deliveryDate: editDeliveryDate ? new Date(editDeliveryDate).toISOString() : undefined,
    });
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
            {measurement.customerName}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Badge label={measurement.productType} variant="secondary" />
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" }}>
              {formatDate(measurement.date)}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ padding: 20, gap: 16 }}>
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

        {/* Create invoice from this measurement */}
        <Pressable
          onPress={() => {
            const cust = customers.find((cu) => cu.id === measurement.customerId);
            if (cust) {
              router.push({
                pathname: "/invoices/new",
                params: { customerId: cust.id, customerName: cust.name, customerMobile: cust.mobile, measurementId: measurement.id, productType: measurement.productType },
              });
            }
          }}
          style={({ pressed }) => ({
            backgroundColor: c.primary,
            borderRadius: colors.radius,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <MaterialIcons name="receipt" size={20} color={c.primaryForeground} />
          <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.primaryForeground }}>
            Create Invoice for this Measurement
          </Text>
        </Pressable>
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
