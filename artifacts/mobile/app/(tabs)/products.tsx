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
import colors from "@/constants/colors";
import { ProductType } from "@/types";

function ProductTypeForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: { name: string; amount: string };
  onSave: (name: string, amount: number) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const c = useColors();
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({});

  function handleSave() {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Product name is required";
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt < 0) e.amount = "Enter a valid amount";
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onSave(name.trim(), amt);
  }

  return (
    <View style={{ gap: 14 }}>
      <Input
        label="Product Type Name *"
        placeholder="e.g. Shirt, Pant, Kurta"
        value={name}
        onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: undefined })); }}
        icon="local-offer"
        error={errors.name}
        autoFocus
      />
      <Input
        label="Price (₹) *"
        placeholder="e.g. 500"
        value={amount}
        onChangeText={(v) => { setAmount(v.replace(/[^0-9.]/g, "")); setErrors((e) => ({ ...e, amount: undefined })); }}
        icon="currency-rupee"
        keyboardType="decimal-pad"
        error={errors.amount}
      />
      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <Button label="Cancel" onPress={onCancel} variant="outline" style={{ flex: 1 }} />
        <Button label="Save" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export default function ProductsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { productTypes, addProductType, updateProductType, deleteProductType } = useData();

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductType | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = productTypes.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const topPad = Platform.OS === "web" ? 67 : 0;

  async function handleAdd(name: string, amount: number) {
    setLoading(true);
    await addProductType({ name, amount });
    setLoading(false);
    setShowModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleEdit(name: string, amount: number) {
    if (!editTarget) return;
    setLoading(true);
    await updateProductType(editTarget.id, { name, amount });
    setLoading(false);
    setEditTarget(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function confirmDelete(pt: ProductType) {
    Alert.alert("Delete Product Type", `Delete "${pt.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
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
              Product Types
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
              {productTypes.length} product{productTypes.length !== 1 ? "s" : ""}
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
            style={{
              flex: 1,
              fontSize: 14,
              fontFamily: "Inter_400Regular",
              color: "#FFFFFF",
              paddingVertical: 10,
            }}
            placeholder="Search product types..."
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
          title="No product types"
          subtitle="Add product types to use them in measurements and invoices."
          action={{ label: "Add Product Type", onPress: () => setShowModal(true) }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 110 }}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((pt) => (
            <View
              key={pt.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: c.card,
                borderRadius: colors.radius,
                padding: 14,
                borderWidth: 1,
                borderColor: c.border,
                gap: 12,
              }}
            >
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
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.primary, marginTop: 2 }}>
                  {formatCurrency(pt.amount)}
                </Text>
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
          ))}
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
            }}
          >
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
              Add Product Type
            </Text>
            <ProductTypeForm
              onSave={handleAdd}
              onCancel={() => setShowModal(false)}
              loading={loading}
            />
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
            }}
          >
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
              Edit Product Type
            </Text>
            {editTarget && (
              <ProductTypeForm
                initial={{ name: editTarget.name, amount: String(editTarget.amount) }}
                onSave={handleEdit}
                onCancel={() => setEditTarget(null)}
                loading={loading}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
