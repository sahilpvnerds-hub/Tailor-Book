import React, { useCallback, useEffect, useRef, useState } from "react";
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

// Maps spoken words to measurement field keys
const FIELD_ALIASES: Record<string, MeasurementKey> = {
  chest: "chest",
  "chest size": "chest",
  shoulder: "shoulder",
  shoulders: "shoulder",
  neck: "neck",
  collar: "neck",
  sleeve: "sleeve",
  sleeves: "sleeve",
  "sleeve length": "sleeve",
  waist: "waist",
  length: "length",
  "shirt length": "length",
  "coat length": "length",
  hip: "hip",
  hips: "hip",
  seat: "hip",
  thigh: "thigh",
  thighs: "thigh",
  pant: "pantLength",
  "pant length": "pantLength",
  "trouser length": "pantLength",
  inseam: "pantLength",
  bottom: "bottomWidth",
  "bottom width": "bottomWidth",
  opening: "bottomWidth",
  armhole: "armhole",
  "arm hole": "armhole",
  wrist: "wrist",
  cuff: "wrist",
};

function parseVoiceText(text: string): { key: MeasurementKey | null; value: number | null } {
  const lower = text.toLowerCase().replace(/[^a-z0-9.\s]/g, "").trim();

  // Try to find a field name
  let foundKey: MeasurementKey | null = null;
  // Sort by length descending to prefer longer matches
  const sortedAliases = Object.entries(FIELD_ALIASES).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [alias, key] of sortedAliases) {
    if (lower.includes(alias)) {
      foundKey = key;
      break;
    }
  }

  // Extract number
  const numMatch = lower.match(/(\d+\.?\d*)/);
  const value = numMatch ? parseFloat(numMatch[1]) : null;

  return { key: foundKey, value };
}

