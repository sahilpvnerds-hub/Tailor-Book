import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import colors from "@/constants/colors";

// --- Card ---
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  elevated?: boolean;
}

export function Card({ children, style, onPress, elevated = false }: CardProps) {
  const c = useColors();
  const base: ViewStyle = {
    backgroundColor: c.card,
    borderRadius: colors.radius,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
    ...(elevated ? { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 } : {}),
  };
  if (onPress) {
    return (
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
        style={({ pressed }) => [base, style, { opacity: pressed ? 0.9 : 1 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

// --- Button ---
type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost" | "outline";

interface ButtonProps {
  label?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof MaterialIcons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  size = "md",
  style,
}: ButtonProps) {
  const c = useColors();

  const getBg = () => {
    if (disabled) return c.muted;
    switch (variant) {
      case "primary": return c.primary;
      case "secondary": return c.secondary;
      case "destructive": return c.destructive;
      case "ghost": return "transparent";
      case "outline": return "transparent";
    }
  };

  const getFg = () => {
    if (disabled) return c.mutedForeground;
    switch (variant) {
      case "primary": return c.primaryForeground;
      case "secondary": return c.secondaryForeground;
      case "destructive": return c.destructiveForeground;
      case "ghost": return c.foreground;
      case "outline": return c.primary;
    }
  };

  const getPadding = () => {
    switch (size) {
      case "sm": return { paddingHorizontal: 12, paddingVertical: 7 };
      case "md": return { paddingHorizontal: 18, paddingVertical: 11 };
      case "lg": return { paddingHorizontal: 24, paddingVertical: 15 };
    }
  };

  const fontSize = size === "sm" ? 13 : size === "lg" ? 16 : 14;

  return (
    <Pressable
      onPress={() => { if (!disabled && !loading) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); } }}
      style={({ pressed }) => [
        {
          backgroundColor: getBg(),
          borderRadius: colors.radius,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          borderWidth: variant === "outline" ? 1.5 : 0,
          borderColor: variant === "outline" ? c.primary : "transparent",
          ...(fullWidth ? { width: "100%" } : {}),
          ...getPadding(),
          opacity: pressed && !disabled ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getFg()} size="small" />
      ) : (
        <>
          {icon && <MaterialIcons name={icon} size={fontSize + 2} color={getFg()} />}
          {label && (
            <Text style={{ color: getFg(), fontSize, fontFamily: "Inter_600SemiBold" }}>
              {label}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}

// --- Input ---
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  rightElement?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, icon, rightElement, containerStyle, style, ...props }: InputProps) {
  const c = useColors();
  return (
    <View style={[{ gap: 4 }, containerStyle]}>
      {label && (
        <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.input,
          borderRadius: colors.radius,
          borderWidth: 1.5,
          borderColor: error ? c.destructive : c.border,
          paddingHorizontal: 12,
        }}
      >
        {icon && <MaterialIcons name={icon} size={18} color={c.mutedForeground} style={{ marginRight: 8 }} />}
        <TextInput
          style={[
            {
              flex: 1,
              fontSize: 15,
              fontFamily: "Inter_400Regular",
              color: c.foreground,
              paddingVertical: 11,
            },
            style,
          ]}
          placeholderTextColor={c.mutedForeground}
          {...props}
        />
        {rightElement}
      </View>
      {error && <Text style={{ fontSize: 12, color: c.destructive }}>{error}</Text>}
    </View>
  );
}

// --- Badge ---
type BadgeVariant = "default" | "success" | "warning" | "destructive" | "secondary";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ label, variant = "default", style }: BadgeProps) {
  const c = useColors();
  const getBg = () => {
    switch (variant) {
      case "success": return "#D1FAE5";
      case "warning": return "#FEF3C7";
      case "destructive": return "#FEE2E2";
      case "secondary": return c.secondary;
      default: return c.accent;
    }
  };
  const getFg = () => {
    switch (variant) {
      case "success": return "#065F46";
      case "warning": return "#92400E";
      case "destructive": return "#991B1B";
      case "secondary": return c.secondaryForeground;
      default: return c.primary;
    }
  };
  return (
    <View style={[{ backgroundColor: getBg(), borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" }, style]}>
      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: getFg() }}>{label}</Text>
    </View>
  );
}

// --- EmptyState ---
interface EmptyStateProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
      <View style={{ backgroundColor: c.muted, borderRadius: 48, padding: 20 }}>
        <MaterialIcons name={icon} size={40} color={c.mutedForeground} />
      </View>
      <Text style={{ fontSize: 17, fontFamily: "Inter_600SemiBold", color: c.foreground, textAlign: "center" }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground, textAlign: "center" }}>{subtitle}</Text>}
      {action && (
        <Button label={action.label} onPress={action.action?.onPress ?? (() => {})} variant="primary" style={{ marginTop: 4 }} />
      )}
    </View>
  );
}

// --- StatCard ---
interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  style?: ViewStyle;
}

export function StatCard({ label, value, icon, color, style }: StatCardProps) {
  const c = useColors();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: c.card,
          borderRadius: colors.radius,
          padding: 16,
          borderWidth: 1,
          borderColor: c.border,
          gap: 10,
        },
        style,
      ]}
    >
      <View style={{ backgroundColor: color + "20", borderRadius: 8, padding: 8, alignSelf: "flex-start" }}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <View>
        <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: c.foreground }}>{value}</Text>
        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 2 }}>{label}</Text>
      </View>
    </View>
  );
}

// --- Section Header ---
interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: c.foreground }}>{title}</Text>
      {action && (
        <Pressable onPress={action.onPress}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.primary }}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

// --- Divider ---
export function Divider({ style }: { style?: ViewStyle }) {
  const c = useColors();
  return <View style={[{ height: 1, backgroundColor: c.border }, style]} />;
}
