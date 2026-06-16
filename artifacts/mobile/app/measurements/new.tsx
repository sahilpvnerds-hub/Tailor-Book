import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { MEASUREMENT_FIELDS, getFieldsForProduct } from "@/constants/products";
import { MeasurementKey } from "@/constants/measurementFields";
import colors from "@/constants/colors";

type MeasurementValues = Partial<Record<MeasurementKey, string>>;

const FIELD_ALIASES: Record<string, MeasurementKey> = {
  chest: "chest", "chest size": "chest",
  shoulder: "shoulder", shoulders: "shoulder",
  neck: "neck", collar: "neck",
  sleeve: "sleeve", sleeves: "sleeve",
  waist: "waist",
  length: "length", "shirt length": "length",
  hip: "hip", hips: "hip", seat: "hip",
  thigh: "thigh", thighs: "thigh",
  pant: "pantLength", "pant length": "pantLength", inseam: "pantLength",
  bottom: "bottomWidth", "bottom width": "bottomWidth", opening: "bottomWidth",
  armhole: "armhole", "arm hole": "armhole",
  wrist: "wrist", cuff: "wrist",
};

function parseVoice(text: string): { key: MeasurementKey | null; value: number | null } {
  const lower = text.toLowerCase().replace(/[^a-z0-9.\s]/g, "").trim();
  let foundKey: MeasurementKey | null = null;
  const sorted = Object.entries(FIELD_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, key] of sorted) {
    if (lower.includes(alias)) { foundKey = key; break; }
  }
  const numMatch = lower.match(/(\d+\.?\d*)/);
  const value = numMatch ? parseFloat(numMatch[1]) : null;
  return { key: foundKey, value };
}

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
  const [loading, setLoading] = useState(false);

  // Voice
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Tap mic and speak");
  const [lastFilled, setLastFilled] = useState<{ label: string; value: number } | null>(null);
  const recognitionRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (voiceActive) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [voiceActive]);

  function showToast(label: string, value: number) {
    setLastFilled({ label, value });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setLastFilled(null), 2500);
  }

  function applyValue(key: MeasurementKey, value: number) {
    const label = MEASUREMENT_FIELDS.find((f) => f.key === key)?.label ?? key;
    setValues((prev) => ({ ...prev, [key]: String(value) }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast(label, value);
  }

  function startWebVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { Alert.alert("Not Supported", "Voice recognition not available. Please type values manually."); return; }
    const r = new SR();
    r.lang = "en-IN";
    r.continuous = true;
    r.interimResults = false;
    recognitionRef.current = r;
    r.onresult = (event: any) => {
      const t: string = event.results[event.results.length - 1][0].transcript;
      setVoiceStatus(`Heard: "${t}"`);
      const { key, value } = parseVoice(t);
      if (key && value !== null && activeFields.includes(key)) {
        applyValue(key, value);
        setVoiceStatus(`${MEASUREMENT_FIELDS.find((f) => f.key === key)?.label}: ${value}"`);
      } else if (value !== null) {
        const next = allFields.find((f) => !values[f.key as MeasurementKey]);
        if (next) { applyValue(next.key as MeasurementKey, value); setVoiceStatus(`${next.label}: ${value}"`); }
        else setVoiceStatus("Say field name + value (e.g. chest 38)");
      } else {
        setVoiceStatus("Couldn't understand. Try 'chest 38'");
      }
    };
    r.onerror = (e: any) => { if (e.error !== "no-speech") { setVoiceStatus("Error. Tap to retry."); setVoiceActive(false); } };
    r.onend = () => { try { if (recognitionRef.current) r.start(); } catch {} };
    r.start();
    setVoiceStatus("Listening… Say 'chest 38' or 'neck 15'");
  }

  function stopVoice() {
    try { recognitionRef.current?.stop(); recognitionRef.current = null; } catch {}
    setVoiceStatus("Tap mic and speak");
  }

  function toggleVoice() {
    if (voiceActive) { setVoiceActive(false); stopVoice(); }
    else { setVoiceActive(true); if (Platform.OS === "web") startWebVoice(); }
  }

  useEffect(() => () => stopVoice(), []);

  async function handleAddCustomField() {
    if (!newFieldName.trim()) return;
    await addCustomField(newFieldName.trim());
    setNewFieldName("");
    setShowCustomModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleSave() {
    if (!selectedCustomerId) { Alert.alert("Error", "Please select a customer"); return; }
    const customer = customers.find((cu) => cu.id === selectedCustomerId);
    if (!customer) { Alert.alert("Error", "Customer not found"); return; }
    if (!selectedProductId) { Alert.alert("Error", "Please select a product type"); return; }

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
    };

    for (const field of allFields) {
      const val = values[field.key as MeasurementKey];
      if (val) measurementData[field.key] = parseFloat(val);
    }

    if (voiceActive) { setVoiceActive(false); stopVoice(); }
    setLoading(true);
    await addMeasurement(measurementData);
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  const topPad = Platform.OS === "web" ? 67 : 0;
  const filledCount = allFields.filter((f) => values[f.key as MeasurementKey]).length;

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
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>New Measurement</Text>
          {filledCount > 0 && (
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
              {filledCount}/{allFields.length} fields filled
            </Text>
          )}
        </View>
        <Button label="Save" onPress={handleSave} loading={loading} size="sm" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 50 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Voice Banner */}
        <View style={{ backgroundColor: voiceActive ? c.primary : c.card, borderRadius: 18, padding: 18, borderWidth: 1.5, borderColor: voiceActive ? c.primary : c.border, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Pressable onPress={toggleVoice}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }], width: 60, height: 60, borderRadius: 30, backgroundColor: voiceActive ? "rgba(255,255,255,0.2)" : c.primary + "18", borderWidth: 2, borderColor: voiceActive ? "rgba(255,255,255,0.6)" : c.primary, alignItems: "center", justifyContent: "center" }}>
                <MaterialIcons name={voiceActive ? "mic" : "mic-none"} size={28} color={voiceActive ? "#FFFFFF" : c.primary} />
              </Animated.View>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: voiceActive ? "#FFFFFF" : c.foreground }}>
                {voiceActive ? "Voice Mode Active" : "Voice Input"}
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: voiceActive ? "rgba(255,255,255,0.75)" : c.mutedForeground, marginTop: 2 }}>
                {voiceStatus}
              </Text>
            </View>
            {voiceActive && (
              <Pressable onPress={toggleVoice} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, padding: 8 }}>
                <MaterialIcons name="stop" size={18} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
          {lastFilled && (
            <View style={{ backgroundColor: voiceActive ? "rgba(255,255,255,0.18)" : c.secondary, borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialIcons name="check-circle" size={16} color={voiceActive ? "#6EE7E7" : c.primary} />
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: voiceActive ? "#FFFFFF" : c.foreground }}>
                {lastFilled.label} set to {lastFilled.value}"
              </Text>
            </View>
          )}
          {!voiceActive && (
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {["chest 38", "neck 15", "waist 32", "sleeve 24"].map((h) => (
                <View key={h} style={{ backgroundColor: c.muted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: c.border }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>"{h}"</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Customer */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6 }}>Customer</Text>
          {params.customerId ? (
            <View style={{ backgroundColor: c.card, borderRadius: colors.radius, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: c.primary + "40" }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary + "20", alignItems: "center", justifyContent: "center" }}>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {customers.map((cust) => (
                  <Pressable key={cust.id} onPress={() => setSelectedCustomerId(cust.id)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: colors.radius, backgroundColor: selectedCustomerId === cust.id ? c.primary : c.card, borderWidth: 1.5, borderColor: selectedCustomerId === cust.id ? c.primary : c.border }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: selectedCustomerId === cust.id ? "#FFFFFF" : c.foreground }}>
                      {cust.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Product Type */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6 }}>Product Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {productTypes.map((pt) => (
                <Pressable key={pt.id} onPress={() => { setSelectedProductId(pt.id); setValues({}); }} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: selectedProductId === pt.id ? c.primary : c.muted, borderWidth: 1, borderColor: selectedProductId === pt.id ? c.primary : "transparent" }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: selectedProductId === pt.id ? "#FFFFFF" : c.mutedForeground }}>
                    {pt.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Dates */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Input label="Measurement Date" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} icon="calendar-today" containerStyle={{ flex: 1 }} />
          <Input label="Delivery Date" placeholder="YYYY-MM-DD" value={deliveryDate} onChangeText={setDeliveryDate} icon="event" containerStyle={{ flex: 1 }} />
        </View>

        {/* Measurement Fields */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6 }}>
            {selectedProduct?.name ?? "Measurements"} (inches)
          </Text>
          <View style={{ backgroundColor: c.card, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: c.border }}>
            {allFields.map((field, idx) => {
              const key = field.key as MeasurementKey;
              const isFilled = !!values[key];
              return (
                <View key={field.key}>
                  <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 11, backgroundColor: isFilled ? c.primary + "08" : "transparent" }}>
                    <View style={{ width: 106 }}>
                      <Text style={{ fontSize: 14, fontFamily: isFilled ? "Inter_600SemiBold" : "Inter_400Regular", color: isFilled ? c.primary : c.foreground }}>
                        {field.label}
                      </Text>
                    </View>
                    <TextInput
                      style={{ flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground, backgroundColor: c.input, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: isFilled ? c.primary + "60" : c.border }}
                      placeholder="—"
                      placeholderTextColor={c.mutedForeground}
                      value={values[key] ?? ""}
                      onChangeText={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
                      keyboardType="decimal-pad"
                    />
                    <Text style={{ marginLeft: 6, fontSize: 13, color: c.mutedForeground, width: 14 }}>
                      {isFilled ? '"' : ""}
                    </Text>
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === "web") {
                          const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                          if (!SR) return;
                          const r = new SR();
                          r.lang = "en-IN";
                          r.onresult = (event: any) => {
                            const t: string = event.results[0][0].transcript;
                            const num = t.match(/(\d+\.?\d*)/);
                            if (num) applyValue(key, parseFloat(num[1]));
                          };
                          r.start();
                        }
                      }}
                      style={{ marginLeft: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" }}
                    >
                      <MaterialIcons name="mic" size={15} color={isFilled ? c.primary : c.mutedForeground} />
                    </Pressable>
                  </View>
                  {idx < allFields.length - 1 && <View style={{ height: 1, backgroundColor: c.border, marginLeft: 16 }} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* Custom Fields */}
        {customFields.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Custom Fields
            </Text>
            <View style={{ backgroundColor: c.card, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: c.border }}>
              {customFields.map((cf, idx) => (
                <View key={cf.id}>
                  <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 11 }}>
                    <View style={{ width: 106 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.foreground }}>{cf.fieldName}</Text>
                    </View>
                    <TextInput
                      style={{ flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground, backgroundColor: c.input, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: c.border }}
                      placeholder="—"
                      placeholderTextColor={c.mutedForeground}
                      value={customValues[cf.id] ?? ""}
                      onChangeText={(v) => setCustomValues((prev) => ({ ...prev, [cf.id]: v }))}
                      keyboardType="decimal-pad"
                    />
                    <Text style={{ marginLeft: 6, fontSize: 13, color: c.mutedForeground, width: 14 }}>"</Text>
                  </View>
                  {idx < customFields.length - 1 && <View style={{ height: 1, backgroundColor: c.border, marginLeft: 16 }} />}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Add Custom Field button */}
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

        <Input label="Notes" placeholder="Additional notes..." value={notes} onChangeText={setNotes} icon="notes" multiline />
      </ScrollView>

      {/* Custom Field Modal */}
      <Modal visible={showCustomModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={{ backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24, gap: 16 }}>
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>Add Custom Field</Text>
            <Input
              label="Field Name"
              placeholder="e.g. Collar Width, Arm Opening"
              value={newFieldName}
              onChangeText={setNewFieldName}
              icon="straighten"
              autoFocus
            />
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
