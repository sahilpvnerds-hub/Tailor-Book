import React, { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { Card, Divider, EmptyState, SectionHeader } from "@/components/ui";
import { InvoiceItem, MeasurementItem } from "@/components/ListItems";
import { formatDate } from "@/utils/storage";
import colors from "@/constants/colors";

export default function CustomerDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { customers, getCustomerMeasurements, getCustomerInvoices, deleteCustomer } = useData();
  const customer = customers.find((c) => c.id === id);
  const measurements = customer ? getCustomerMeasurements(customer.id) : [];
  const invoices = customer ? getCustomerInvoices(customer.id) : [];

  const topPad = Platform.OS === "web" ? 67 : 0;

  if (!customer) {
    return (
      <EmptyState icon="person" title="Customer not found" subtitle="This customer may have been deleted" />
    );
  }

  function handleDelete() {
    Alert.alert("Delete Customer", `Delete ${customer!.name} and all their data?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteCustomer(customer!.id);
          router.back();
        },
      },
    ]);
  }

  const initials = customer.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

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
          backgroundColor: c.primary,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Pressable onPress={() => router.back()} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 8 }}>
            <MaterialIcons name="arrow-back" size={20} color={c.primaryForeground} />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold", color: c.primaryForeground }}>
            Customer
          </Text>
          <Pressable onPress={handleDelete} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 8 }}>
            <MaterialIcons name="delete" size={20} color={c.primaryForeground} />
          </Pressable>
        </View>

        <View style={{ alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: "rgba(255,255,255,0.25)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 26, fontFamily: "Inter_700Bold", color: c.primaryForeground }}>
              {initials}
            </Text>
          </View>
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: c.primaryForeground }}>
            {customer.name}
          </Text>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.primaryForeground + "CC" }}>
            {customer.mobile}
          </Text>
        </View>

        {/* Quick stats */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
          {[
            { label: "Measurements", value: measurements.length, icon: "straighten" as const },
            { label: "Invoices", value: invoices.length, icon: "receipt" as const },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: colors.radius,
                padding: 12,
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: c.primaryForeground }}>
                {s.value}
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.primaryForeground + "BB" }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ padding: 20, gap: 20 }}>
        {/* Contact info */}
        <Card>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
            Contact Info
          </Text>
          {[
            { icon: "phone" as const, label: "Mobile", value: customer.mobile },
            ...(customer.email ? [{ icon: "email" as const, label: "Email", value: customer.email }] : []),
            ...(customer.address ? [{ icon: "location-on" as const, label: "Address", value: customer.address }] : []),
            ...(customer.notes ? [{ icon: "notes" as const, label: "Notes", value: customer.notes }] : []),
          ].map((row, i, arr) => (
            <React.Fragment key={row.label}>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 8 }}>
                <MaterialIcons name={row.icon} size={16} color={c.mutedForeground} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>{row.label}</Text>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.foreground, marginTop: 1 }}>{row.value}</Text>
                </View>
              </View>
              {i < arr.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </Card>

        {/* Quick Actions */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => router.push({ pathname: "/measurements/new", params: { customerId: customer.id, customerName: customer.name } })}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: c.card,
              borderRadius: colors.radius,
              padding: 14,
              alignItems: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: c.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <MaterialIcons name="straighten" size={22} color={c.primary} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.foreground, textAlign: "center" }}>
              Add Measurement
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: "/invoices/new", params: { customerId: customer.id, customerName: customer.name, customerMobile: customer.mobile } })}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: c.card,
              borderRadius: colors.radius,
              padding: 14,
              alignItems: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: c.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <MaterialIcons name="receipt" size={22} color="#059669" />
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.foreground, textAlign: "center" }}>
              Create Invoice
            </Text>
          </Pressable>
        </View>

        {/* Measurements */}
        <View>
          <SectionHeader
            title="Measurements"
            action={{ label: "Add", onPress: () => router.push({ pathname: "/measurements/new", params: { customerId: customer.id, customerName: customer.name } }) }}
          />
          {measurements.length === 0 ? (
            <View style={{ alignItems: "center", padding: 24, backgroundColor: c.muted, borderRadius: colors.radius, gap: 8 }}>
              <MaterialIcons name="straighten" size={28} color={c.mutedForeground} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>No measurements yet</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {measurements.slice().reverse().map((m) => (
                <MeasurementItem key={m.id} measurement={m} onPress={() => router.push(`/measurements/${m.id}` as any)} />
              ))}
            </View>
          )}
        </View>

        {/* Invoices */}
        <View>
          <SectionHeader
            title="Invoices"
            action={{ label: "Create", onPress: () => router.push({ pathname: "/invoices/new", params: { customerId: customer.id, customerName: customer.name, customerMobile: customer.mobile } }) }}
          />
          {invoices.length === 0 ? (
            <View style={{ alignItems: "center", padding: 24, backgroundColor: c.muted, borderRadius: colors.radius, gap: 8 }}>
              <MaterialIcons name="receipt" size={28} color={c.mutedForeground} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>No invoices yet</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {invoices.slice().reverse().map((i) => (
                <InvoiceItem key={i.id} invoice={i} onPress={() => router.push(`/invoices/${i.id}` as any)} />
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
