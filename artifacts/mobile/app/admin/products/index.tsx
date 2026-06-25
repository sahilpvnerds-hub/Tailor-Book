import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { api, getToken } from "@/utils/api";
import type { ProductType } from "@/types";
import { formatCurrency } from "@/utils/storage";

/**
 * Admin Products Master — cross-tailor catalog. Lists every product type
 * across all tailors with the owning tailor name, current price, unit
 * (inches/cm), and feature count. Read-only: edits are still made by
 * each tailor on their own /products tab so pricing/features stay
 * owner-controlled.
 */
export default function AdminProductsScreen() {
  const c = useColors();
  const [list, setList] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const rows = await api.productTypes.get(token);
      setList(rows as ProductType[]);
    } catch {
      // empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((p) => p.name.toLowerCase().includes(needle));
  }, [search, list]);

  const counts = useMemo(() => {
    const byUnit: Record<string, number> = { inches: 0, cm: 0 };
    for (const p of list) {
      const u = (p as any).unit ?? "inches";
      byUnit[u] = (byUnit[u] ?? 0) + 1;
    }
    return byUnit;
  }, [list]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Search */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.card,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          paddingHorizontal: 12,
          gap: 8,
        }}
      >
        <MaterialIcons name="search" size={18} color={c.mutedForeground} />
        <TextInput
          style={{
            flex: 1,
            fontSize: 14,
            color: c.foreground,
            paddingVertical: 10,
          }}
          placeholder="Search product types..."
          placeholderTextColor={c.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <MaterialIcons name="close" size={16} color={c.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* Stats strip */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatPill c={c} label="Total" value={list.length} icon="local-offer" />
        <StatPill c={c} label="Inches" value={counts.inches ?? 0} icon="straighten" />
        <StatPill c={c} label="Centimeters" value={counts.cm ?? 0} icon="straighten" />
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
            gap: 10,
            backgroundColor: c.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <MaterialIcons name="local-offer" size={36} color={c.mutedForeground} />
          <Text style={{ fontSize: 14, color: c.mutedForeground }}>
            {search ? "No matching products" : "No product types yet"}
          </Text>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: c.border,
            overflow: "hidden",
          }}
        >
          {/* Header row */}
          <View
            style={{
              flexDirection: "row",
              padding: 12,
              backgroundColor: c.muted,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <Text style={[thStyle, { flex: 2 }]}>Product</Text>
            <Text style={[thStyle, { flex: 1.5 }]}>Tailor</Text>
            <Text style={[thStyle, { flex: 1, textAlign: "right" }]}>Price</Text>
            <Text style={[thStyle, { flex: 0.7, textAlign: "center" }]}>Unit</Text>
            <Text style={[thStyle, { flex: 0.7, textAlign: "center" }]}>Features</Text>
          </View>

          {filtered.map((pt, idx) => {
            const unit = (pt as any).unit ?? "inches";
            const featureCount = (pt as any).features?.length ?? 0;
            const tailorName = (pt as any).tailorName as string | null | undefined;
            const tailorShop = (pt as any).tailorShop as string | null | undefined;
            const tailorLabel =
              (tailorName && tailorShop ? `${tailorName} · ${tailorShop}` : tailorName) ??
              shortId(pt.tailorId);
            return (
              <View
                key={pt.id}
                style={{
                  flexDirection: "row",
                  padding: 12,
                  alignItems: "center",
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: c.border,
                }}
              >
                <View style={{ flex: 2, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      backgroundColor: c.primary + "18",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialIcons name="local-offer" size={16} color={c.primary} />
                  </View>
                  <Text
                    style={{ fontSize: 14, fontWeight: "600", color: c.foreground }}
                    numberOfLines={1}
                  >
                    {pt.name}
                  </Text>
                </View>
                <Text
                  style={[tdStyle, { flex: 1.5 }]}
                  numberOfLines={1}
                >
                  {tailorLabel}
                </Text>
                <Text style={[tdStyle, { flex: 1, textAlign: "right" }]}>
                  {formatCurrency(Number(pt.amount))}
                </Text>
                <Text style={[tdStyle, { flex: 0.7, textAlign: "center" }]}>
                  {unit === "cm" ? "cm" : "in"}
                </Text>
                <Text style={[tdStyle, { flex: 0.7, textAlign: "center" }]}>
                  {featureCount > 0 ? `${featureCount}` : "—"}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <Text
        style={{
          fontSize: 12,
          color: c.mutedForeground,
          textAlign: "center",
          paddingVertical: 8,
        }}
      >
        Pricing and features are owned by each tailor and edited on their
        Products tab. The catalog above reflects the latest snapshot from
        every tailor's master.
      </Text>
    </ScrollView>
  );
}

function StatPill({
  c,
  label,
  value,
  icon,
}: {
  c: ReturnType<typeof useColors>;
  label: string;
  value: number;
  icon: keyof typeof MaterialIcons.glyphMap;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.card,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: c.border,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <MaterialIcons name={icon} size={14} color={c.mutedForeground} />
        <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "600" }}>
          {label}
        </Text>
      </View>
      <Text style={{ fontSize: 20, fontWeight: "800", color: c.foreground }}>
        {value}
      </Text>
    </View>
  );
}

const thStyle = {
  fontSize: 11,
  fontWeight: "700" as const,
  color: "#6B8786",
  textTransform: "uppercase" as const,
  letterSpacing: 0.4,
};

const tdStyle = {
  fontSize: 13,
  color: "#0F2525",
};

function shortId(id: string): string {
  return id ? id.slice(0, 8) : "—";
}