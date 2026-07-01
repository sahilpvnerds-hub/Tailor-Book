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
import { useWebModalBlur } from "@/hooks/useWebModalBlur";
import { useData } from "@/context/DataContext";
import { EmptyState, SectionHeader } from "@/components/ui";
import { formatDate } from "@/utils/storage";
import colors from "@/constants/colors";
import { FamilyMember, Relation } from "@/types";
import { Button, Input } from "@/components/ui";
import { validateRequired, runValidation } from "@/utils/validation";

const RELATION_OPTIONS: Relation[] = ["father", "mother", "son", "daughter", "wife", "husband", "other"];

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  useWebModalBlur(visible);

  async function handleSave() {
    const errs = runValidation([
      { field: "name", error: validateRequired(name, "Name") },
    ]);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    await addFamilyMember({ primaryCustomerId: customerId, name: name.trim(), relation, gender: "unisex" });
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setName(""); setRelation("son"); setErrors({});
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
            onChangeText={(v) => { setName(v.slice(0, 80)); setErrors((e) => ({ ...e, name: undefined as any })); }}
            icon="person"
            error={errors.name}
            autoFocus
            maxLength={80}
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
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label="Cancel" onPress={onClose} variant="outline" style={{ flex: 1 }} />
            <Button label="Add" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Person Measurement Section ─────────────────────────────────────────────
function PersonMeasurementSection({
  personName,
  relation,
  personIcon,
  familyMemberId,
  measurements,
  onAddMeasurement,
  customer,
  c,
}: {
  personName: string;
  relation: string;
  personIcon: string;
  /** Family member id (undefined for the primary customer / "Self"). */
  familyMemberId?: string;
  measurements: any[];
  onAddMeasurement: () => void;
  customer: any;
  c: any;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: c.border,
        overflow: "hidden",
        marginBottom: 10,
      }}
    >
      {/* Section header — person name + relation */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 14,
          backgroundColor: c.primary + "12",
          gap: 10,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: c.primary + "22",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name={personIcon as any} size={18} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.foreground }}>
            {personName}
          </Text>
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
            {relation} · {measurements.length} measurement{measurements.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <Pressable
          onPress={onAddMeasurement}
          style={{
            backgroundColor: c.primary,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <MaterialIcons name="add" size={14} color="#FFFFFF" />
          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" }}>Add</Text>
        </Pressable>
        <MaterialIcons
          name={expanded ? "expand-less" : "expand-more"}
          size={20}
          color={c.mutedForeground}
        />
      </Pressable>

      {/* Measurement rows */}
      {expanded && (
        measurements.length === 0 ? (
          <View style={{ padding: 16, alignItems: "center", gap: 6 }}>
            <MaterialIcons name="straighten" size={22} color={c.mutedForeground} />
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
              No measurements yet
            </Text>
          </View>
        ) : (
          measurements.map((m: any, idx: number) => (
            <Pressable
              key={m.id}
              onPress={() =>
                router.push({
                  pathname: "/measurements/new",
                  params: {
                    customerId: customer.id,
                    customerName: personName,
                    familyMemberId: familyMemberId ?? "self",
                  },
                })
              }
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: pressed ? c.muted : c.card,
                borderTopWidth: 1,
                borderTopColor: c.border,
                gap: 12,
              })}
            >
              {/* Product color dot */}
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: c.primary,
                  marginTop: 2,
                }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                    {m.productType}
                  </Text>
                  {m.featureLabel ? (
                    <View
                      style={{
                        backgroundColor: c.primary + "18",
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: c.primary }}>
                        {m.featureLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <MaterialIcons name="event" size={11} color={c.mutedForeground} />
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                      {formatDate(m.date ?? m.measurementDate ?? m.createdAt)}
                    </Text>
                  </View>
                  {(m.deliveryDate) ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <MaterialIcons name="local-shipping" size={11} color="#059669" />
                      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#059669" }}>
                        Delivery: {formatDate(m.deliveryDate)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={c.mutedForeground} />
            </Pressable>
          ))
        )
      )}
    </View>
  );
}

export default function CustomerDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    customers, familyMembers, measurements: allMeasurementsCtx,
    orders, deleteCustomer, deleteFamilyMember,
  } = useData();
  const customer = customers.find((c) => c.id === id);
  const customerOrders = customer ? orders.filter((o) => o.customerId === customer.id) : [];
  const members = familyMembers.filter((m) => m.primaryCustomerId === id);
  const [showAddMember, setShowAddMember] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : 0;

  if (!customer) {
    return (
      <EmptyState icon="person" title="Customer not found" subtitle="This customer may have been deleted" />
    );
  }

  // Measurements for primary customer (no family member)
  const selfMeasurements = allMeasurementsCtx.filter(
    (m) => m.customerId === customer.id && !m.familyMemberId
  ).sort((a, b) => (b.date ?? b.measurementDate ?? b.createdAt).localeCompare(a.date ?? a.measurementDate ?? a.createdAt));

  // Measurements for each family member
  const memberMeasurementsMap = members.reduce<Record<string, typeof allMeasurementsCtx>>((acc, member) => {
    acc[member.id] = allMeasurementsCtx
      .filter((m) => m.customerId === customer.id && m.familyMemberId === member.id)
      .sort((a, b) => (b.date ?? b.measurementDate ?? b.createdAt).localeCompare(a.date ?? a.measurementDate ?? a.createdAt));
    return acc;
  }, {});

  const totalMeasurements = selfMeasurements.length + members.reduce((sum, m) => sum + (memberMeasurementsMap[m.id]?.length ?? 0), 0);

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

  const relationIcon: Record<string, string> = {
    father: "man",
    mother: "woman",
    son: "boy",
    daughter: "girl",
    wife: "woman",
    husband: "man",
    brother: "man",
    sister: "woman",
    other: "person",
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
            <MaterialIcons name="phone" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" }}>
              {customer.mobile}
            </Text>
          </View>
        </View>

        {/* Quick stats */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
          {[
            { label: "Measurements", value: totalMeasurements, icon: "straighten" as const },
            { label: "Family Members", value: members.length, icon: "people" as const },
            { label: "Orders", value: customerOrders.length, icon: "shopping-bag" as const },
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
            onPress={() => router.push({ pathname: "/orders/new", params: { customerId: customer.id, customerName: customer.name, customerMobile: customer.mobile } })}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: c.card, borderRadius: colors.radius, padding: 14,
              alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.8 : 1,
            })}
          >
            <MaterialIcons name="shopping-bag" size={22} color={c.primary} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.foreground, textAlign: "center" }}>Create Order</Text>
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
                      {m.relation.charAt(0).toUpperCase() + m.relation.slice(1)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => router.push({ pathname: "/measurements/new", params: { customerId: customer.id, customerName: m.name, familyMemberId: m.id } })}
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

        {/* ── Measurements grouped by person ── */}
        <View>
          <SectionHeader
            title="Measurements"
            action={{ label: "Add", onPress: () => router.push({ pathname: "/measurements/new", params: { customerId: customer.id, customerName: customer.name } }) }}
          />

          {/* Primary customer section */}
          <PersonMeasurementSection
            personName={customer.name}
            relation="Self"
            personIcon="person"
            measurements={selfMeasurements}
            onAddMeasurement={() =>
              router.push({ pathname: "/measurements/new", params: { customerId: customer.id, customerName: customer.name, familyMemberId: "self" } })
            }
            customer={customer}
            c={c}
          />

          {/* Family member sections */}
          {members.map((m) => (
            <PersonMeasurementSection
              key={m.id}
              personName={m.name}
              relation={m.relation.charAt(0).toUpperCase() + m.relation.slice(1)}
              personIcon={relationIcon[m.relation] ?? "person"}
              familyMemberId={m.id}
              measurements={memberMeasurementsMap[m.id] ?? []}
              onAddMeasurement={() =>
                router.push({ pathname: "/measurements/new", params: { customerId: customer.id, customerName: m.name, familyMemberId: m.id } })
              }
              customer={customer}
              c={c}
            />
          ))}
        </View>

        {/* Orders and Invoices lists are intentionally hidden on the
            customer detail page per the latest spec — they are
            available in the global Orders / Invoices tabs. */}
      </View>

      <AddFamilyMemberModal
        visible={showAddMember}
        customerId={customer.id}
        onClose={() => setShowAddMember(false)}
      />
    </ScrollView>
  );
}
