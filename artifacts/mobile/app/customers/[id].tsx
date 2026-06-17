import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { Card, Divider, EmptyState, SectionHeader } from "@/components/ui";
import { InvoiceItem, MeasurementItem } from "@/components/ListItems";
import { formatDate } from "@/utils/storage";
import colors from "@/constants/colors";
import { FamilyMember, Gender, Relation } from "@/types";
import { Button, Input } from "@/components/ui";
import { validateMobile, validateRequired, runValidation } from "@/utils/validation";

const RELATION_OPTIONS: Relation[] = ["father", "mother", "son", "daughter", "wife", "husband", "other"];
const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unisex", label: "Unisex" },
];

function AddFamilyMemberModal({
  visible,
  customerId,
  onClose,
}: {
  visible: boolean;
  customerId: string;
  onClose: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { addFamilyMember } = useData();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<Relation>("son");
  const [gender, setGender] = useState<Gender>("male");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    const errs = runValidation([
      { field: "name", error: validateRequired(name, "Name") },
    ]);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    await addFamilyMember({ primaryCustomerId: customerId, name: name.trim(), relation, gender });
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setName(""); setRelation("son"); setGender("male"); setErrors({});
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: insets.bottom + 24,
            gap: 14,
          }}
        >
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
            Add Family Member
          </Text>
          <Input
            label="Name *"
            placeholder="Family member's name"
            value={name}
            onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: undefined as any })); }}
            icon="person"
            error={errors.name}
            autoFocus
          />
          {/* Relation */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Relation
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {RELATION_OPTIONS.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setRelation(r)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: relation === r ? c.primary : c.muted,
                      borderWidth: 1,
                      borderColor: relation === r ? c.primary : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: relation === r ? "#FFFFFF" : c.mutedForeground }}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
          {/* Gender */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Gender
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {GENDER_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setGender(opt.value)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: colors.radius,
                    borderWidth: 1.5,
                    borderColor: gender === opt.value ? c.primary : c.border,
                    backgroundColor: gender === opt.value ? c.primary + "12" : c.card,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 13, fontFamily: gender === opt.value ? "Inter_600SemiBold" : "Inter_400Regular", color: gender === opt.value ? c.primary : c.mutedForeground }}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label="Cancel" onPress={onClose} variant="outline" style={{ flex: 1 }} />
            <Button label="Add" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function CustomerDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    customers, familyMembers,
    getCustomerMeasurements, getCustomerProducts,
    getCustomerInvoices, deleteCustomer, deleteFamilyMember,
  } = useData();
  const customer = customers.find((c) => c.id === id);
  const allMeasurements = customer ? getCustomerMeasurements(customer.id) : [];
  const products = customer ? getCustomerProducts(customer.id) : [];
  const invoices = customer ? getCustomerInvoices(customer.id) : [];
  const members = familyMembers.filter((m) => m.primaryCustomerId === id);
  const [showAddMember, setShowAddMember] = useState(false);
  const [activeProduct, setActiveProduct] = useState<string>("all");

  const measurements = activeProduct === "all"
    ? allMeasurements
    : allMeasurements.filter((m) => m.productType === activeProduct);

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

  function confirmDeleteMember(m: FamilyMember) {
    Alert.alert("Remove Member", `Remove ${m.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteFamilyMember(m.id) },
    ]);
  }

  const initials = customer.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const genderIcon: Record<string, keyof typeof MaterialIcons.glyphMap> = {
    male: "man",
    female: "woman",
    unisex: "people",
  };

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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <MaterialIcons name={genderIcon[customer.gender]} size={14} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" }}>
              {customer.gender.charAt(0).toUpperCase() + customer.gender.slice(1)}
            </Text>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>·</Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" }}>
              {customer.mobile}
            </Text>
          </View>
        </View>

        {/* Quick stats */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
          {[
            { label: "Measurements", value: measurements.length, icon: "straighten" as const },
            { label: "Family Members", value: members.length, icon: "people" as const },
            { label: "Invoices", value: invoices.length, icon: "receipt" as const },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: colors.radius,
                padding: 10,
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: c.primaryForeground }}>
                {s.value}
              </Text>
              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: c.primaryForeground + "BB", textAlign: "center" }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ padding: 20, gap: 20 }}>
        {/* Quick Actions */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => router.push({ pathname: "/measurements/new", params: { customerId: customer.id, customerName: customer.name } })}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: c.card, borderRadius: colors.radius, padding: 14,
              alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.8 : 1,
            })}
          >
            <MaterialIcons name="straighten" size={22} color={c.primary} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.foreground, textAlign: "center" }}>Add Measurement</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: "/invoices/new", params: { customerId: customer.id, customerName: customer.name, customerMobile: customer.mobile } })}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: c.card, borderRadius: colors.radius, padding: 14,
              alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.8 : 1,
            })}
          >
            <MaterialIcons name="receipt" size={22} color="#059669" />
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.foreground, textAlign: "center" }}>Create Invoice</Text>
          </Pressable>
        </View>

        {/* Family Members */}
        <View>
          <SectionHeader
            title="Family Members"
            action={{ label: "Add", onPress: () => setShowAddMember(true) }}
          />
          {members.length === 0 ? (
            <Pressable
              onPress={() => setShowAddMember(true)}
              style={{ alignItems: "center", padding: 20, backgroundColor: c.muted, borderRadius: colors.radius, gap: 8 }}
            >
              <MaterialIcons name="family-restroom" size={28} color={c.mutedForeground} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                No family members yet
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                Tap to add father, mother, children...
              </Text>
            </Pressable>
          ) : (
            <View style={{ gap: 8 }}>
              {members.map((m) => (
                <View
                  key={m.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: c.card,
                    borderRadius: colors.radius,
                    padding: 12,
                    gap: 12,
                    borderWidth: 1,
                    borderColor: c.border,
                  }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary + "18", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.primary }}>
                      {m.name[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>{m.name}</Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                      {m.relation.charAt(0).toUpperCase() + m.relation.slice(1)} · {m.gender}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => router.push({ pathname: "/measurements/new", params: { customerId: customer.id, customerName: m.name } })}
                    style={{ backgroundColor: c.primary + "18", padding: 8, borderRadius: 8 }}
                  >
                    <MaterialIcons name="straighten" size={16} color={c.primary} />
                  </Pressable>
                  <Pressable onPress={() => confirmDeleteMember(m)} style={{ backgroundColor: "#FEE2E2", padding: 8, borderRadius: 8 }}>
                    <MaterialIcons name="close" size={16} color={c.destructive} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Measurements */}
        <View>
          <SectionHeader
            title="Measurements"
            action={{ label: "Add", onPress: () => router.push({ pathname: "/measurements/new", params: { customerId: customer.id, customerName: customer.name } }) }}
          />

          {/* Product-type filter chips */}
          {products.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 10, gap: 6 }}
            >
              <Pressable
                onPress={() => setActiveProduct("all")}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 18,
                  backgroundColor: activeProduct === "all" ? c.primary : c.muted,
                  borderWidth: 1,
                  borderColor: activeProduct === "all" ? c.primary : c.border,
                }}
              >
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: activeProduct === "all" ? "#FFFFFF" : c.mutedForeground }}>
                  All · {allMeasurements.length}
                </Text>
              </Pressable>
              {products.map((p) => (
                <Pressable
                  key={p.productType}
                  onPress={() => setActiveProduct(p.productType)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 18,
                    backgroundColor: activeProduct === p.productType ? c.primary : c.muted,
                    borderWidth: 1,
                    borderColor: activeProduct === p.productType ? c.primary : c.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: activeProduct === p.productType ? "#FFFFFF" : c.mutedForeground }}>
                    {p.productType} · {p.count}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {allMeasurements.length === 0 ? (
            <View style={{ alignItems: "center", padding: 24, backgroundColor: c.muted, borderRadius: colors.radius, gap: 8 }}>
              <MaterialIcons name="straighten" size={28} color={c.mutedForeground} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>No measurements yet</Text>
            </View>
          ) : measurements.length === 0 ? (
            <View style={{ alignItems: "center", padding: 16, backgroundColor: c.muted, borderRadius: colors.radius, gap: 6 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                No measurements for {activeProduct}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {measurements.map((m) => (
                <View key={m.id} style={{ gap: 6 }}>
                  <MeasurementItem measurement={m} onPress={() => router.push(`/measurements/${m.id}` as any)} />
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/invoices/new",
                        params: {
                          customerId: customer.id,
                          customerName: customer.name,
                          customerMobile: customer.mobile,
                          measurementId: m.id,
                        },
                      })
                    }
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      backgroundColor: "#059669" + (pressed ? "22" : "12"),
                      borderRadius: colors.radius,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: "#059669" + "30",
                    })}
                  >
                    <MaterialIcons name="receipt" size={14} color="#059669" />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#059669" }}>
                      Create Invoice from this Measurement
                    </Text>
                  </Pressable>
                </View>
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
              {invoices.map((i) => (
                <InvoiceItem key={i.id} invoice={i} onPress={() => router.push(`/invoices/${i.id}` as any)} />
              ))}
            </View>
          )}
        </View>
      </View>

      <AddFamilyMemberModal
        visible={showAddMember}
        customerId={customer.id}
        onClose={() => setShowAddMember(false)}
      />
    </ScrollView>
  );
}
