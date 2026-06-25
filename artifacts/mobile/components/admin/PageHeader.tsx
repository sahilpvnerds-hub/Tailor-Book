import React from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";

export interface Crumb {
  /** Display label. */
  label: string;
  /** Optional href — when provided, the crumb becomes a link. */
  href?: string;
}

export interface PageAction {
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional breadcrumb shown above the title. The last entry is rendered as plain text. */
  crumbs?: Crumb[];
  /** Action buttons rendered on the right side. */
  actions?: PageAction[];
}

/**
 * Top of every admin page. Vercel-style:
 *
 *   Admin  /  Tailors  /  Ramesh Kumar
 *   Tailor Detail                                    [Suspend] [⋮]
 *   Last active 2h ago · joined Mar 2024
 */
export function PageHeader({ title, subtitle, crumbs = [], actions = [] }: PageHeaderProps) {
  const c = useColors();
  const router = useRouter();

  return (
    <View
      style={{
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 18,
        backgroundColor: c.background,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      }}
    >
      {/* Breadcrumb */}
      {crumbs.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
                {crumb.href && !isLast ? (
                  <Pressable onPress={() => router.push(crumb.href as any)} hitSlop={4}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: c.mutedForeground,
                        fontWeight: "500",
                      }}
                    >
                      {crumb.label}
                    </Text>
                  </Pressable>
                ) : (
                  <Text
                    style={{
                      fontSize: 12,
                      color: isLast ? c.foreground : c.mutedForeground,
                      fontWeight: isLast ? "600" : "500",
                    }}
                  >
                    {crumb.label}
                  </Text>
                )}
                {!isLast ? (
                  <MaterialIcons
                    name="chevron-right"
                    size={14}
                    color={c.mutedForeground}
                    style={{ marginHorizontal: 4 }}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Title row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 24, fontWeight: "800", color: c.foreground, letterSpacing: -0.4 }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{ marginTop: 4, fontSize: 12, color: c.mutedForeground }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {actions.length > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {actions.map((a, i) => (
              <PageActionButton key={i} action={a} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function PageActionButton({ action }: { action: PageAction }) {
  const c = useColors();
  const variant = action.variant ?? "secondary";

  const palette = (() => {
    switch (variant) {
      case "primary":
        return { bg: c.primary, fg: c.primaryForeground, border: c.primary };
      case "danger":
        return { bg: c.destructive, fg: c.destructiveForeground, border: c.destructive };
      case "ghost":
        return { bg: "transparent", fg: c.foreground, border: c.border };
      default:
        return { bg: c.card, fg: c.foreground, border: c.border };
    }
  })();

  return (
    <Pressable
      onPress={action.onPress}
      disabled={action.disabled || action.loading}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 9,
        backgroundColor: pressed
          ? variant === "primary" || variant === "danger"
            ? palette.bg
            : c.muted
          : palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
        opacity: action.disabled ? 0.5 : 1,
      })}
    >
      {action.icon ? (
        <MaterialIcons name={action.icon} size={16} color={palette.fg} />
      ) : null}
      <Text
        style={{
          marginLeft: action.icon ? 6 : 0,
          color: palette.fg,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        {action.label}
      </Text>
    </Pressable>
  );
}