export default function NewMeasurementScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { addMeasurement, customers } = useData();
  const params = useLocalSearchParams<{
    customerId?: string;
    customerName?: string;
  }>();

  const [loading, setLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(params.customerId ?? "");
  const [selectedProductType, setSelectedProductType] = useState(DEFAULT_PRODUCTS[0].name);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [values, setValues] = useState<MeasurementValues>({});
  const [notes, setNotes] = useState("");

  // Voice state
  const [voiceActive, setVoiceActive] = useState(false);
  const [lastFilled, setLastFilled] = useState<{ label: string; value: number } | null>(null);
  const [voiceStatus, setVoiceStatus] = useState("Tap the mic and speak");
  const recognitionRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (voiceActive) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => pulseLoop.current?.stop();
  }, [voiceActive]);

  function showToast(label: string, value: number) {
    setLastFilled({ label, value });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setLastFilled(null), 2500);
  }

  function applyValue(key: MeasurementKey, value: number) {
    const fieldLabel =
      MEASUREMENT_FIELDS.find((f) => f.key === key)?.label ?? key;
    setValues((prev) => ({ ...prev, [key]: String(value) }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast(fieldLabel, value);
  }

  function startWebVoice() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Alert.alert(
        "Not supported",
        "Voice recognition is not available in this browser. Please type values manually."
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      const transcript: string =
        event.results[event.results.length - 1][0].transcript;
      setVoiceStatus(`Heard: "${transcript}"`);

      const { key, value } = parseVoiceText(transcript);

      if (key && value !== null) {
        applyValue(key, value);
        const label = MEASUREMENT_FIELDS.find((f) => f.key === key)?.label ?? key;
        setVoiceStatus(`Got ${label}: ${value}"`);
      } else if (value !== null) {
        // No field name found — try to find next empty field
        const nextEmpty = MEASUREMENT_FIELDS.find(
          (f) => !values[f.key]
        );
        if (nextEmpty) {
          applyValue(nextEmpty.key, value);
          setVoiceStatus(`Got ${nextEmpty.label}: ${value}"`);
        } else {
          setVoiceStatus("Say a field name with value (e.g. chest 38)");
        }
      } else {
        setVoiceStatus("Could not understand. Try saying 'chest 38'");
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== "no-speech") {
        setVoiceStatus("Error. Tap mic to retry.");
        setVoiceActive(false);
      }
    };

    recognition.onend = () => {
      // Restart automatically if still active
      if (recognitionRef.current && voiceActive) {
        try {
          recognitionRef.current.start();
        } catch {}
      }
    };

    recognition.start();
    setVoiceStatus("Listening... Say 'chest 38' or 'neck 15'");
  }

  function stopWebVoice() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      } catch {}
    }
    setVoiceStatus("Tap the mic and speak");
  }

  function toggleVoice() {
    if (voiceActive) {
      setVoiceActive(false);
      stopWebVoice();
    } else {
      setVoiceActive(true);
      if (Platform.OS === "web") {
        startWebVoice();
      } else {
        setVoiceStatus("Say field name + value (e.g. chest 38). Tap to stop.");
      }
    }
  }

  // Keep recognition active state in sync for onend callback
  useEffect(() => {
    return () => {
      stopWebVoice();
    };
  }, []);

  const selectedCustomer = customers.find((cu) => cu.id === selectedCustomerId);

  async function handleSave() {
    if (!selectedCustomerId) {
      Alert.alert("Error", "Please select a customer");
      return;
    }
    const customer = customers.find((cu) => cu.id === selectedCustomerId);
    if (!customer) {
      Alert.alert("Error", "Customer not found");
      return;
    }

    const measurementData: any = {
      customerId: selectedCustomerId,
      customerName: customer.name,
      date: new Date(date).toISOString(),
      productType: selectedProductType,
      customMeasurements: [],
      notes: notes.trim(),
    };

    for (const field of MEASUREMENT_FIELDS) {
      const val = values[field.key];
      if (val) {
        measurementData[field.key] = parseFloat(val);
      }
    }

    if (voiceActive) {
      setVoiceActive(false);
      stopWebVoice();
    }

    setLoading(true);
    await addMeasurement(measurementData);
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  const topPad = Platform.OS === "web" ? 67 : 0;
  const filledCount = MEASUREMENT_FIELDS.filter((f) => values[f.key]).length;

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
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            backgroundColor: c.muted,
            borderRadius: 10,
            padding: 8,
          }}
        >
          <MaterialIcons name="arrow-back" size={20} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 18,
              fontFamily: "Inter_700Bold",
              color: c.foreground,
            }}
          >
            New Measurement
          </Text>
          {filledCount > 0 && (
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Inter_400Regular",
                color: c.mutedForeground,
              }}
            >
              {filledCount} / {MEASUREMENT_FIELDS.length} fields filled
            </Text>
          )}
        </View>
        <Button label="Save" onPress={handleSave} loading={loading} size="sm" />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          gap: 16,
          paddingBottom: insets.bottom + 50,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Voice Input Banner ─────────────────────── */}
        <View
          style={{
            backgroundColor: voiceActive ? c.primary : c.card,
            borderRadius: 18,
            padding: 18,
            borderWidth: 1.5,
            borderColor: voiceActive ? c.primary : c.border,
            gap: 14,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            {/* Mic button */}
            <Pressable onPress={toggleVoice}>
              <Animated.View
                style={{
                  transform: [{ scale: pulseAnim }],
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: voiceActive
                    ? "rgba(255,255,255,0.2)"
                    : c.primary + "18",
                  borderWidth: 2,
                  borderColor: voiceActive
                    ? "rgba(255,255,255,0.6)"
                    : c.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons
                  name={voiceActive ? "mic" : "mic-none"}
                  size={28}
                  color={voiceActive ? "#FFFFFF" : c.primary}
                />
              </Animated.View>
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Inter_600SemiBold",
                  color: voiceActive ? "#FFFFFF" : c.foreground,
                }}
              >
                {voiceActive ? "Voice Mode Active" : "Voice Input"}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_400Regular",
                  color: voiceActive
                    ? "rgba(255,255,255,0.75)"
                    : c.mutedForeground,
                  marginTop: 2,
                }}
              >
                {voiceStatus}
              </Text>
            </View>

            {voiceActive && (
              <Pressable
                onPress={toggleVoice}
                style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                <MaterialIcons name="stop" size={18} color="#FFFFFF" />
              </Pressable>
            )}
          </View>

          {/* Toast feedback */}
          {lastFilled && (
            <View
              style={{
                backgroundColor: voiceActive
                  ? "rgba(255,255,255,0.18)"
                  : c.secondary,
                borderRadius: 10,
                padding: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <MaterialIcons
                name="check-circle"
                size={16}
                color={voiceActive ? "#6EE7E7" : c.primary}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_600SemiBold",
                  color: voiceActive ? "#FFFFFF" : c.foreground,
                }}
              >
                {lastFilled.label} set to {lastFilled.value}"
              </Text>
            </View>
          )}

          {/* Hint */}
          {!voiceActive && (
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {["chest 38", "neck 15", "waist 32", "sleeve 24"].map((hint) => (
                <View
                  key={hint}
                  style={{
                    backgroundColor: c.muted,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderWidth: 1,
                    borderColor: c.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Inter_500Medium",
                      color: c.mutedForeground,
                    }}
                  >
                    "{hint}"
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Customer ────────────────────────────────── */}
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
          {params.customerId && selectedCustomer ? (
            <View
              style={{
                backgroundColor: c.card,
                borderRadius: colors.radius,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderWidth: 1,
                borderColor: c.border,
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
                <Text
                  style={{
                    fontFamily: "Inter_700Bold",
                    fontSize: 16,
                    color: c.primary,
                  }}
                >
                  {selectedCustomer.name[0]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: "Inter_600SemiBold",
                    color: c.foreground,
                  }}
                >
                  {selectedCustomer.name}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Inter_400Regular",
                    color: c.mutedForeground,
                  }}
                >
                  {selectedCustomer.mobile}
                </Text>
              </View>
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
                      backgroundColor:
                        selectedCustomerId === cust.id ? c.primary : c.card,
                      borderWidth: 1.5,
                      borderColor:
                        selectedCustomerId === cust.id ? c.primary : c.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: "Inter_600SemiBold",
                        color:
                          selectedCustomerId === cust.id
                            ? c.primaryForeground
                            : c.foreground,
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

        {/* ── Product type ────────────────────────────── */}
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
              {DEFAULT_PRODUCTS.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedProductType(p.name)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor:
                      selectedProductType === p.name ? c.primary : c.muted,
                    borderWidth: 1,
                    borderColor:
                      selectedProductType === p.name ? c.primary : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: "Inter_500Medium",
                      color:
                        selectedProductType === p.name
                          ? c.primaryForeground
                          : c.mutedForeground,
                    }}
                  >
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Date */}
        <Input
          label="Date"
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={setDate}
          icon="calendar-today"
        />

        {/* ── Measurement Fields ──────────────────────── */}
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
            Measurements (inches)
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
            {MEASUREMENT_FIELDS.map((field, idx) => {
              const isFilled = !!values[field.key];
              return (
                <View key={field.key}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 11,
                      backgroundColor: isFilled
                        ? c.primary + "08"
                        : "transparent",
                    }}
                  >
                    {/* Field label */}
                    <View style={{ width: 106 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: isFilled
                            ? "Inter_600SemiBold"
                            : "Inter_400Regular",
                          color: isFilled ? c.primary : c.foreground,
                        }}
                      >
                        {field.label}
                      </Text>
                    </View>

                    {/* Input */}
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
                        borderColor: isFilled ? c.primary + "60" : c.border,
                      }}
                      placeholder="—"
                      placeholderTextColor={c.mutedForeground}
                      value={values[field.key] ?? ""}
                      onChangeText={(v) =>
                        setValues((prev) => ({ ...prev, [field.key]: v }))
                      }
                      keyboardType="decimal-pad"
                    />

                    {/* Inch label */}
                    <Text
                      style={{
                        marginLeft: 6,
                        fontSize: 13,
                        color: c.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        width: 14,
                      }}
                    >
                      {isFilled ? '"' : ""}
                    </Text>

                    {/* Mic per field */}
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === "web") {
                          // Quick single-shot voice for this field
                          const SR =
                            (window as any).SpeechRecognition ||
                            (window as any).webkitSpeechRecognition;
                          if (!SR) return;
                          const r = new SR();
                          r.lang = "en-IN";
                          r.continuous = false;
                          r.interimResults = false;
                          r.onresult = (event: any) => {
                            const t: string =
                              event.results[0][0].transcript;
                            const num = t.match(/(\d+\.?\d*)/);
                            if (num) {
                              applyValue(field.key, parseFloat(num[1]));
                            }
                          };
                          r.start();
                        }
                        // On native: just focus the text input (mic is cosmetic)
                      }}
                      style={{
                        marginLeft: 6,
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor:
                          voiceActive && isFilled
                            ? c.primary + "20"
                            : c.muted,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons
                        name="mic"
                        size={15}
                        color={isFilled ? c.primary : c.mutedForeground}
                      />
                    </Pressable>
                  </View>

                  {idx < MEASUREMENT_FIELDS.length - 1 && (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: c.border,
                        marginLeft: 16,
                      }}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>

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
    </KeyboardAvoidingView>
  );
}
