import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { formatCurrency } from "@/utils/storage";
import { Button, EmptyState, Input } from "@/components/ui";
import { useTranslation } from "@/utils/i18n";
import colors from "@/constants/colors";
import { MeasurementUnit, ProductFeature, ProductType } from "@/types";
import {
  FEATURE_SUGGESTIONS,
  defaultFeaturesFor,
  getProductSuggestions,
  type FeatureGender,
} from "@/constants/products";

// Re-export for any callers that previously imported the helper from
// this module (kept here so the UI file's local getSuggestions alias
// below remains a drop-in for the rest of the component).
type Suggestion = { label: string; gender: FeatureGender };
const getSuggestions = (productName: string, gender: FeatureGender | "all"): Suggestion[] =>
  getProductSuggestions(productName, gender);

const GENDER_TARGET_OPTIONS: { value: FeatureGender | "all"; labelKey: string; icon: string }[] = [
  { value: "all", labelKey: "products.features.filterAll", icon: "people" },
  { value: "male", labelKey: "products.features.filterMale", icon: "man" },
  { value: "female", labelKey: "products.features.filterFemale", icon: "woman" },
];

// ─── ProductTypeForm ─────────────────────────────────────────────────────────
function ProductTypeForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: { name: string; amount: string; unit: MeasurementUnit; features?: ProductFeature[] };
  onSave: (name: string, amount: number, unit: MeasurementUnit, features: ProductFeature[]) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const c = useColors();
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [unit, setUnit] = useState<MeasurementUnit>(initial?.unit ?? "inches");
  const [genderTarget, setGenderTarget] = useState<FeatureGender | "all">("all");
  // Editing keeps the saved features; creating seeds ALL suggested
  // features so the tailor starts from "everything ticked".
  const [features, setFeatures] = useState<ProductFeature[]>(
    initial?.features ?? getSuggestions(initial?.name ?? "", "all").map((s) => ({ label: s.label, gender: s.gender })),
  );
  const [customFeatureText, setCustomFeatureText] = useState("");
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({});

  const suggestions = getSuggestions(name, genderTarget);

  // If the tailor changes the gender target on a NEW (not yet saved)
  // product, re-seed so the chips reflect the active scope.
  function changeGenderTarget(next: FeatureGender | "all") {
    setGenderTarget(next);
    if (!initial) {
      // New product: pre-select every suggested feature for the chosen
      // gender target. Anything the tailor has already added stays
      // even if it isn't part of the current suggestion list.
      const seeded = getSuggestions(name, next).map((s) => ({ label: s.label, gender: s.gender }));
      setFeatures((prev) => {
        const labels = new Set(seeded.map((s) => s.label));
        const customOnly = prev.filter((p) => !labels.has(p.label) && !getSuggestions(name, "all").some((s) => s.label === p.label));
        return [...seeded, ...customOnly];
      });
    }
  }

  function handleSave() {
    const e: typeof errors = {};
    if (!name.trim()) e.name = t("products.errors.nameRequired");
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt < 0) e.amount = t("products.errors.amountRequired");
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onSave(name.trim(), amt, unit, features);
  }

  function toggleFeature(label: string, gender: FeatureGender) {
    setFeatures((prev) => {
      const exists = prev.find((f) => f.label === label);
      if (exists) return prev.filter((f) => f.label !== label);
      return [...prev, { label, gender }];
    });
  }

  function addCustomFeature() {
    const label = customFeatureText.trim();
    if (!label) return;
    if (features.find((f) => f.label.toLowerCase() === label.toLowerCase())) {
      setCustomFeatureText("");
      return;
    }
    setFeatures((prev) => [...prev, { label, gender: genderTarget === "all" ? "both" : genderTarget }]);
    setCustomFeatureText("");
  }

  function removeFeature(label: string) {
    setFeatures((prev) => prev.filter((f) => f.label !== label));
  }

  const isFeatureSelected = (label: string) => features.some((f) => f.label === label);

  return (
    <View style={{ gap: 14 }}>
      <Input
        label={t("products.name") + " *"}
        placeholder={t("products.namePlaceholder")}
        value={name}
        onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: undefined })); }}
        icon="local-offer"
        error={errors.name}
        autoFocus
      />
      <Input
        label={t("products.amount") + " *"}
        placeholder={t("products.amountPlaceholder")}
        value={amount}
        onChangeText={(v) => { setAmount(v.replace(/[^0-9.]/g, "")); setErrors((e) => ({ ...e, amount: undefined })); }}
        icon="currency-rupee"
        keyboardType="decimal-pad"
        error={errors.amount}
      />

      {/* Unit picker */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {t("products.unit")}
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {(["inches", "cm"] as MeasurementUnit[]).map((u) => {
            const selected = unit === u;
            return (
              <Pressable
                key={u}
                onPress={() => setUnit(u)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: colors.radius,
                  borderWidth: 1.5,
                  borderColor: selected ? c.primary : c.border,
                  backgroundColor: selected ? c.primary + "12" : c.card,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, fontFamily: selected ? "Inter_600SemiBold" : "Inter_500Medium", color: selected ? c.primary : c.mutedForeground }}>
                  {t(u === "inches" ? "products.unitInches" : "products.unitCm")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Features Section ── */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {t("products.features.title")}
          </Text>
          {features.length > 0 && (
            <View style={{ backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
                {t("products.features.selected", { count: features.length })}
              </Text>
            </View>
          )}
        </View>

        {/* Gender target toggle */}
        <View style={{ flexDirection: "row", gap: 6 }}>
          {GENDER_TARGET_OPTIONS.map((opt) => {
            const sel = genderTarget === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => changeGenderTarget(opt.value)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  paddingVertical: 8,
                  borderRadius: colors.radius,
                  borderWidth: 1.5,
                  borderColor: sel ? c.primary : c.border,
                  backgroundColor: sel ? c.primary + "14" : c.muted,
                }}
              >
                <MaterialIcons name={opt.icon as any} size={14} color={sel ? c.primary : c.mutedForeground} />
                <Text style={{ fontSize: 12, fontFamily: sel ? "Inter_700Bold" : "Inter_400Regular", color: sel ? c.primary : c.mutedForeground }}>
                  {t(opt.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Suggestion chips */}
        {suggestions.length > 0 && (
          <View>
            <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.mutedForeground, marginBottom: 6 }}>
              {t("products.features.suggestions")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {suggestions.map((s) => {
                const sel = isFeatureSelected(s.label);
                return (
                  <Pressable
                    key={s.label}
                    onPress={() => toggleFeature(s.label, s.gender)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: sel ? c.primary : c.border,
                      backgroundColor: sel ? c.primary : c.card,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {sel && <MaterialIcons name="check" size={12} color="#FFFFFF" />}
                    <Text style={{ fontSize: 12, fontFamily: sel ? "Inter_600SemiBold" : "Inter_400Regular", color: sel ? "#FFFFFF" : c.foreground }}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Custom feature input */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: colors.radius,
            backgroundColor: c.input,
            overflow: "hidden",
          }}
        >
          <TextInput
            style={{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: c.foreground, paddingHorizontal: 12, paddingVertical: 10 }}
            placeholder={t("products.features.customPlaceholder")}
            placeholderTextColor={c.mutedForeground}
            value={customFeatureText}
            onChangeText={setCustomFeatureText}
            onSubmitEditing={addCustomFeature}
            returnKeyType="done"
          />
          <Pressable
            onPress={addCustomFeature}
            style={{ backgroundColor: c.primary, padding: 10, alignItems: "center", justifyContent: "center" }}
            accessibilityLabel={t("products.features.addCustom")}
          >
            <MaterialIcons name="add" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Selected features list */}
        {features.length > 0 && (
          <View>
            <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.mutedForeground, marginBottom: 6 }}>
              {t("products.features.selectedList")}
            </Text>
            <View style={{ gap: 6 }}>
              {features.map((f) => (
                <View
                  key={f.label}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: c.primary + "0D",
                    borderRadius: colors.radius,
                    borderWidth: 1,
                    borderColor: c.primary + "30",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    gap: 8,
                  }}
                >
                  <MaterialIcons name="label" size={14} color={c.primary} />
                  <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: c.foreground }}>
                    {f.label}
                  </Text>
                  {f.gender && f.gender !== "both" && (
                    <View style={{ backgroundColor: c.primary + "18", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: c.primary }}>
                        {t(
                          f.gender === "male"
                            ? "products.features.male"
                            : f.gender === "female"
                            ? "products.features.female"
                            : "products.features.both",
                        )}
                      </Text>
                    </View>
                  )}
                  <Pressable onPress={() => removeFeature(f.label)} hitSlop={8}>
                    <MaterialIcons name="close" size={16} color={c.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <Button label={t("common.cancel")} onPress={onCancel} variant="outline" style={{ flex: 1 }} />
        <Button label={t("common.save")} onPress={handleSave} loading={loading} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

// ─── Products Screen ─────────────────────────────────────────────────────────
export default function ProductsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { productTypes, addProductType, updateProductType, deleteProductType } = useData();

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductType | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = productTypes.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const topPad = Platform.OS === "web" ? 67 : 0;

  async function handleAdd(name: string, amount: number, unit: MeasurementUnit, features: ProductFeature[]) {
    setLoading(true);
    await addProductType({ name, amount, unit, features } as any);
    setLoading(false);
    setShowModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleEdit(name: string, amount: number, unit: MeasurementUnit, features: ProductFeature[]) {
    if (!editTarget) return;
    setLoading(true);
    await updateProductType(editTarget.id, { name, amount, unit, features } as any);
    setLoading(false);
    setEditTarget(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function confirmDelete(pt: ProductType) {
    Alert.alert(t("products.deleteTitle"), t("products.deleteConfirm", { name: pt.name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await deleteProductType(pt.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + topPad + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: c.primary,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
              {t("products.title")}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
              {t("products.count", { count: productTypes.length })}
            </Text>
          </View>
          <Pressable
            onPress={() => setShowModal(true)}
            style={({ pressed }) => ({
              backgroundColor: "rgba(255,255,255,0.2)",
              borderRadius: 12,
              padding: 10,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <MaterialIcons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Search */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.15)",
            borderRadius: 12,
            paddingHorizontal: 12,
            gap: 8,
          }}
        >
          <MaterialIcons name="search" size={18} color="rgba(255,255,255,0.8)" />
          <TextInput
            style={{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#FFFFFF", paddingVertical: 10 }}
            placeholder={t("products.searchPlaceholder")}
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <MaterialIcons name="close" size={16} color="rgba(255,255,255,0.8)" />
            </Pressable>
          )}
        </View>
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="local-offer"
          title={t("products.empty")}
          subtitle={t("products.emptyHint")}
          action={{ label: t("products.add"), onPress: () => setShowModal(true) }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 110 }}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((pt) => {
            const featureCount = pt.features?.length ?? 0;
            return (
              <View
                key={pt.id}
                style={{
                  backgroundColor: c.card,
                  borderRadius: colors.radius,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: c.border,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 13,
                      backgroundColor: c.primary + "18",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialIcons name="local-offer" size={20} color={c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                      {pt.name}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2, gap: 8 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.primary }}>
                        {formatCurrency(pt.amount)}
                      </Text>
                      {pt.unit && (
                        <View style={{ backgroundColor: c.muted, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: c.mutedForeground }}>
                            {t(pt.unit === "inches" ? "products.unitInches" : "products.unitCm")}
                          </Text>
                        </View>
                      )}
                      {featureCount > 0 && (
                        <View style={{ backgroundColor: c.primary + "14", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 3 }}>
                          <MaterialIcons name="label" size={10} color={c.primary} />
                          <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: c.primary }}>
                            {featureCount} feature{featureCount > 1 ? "s" : ""}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setEditTarget(pt)}
                    style={{ padding: 8, backgroundColor: c.muted, borderRadius: 8, marginRight: 6 }}
                  >
                    <MaterialIcons name="edit" size={16} color={c.foreground} />
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDelete(pt)}
                    style={{ padding: 8, backgroundColor: "#FEE2E2", borderRadius: 8 }}
                  >
                    <MaterialIcons name="delete" size={16} color={c.destructive} />
                  </Pressable>
                </View>

                {/* Feature chips preview */}
                {featureCount > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: c.border }}>
                    {(pt.features ?? []).map((f) => (
                      <View
                        key={f.label}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          backgroundColor: c.muted,
                          borderRadius: 14,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderWidth: 1,
                          borderColor: c.border,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: c.foreground }}>
                          {f.label}
                        </Text>
                        {f.gender && f.gender !== "both" && (
                          <MaterialIcons
                            name={f.gender === "male" ? "man" : "woman"}
                            size={11}
                            color={c.mutedForeground}
                          />
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add Modal */}
      <Modal visible={showModal} transparent animationType="slide">
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
              gap: 16,
              maxHeight: "92%",
            }}
          >
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
              {t("products.addTitle")}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <ProductTypeForm
                onSave={handleAdd}
                onCancel={() => setShowModal(false)}
                loading={loading}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={!!editTarget} transparent animationType="slide">
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
              gap: 16,
              maxHeight: "92%",
            }}
          >
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
              {t("products.editTitle")}
            </Text>
            {editTarget && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <ProductTypeForm
                  initial={{
                    name: editTarget.name,
                    amount: String(editTarget.amount),
                    unit: editTarget.unit ?? "inches",
                    features: editTarget.features ?? [],
                  }}
                  onSave={handleEdit}
                  onCancel={() => setEditTarget(null)}
                  loading={loading}
                />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
