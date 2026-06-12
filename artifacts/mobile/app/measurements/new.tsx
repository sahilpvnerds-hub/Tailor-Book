import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { DEFAULT_PRODUCTS, MEASUREMENT_FIELDS, MeasurementKey } from "@/constants/products";
import { Measurement } from "@/types";
import colors from "@/constants/colors";

type MeasurementValues = Partial<Record<MeasurementKey, string>>;

export default function NewMeasurementScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { addMeasurement, customers } = useData();
  const params = useLocalSearchParams<{ customerId?: string; customerName?: string }>();

  const [loading, setLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(params.customerId ?? "");
  const [selectedProductType, setSelectedProductType] = useState(DEFAULT_PRODUCTS[0].name);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [values, setValues] = useState<MeasurementValues>({});
  const [notes, setNotes] = useState("");

  // Voice modal state
  const [voiceField, setVoiceField] = useState<{ key: MeasurementKey; label: string } | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceManualValue, setVoiceManualValue] = useState("");
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // For web voice
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (voiceListening) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [voiceListening]);

  function handleVoiceTap(key: MeasurementKey, label: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVoiceField({ key, label });
    setVoiceManualValue(values[key] ?? "");
    setVoiceListening(false);

    if (Platform.OS === "web") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setVoiceListening(true);
        const recognition = new SpeechRecognition();
        recognition.lang = "en-IN";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognitionRef.current = recognition;
        recognition.onresult = (event: any) => {
          const transcript: string = event.results[0][0].transcript.toLowerCase().trim();
          // Parse "chest 38" or "38"
          const match = transcript.match(/(\d+\.?\d*)/);
          if (match) {
            const val = match[1];
            setValues((prev) => ({ ...prev, [key]: val }));
            setVoiceField(null);
          } else {
            setVoiceManualValue(transcript);
          }
          setVoiceListening(false);
        };
        recognition.onerror = () => setVoiceListening(false);
        recognition.onend = () => setVoiceListening(false);
        recognition.start();
        return;
      }
    }
  }

  function closeVoiceModal() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setVoiceListening(false);
    setVoiceField(null);
    setVoiceManualValue("");
  }

  function applyVoiceValue() {
    if (voiceField && voiceManualValue.trim()) {
      const num = parseFloat(voiceManualValue.trim());
      if (!isNaN(num)) {
        setValues((prev) => ({ ...prev, [voiceField.key]: String(num) }));
      }
    }
    closeVoiceModal();
  }

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  async function handleSave() {
    if (!selectedCustomerId) { Alert.alert("Error", "Please select a customer"); return; }
    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (!customer) { Alert.alert("Error", "Customer not found"); return; }

    const measurementData: Partial<Omit<Measurement, "id" | "tailorId" | "createdAt">> = {
      customerId: selectedCustomerId,
      customerName: customer.name,
      date: new Date(date).toISOString(),
      productType: selectedProductType,
      customMeasurements: [],
      notes: notes.trim(),
    };

    // Map values to numeric fields
    for (const field of MEASUREMENT_FIELDS) {
      const val = values[field.key];
      if (val) {
        (measurementData as any)[field.key] = parseFloat(val);
      }
    }

    setLoading(true);
    await addMeasurement(measurementData as any);
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
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
          New Measurement
        </Text>
        <Button label="Save" onPress={handleSave} loading={loading} size="sm" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Customer select */}
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>Customer *</Text>
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
                      gap: 2,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: selectedCustomerId === cust.id ? c.primaryForeground : c.foreground }}>
                      {cust.name}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: selectedCustomerId === cust.id ? c.primaryForeground + "CC" : c.mutedForeground }}>
                      {cust.mobile}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Product type */}
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>Product Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {DEFAULT_PRODUCTS.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedProductType(p.name)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: selectedProductType === p.name ? c.primary : c.muted,
                  }}
                >
                  <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: selectedProductType === p.name ? c.primaryForeground : c.foreground }}>
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Date */}
        <Input
          label="Measurement Date"
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={setDate}
          icon="calendar-today"
        />

        {/* Measurement fields */}
        <Card style={{ gap: 0, padding: 0, overflow: "hidden" }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.muted, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialIcons name="straighten" size={16} color={c.primary} />
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
              Body Measurements (inches)
            </Text>
          </View>

          {MEASUREMENT_FIELDS.map((field, idx) => (
            <View key={field.key}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  gap: 10,
                }}
              >
                <Text style={{ width: 100, fontSize: 14, fontFamily: "Inter_500Medium", color: c.foreground }}>
                  {field.label}
                </Text>
                <TextInput
                  style={{
                    flex: 1,
                    fontSize: 15,
                    fontFamily: "Inter_400Regular",
                    color: c.foreground,
                    backgroundColor: c.input,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: c.border,
                  }}
                  placeholder="0"
                  placeholderTextColor={c.mutedForeground}
                  value={values[field.key] ?? ""}
                  onChangeText={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
                  keyboardType="decimal-pad"
                />
                <Pressable
                  onPress={() => handleVoiceTap(field.key, field.label)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: c.primary + "15",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialIcons name="mic" size={18} color={c.primary} />
                </Pressable>
              </View>
              {idx < MEASUREMENT_FIELDS.length - 1 && (
                <View style={{ height: 1, backgroundColor: c.border, marginLeft: 16 }} />
              )}
            </View>
          ))}
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

      {/* Voice Modal */}
      {voiceField && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <Pressable style={{ position: "absolute", inset: 0 }} onPress={closeVoiceModal} />
          <View
            style={{
              backgroundColor: c.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 28,
              width: "100%",
              gap: 20,
              paddingBottom: insets.bottom + 28,
            }}
          >
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground, textAlign: "center" }}>
              {voiceField.label}
            </Text>

            <View style={{ alignItems: "center", gap: 16 }}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: voiceListening ? c.destructive + "20" : c.primary + "15",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: voiceListening ? c.destructive : c.primary,
                  }}
                >
                  <MaterialIcons
                    name={voiceListening ? "mic" : "mic-off"}
                    size={36}
                    color={voiceListening ? c.destructive : c.primary}
                  />
                </View>
              </Animated.View>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, textAlign: "center" }}>
                {voiceListening
                  ? 'Listening... Say the measurement (e.g. "38")'
                  : 'Enter value manually below or tap mic on web'}
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              <TextInput
                style={{
                  fontSize: 24,
                  fontFamily: "Inter_700Bold",
                  color: c.foreground,
                  backgroundColor: c.input,
                  borderRadius: colors.radius,
                  padding: 16,
                  textAlign: "center",
                  borderWidth: 1.5,
                  borderColor: c.border,
                }}
                placeholder="Enter value"
                placeholderTextColor={c.mutedForeground}
                value={voiceManualValue}
                onChangeText={setVoiceManualValue}
                keyboardType="decimal-pad"
                autoFocus={!voiceListening}
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button label="Cancel" onPress={closeVoiceModal} variant="secondary" style={{ flex: 1 }} />
                <Button label="Apply" onPress={applyVoiceValue} variant="primary" style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
