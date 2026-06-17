import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import colors from "@/constants/colors";

const SLIDES = [
  {
    icon: "storefront" as const,
    title: "Welcome to Tailor Book",
    subtitle: "Your complete tailoring business management solution. Manage customers, measurements, and invoices all in one place.",
    color: "#0D6E6E",
  },
  {
    icon: "straighten" as const,
    title: "Smart Measurements",
    subtitle: "Record precise measurements for each customer by product type. All fields are validated to ensure accuracy and consistency.",
    color: "#6366F1",
  },
  {
    icon: "notifications-active" as const,
    title: "Delivery Reminders",
    subtitle: "Never miss a delivery. Get automatic alerts the day before an order is due so you always stay on schedule.",
    color: "#D97706",
  },
  {
    icon: "receipt" as const,
    title: "Easy Invoicing",
    subtitle: "Generate professional invoices in seconds. Prices auto-fill from your Product Type Master. Share via WhatsApp or email instantly.",
    color: "#059669",
  },
];

export default function OnboardingScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { updateOnboardingComplete } = useAuth();
  const [current, setCurrent] = useState(0);

  async function finish() {
    await updateOnboardingComplete();
    router.replace("/(tabs)");
  }

  function next() {
    if (current < SLIDES.length - 1) {
      setCurrent(current + 1);
    } else {
      finish();
    }
  }

  function prev() {
    if (current > 0) setCurrent(current - 1);
  }

  const slide = SLIDES[current];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Skip */}
      <Pressable
        onPress={finish}
        style={{
          position: "absolute",
          top: insets.top + 16,
          right: 20,
          zIndex: 10,
          paddingHorizontal: 14,
          paddingVertical: 7,
          backgroundColor: c.muted,
          borderRadius: 20,
        }}
      >
        <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
          Skip
        </Text>
      </Pressable>

      {/* Main content */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
          gap: 24,
        }}
      >
        {/* Icon */}
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 36,
            backgroundColor: slide.color + "18",
            borderWidth: 2,
            borderColor: slide.color + "30",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name={slide.icon} size={56} color={slide.color} />
        </View>

        <View style={{ alignItems: "center", gap: 12 }}>
          <Text
            style={{
              fontSize: 26,
              fontFamily: "Inter_700Bold",
              color: c.foreground,
              textAlign: "center",
            }}
          >
            {slide.title}
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontFamily: "Inter_400Regular",
              color: c.mutedForeground,
              textAlign: "center",
              lineHeight: 24,
            }}
          >
            {slide.subtitle}
          </Text>
        </View>

        {/* Dots */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === current ? c.primary : c.border,
              }}
            />
          ))}
        </View>
      </View>

      {/* Navigation */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.card,
        }}
      >
        <Pressable
          onPress={prev}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: colors.radius,
            backgroundColor: current === 0 ? "transparent" : c.muted,
            opacity: current === 0 ? 0 : 1,
          }}
          disabled={current === 0}
        >
          <Text
            style={{
              fontSize: 15,
              fontFamily: "Inter_600SemiBold",
              color: c.foreground,
            }}
          >
            Previous
          </Text>
        </Pressable>

        <Text
          style={{
            fontSize: 13,
            fontFamily: "Inter_400Regular",
            color: c.mutedForeground,
          }}
        >
          {current + 1} / {SLIDES.length}
        </Text>

        <Pressable
          onPress={next}
          style={({ pressed }) => ({
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: colors.radius,
            backgroundColor: c.primary,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" }}>
            {current === SLIDES.length - 1 ? "Get Started" : "Next"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
