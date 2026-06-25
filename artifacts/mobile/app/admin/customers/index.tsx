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
import type { Customer } from "@/types";

/**
 * Read-only customer directory for the admin. Lists every customer across
 * all tailors in a data table, with free-text search.
 */
export default function AdminCustomersScreen() {
  const c = useColors();
  const [list, setList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const rows = await api.customers.get(token);
      setList(rows);
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
    return list.filter(
      (cu) =>
        cu.name.toLowerCase().includes(needle) ||
        cu.mobile.toLowerCase().includes(needle) ||
        (cu.email?.toLowerCase().includes(needle) ?? false),
    );
  }, [search, list]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Search bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingVertical: 14,
          gap: 12,
          backgroundColor: c.background,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            backgroundColor: c.card,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            height: 40,
            flex: 1,
            maxWidth: 380,
          }}
        >
          <MaterialIcons name="search" size={18} color={c.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${list.length} customers`}
            placeholderTextColor={c.mutedForeground}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 13,
              color: c.foreground,
              padding: 0,
            }}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <MaterialIcons name="close" size={18} color={c.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        <Text style={{ fontSize: 12, color: c.mutedForeground, fontWeight: "600" }}>
          {filtered.length} of {list.length} customers
        </Text>
      </View>

      {filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: c.muted,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <MaterialIcons name="people" size={28} color={c.mutedForeground} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>
            No customers found
          </Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: c.mutedForeground }}>
            {search ? "Try a different search" : "No customers on the platform yet"}
          </Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
          contentContainerStyle={{ padding: 24 }}
        >
          <View
            style={{
              backgroundColor: c.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: c.border,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 18,
                paddingVertical: 12,
                backgroundColor: c.muted,
                borderBottomWidth: 1,
                borderBottomColor: c.border,
              }}
            >
              <Text style={[styles.th, { color: c.mutedForeground, flex: 2.5 }]}>CUSTOMER</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1.5 }]}>MOBILE</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1 }]}>GENDER</Text>
              <Text style={[styles.th, { color: c.mutedForeground, flex: 1.5 }]}>JOINED</Text>
            </View>

            {filtered.map((cu) => (
              <View
                key={cu.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: c.border,
                  gap: 12,
                }}
              >
                <View style={{ flex: 2.5, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: c.secondary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: c.foreground }}>
                      {cu.name?.charAt(0).toUpperCase() ?? "?"}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{ fontSize: 13, fontWeight: "700", color: c.foreground }}
                      numberOfLines={1}
                    >
                      {cu.name}
                    </Text>
                    {cu.email ? (
                      <Text
                        style={{ fontSize: 11, color: c.mutedForeground, marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {cu.email}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text style={[styles.td, { color: c.foreground, flex: 1.5 }]} numberOfLines={1}>
                  {cu.mobile}
                </Text>
                <Text
                  style={[styles.td, { color: c.mutedForeground, flex: 1, textTransform: "capitalize" }]}
                  numberOfLines={1}
                >
                  {cu.gender ?? "—"}
                </Text>
                <Text style={[styles.td, { color: c.mutedForeground, flex: 1.5 }]} numberOfLines={1}>
                  {new Date(cu.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles: { th: any; td: any } = {
  th: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  td: {
    fontSize: 13,
  },
};
