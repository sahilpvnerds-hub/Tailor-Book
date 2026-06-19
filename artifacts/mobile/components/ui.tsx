import React from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import colors from "@/constants/colors";

// ── Card ──────────────────────────────────────────────────────────────────────
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
    ...(elevated
      ? {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.07,
          shadowRadius: 10,
          elevation: 4,
        }
      : {}),
  };
  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        style={({ pressed }) => [base, style, { opacity: pressed ? 0.88 : 1 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

// ── Button ────────────────────────────────────────────────────────────────────
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

  const bgMap = {
    primary: disabled ? c.muted : c.primary,
    secondary: c.secondary,
    destructive: disabled ? c.muted : c.destructive,
    ghost: "transparent",
    outline: "transparent",
  };

  const fgMap = {
    primary: disabled ? c.mutedForeground : c.primaryForeground,
    secondary: c.secondaryForeground,
    destructive: disabled ? c.mutedForeground : c.destructiveForeground,
    ghost: c.foreground,
    outline: c.primary,
  };

  const padMap = {
    sm: { paddingHorizontal: 16, paddingVertical: 10 },
    md: { paddingHorizontal: 20, paddingVertical: 15 },
    lg: { paddingHorizontal: 26, paddingVertical: 18 },
  };

  const fontSize = size === "sm" ? 13 : size === "lg" ? 17 : 15;

  return (
    <Pressable
      onPress={() => {
        if (!disabled && !loading) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bgMap[variant],
          borderRadius: colors.radius,
          flexDirection: "row" as const,
          alignItems: "center" as const,
          justifyContent: "center" as const,
          gap: 6,
          borderWidth: variant === "outline" ? 1.5 : 0,
          borderColor: variant === "outline" ? c.primary : "transparent",
          ...(fullWidth ? { alignSelf: "stretch" as const } : {}),
          ...padMap[size],
          opacity: pressed && !disabled ? 0.82 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fgMap[variant]} size="small" />
      ) : (
        <>
          {icon && (
            <MaterialIcons name={icon} size={fontSize + 2} color={fgMap[variant]} />
          )}
          {label && (
            <Text
              style={{
                color: fgMap[variant],
                fontSize,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {label}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  rightElement?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const Input = React.forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    icon,
    rightElement,
    containerStyle,
    style,
    ...props
  }: InputProps,
  ref,
) {
  const c = useColors();
  return (
    <View style={[{ gap: 5 }, containerStyle]}>
      {label && (
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Inter_600SemiBold",
            color: c.mutedForeground,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
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
          paddingHorizontal: 14,
        }}
      >
        {icon && (
          <MaterialIcons
            name={icon}
            size={18}
            color={c.mutedForeground}
            style={{ marginRight: 10 }}
          />
        )}
        <TextInput
          ref={ref}
          style={[
            {
              flex: 1,
              fontSize: 16,
              fontFamily: "Inter_400Regular",
              color: c.foreground,
              paddingVertical: 14,
              minHeight: 26,
            },
            style,
          ]}
          placeholderTextColor={c.mutedForeground}
          {...props}
        />
        {rightElement}
      </View>
      {error && (
        <Text style={{ fontSize: 12, color: c.destructive, marginTop: 2 }}>
          {error}
        </Text>
      )}
    </View>
  );
});

// ── Badge ─────────────────────────────────────────────────────────────────────
type BadgeVariant = "default" | "success" | "warning" | "destructive" | "secondary";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ label, variant = "default", style }: BadgeProps) {
  const c = useColors();
  const bgMap = {
    default: c.accent,
    success: "#D1FAE5",
    warning: "#FEF3C7",
    destructive: "#FEE2E2",
    secondary: c.secondary,
  };
  const fgMap = {
    default: c.primary,
    success: "#065F46",
    warning: "#92400E",
    destructive: "#991B1B",
    secondary: c.secondaryForeground,
  };
  return (
    <View
      style={[
        {
          backgroundColor: bgMap[variant],
          borderRadius: 7,
          paddingHorizontal: 9,
          paddingVertical: 3,
          alignSelf: "flex-start" as const,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: 11,
          fontFamily: "Inter_600SemiBold",
          color: fgMap[variant],
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  const c = useColors();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 36,
      }}
    >
      <View
        style={{
          backgroundColor: c.muted,
          borderRadius: 24,
          padding: 22,
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        <MaterialIcons name={icon} size={40} color={c.mutedForeground} />
      </View>
      <Text
        style={{
          fontSize: 17,
          fontFamily: "Inter_700Bold",
          color: c.foreground,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Inter_400Regular",
            color: c.mutedForeground,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          {subtitle}
        </Text>
      )}
      {action && (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="primary"
          style={{ marginTop: 4 }}
        />
      )}
    </View>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
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
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 2,
        },
        style,
      ]}
    >
      <View
        style={{
          backgroundColor: color + "18",
          borderRadius: 10,
          padding: 8,
          alignSelf: "flex-start",
        }}
      >
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <View>
        <Text
          style={{
            fontSize: 22,
            fontFamily: "Inter_700Bold",
            color: c.foreground,
          }}
        >
          {value}
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Inter_400Regular",
            color: c.mutedForeground,
            marginTop: 2,
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────
interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontFamily: "Inter_700Bold",
          color: c.foreground,
        }}
      >
        {title}
      </Text>
      {action && (
        <Pressable onPress={action.onPress}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Inter_500Medium",
              color: c.primary,
            }}
          >
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ style }: { style?: ViewStyle }) {
  const c = useColors();
  return (
    <View style={[{ height: 1, backgroundColor: c.border }, style]} />
  );
}
