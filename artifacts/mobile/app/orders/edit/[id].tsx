import React, { useState, useMemo, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { Button, Card, Input } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { OrderItem, Relation, Measurement, ProductType, Gender, CustomMeasurementField, Order } from "@/types";
import { formatCurrency, generateId } from "@/utils/storage";
import { getFieldsForProduct, MEASUREMENT_FIELDS } from "@/constants/products";
import { MeasurementKey } from "@/constants/measurementFields";
import { base64ToDataUri, pickMeasurementPhotos } from "@/utils/photos";
import colors from "@/constants/colors";

const CUSTOMER_INLINE_LIMIT = 20;

const MEASUREMENT_KEYS = [
  "chest", "shoulder", "neck", "sleeve", "waist", "length",
  "hip", "thigh", "pantLength", "bottomWidth", "armhole", "wrist"
];

function titleCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function latestMeasurementKey(measurement: Measurement) {
  return measurement.measurementDate ?? measurement.date ?? measurement.createdAt ?? "";
}

function featureMatchesGender(featureGender: "male" | "female" | "both" | undefined, assigneeGender?: Gender) {
  if (!featureGender || featureGender === "both") return true;
  if (!assigneeGender || assigneeGender === "unisex") return true;
  return featureGender === assigneeGender;
}

function customFieldMatchesScope(
  field: CustomMeasurementField,
  customerId: string,
  familyMemberId: string | null,
  productTypeId: string,
  productType: string,
) {
  const hasPersonScope = !!field.customerId || field.familyMemberId !== undefined;
  const hasProductScope = !!field.productTypeId || !!field.productType;

  if (!hasPersonScope && !hasProductScope) return true;

  if (field.customerId && field.customerId !== customerId) return false;
  if (field.customerId && (field.familyMemberId ?? null) !== (familyMemberId ?? null)) return false;
  if (!field.customerId && field.familyMemberId && field.familyMemberId !== familyMemberId) return false;

  if (field.productTypeId && field.productTypeId !== productTypeId) return false;
  if (!field.productTypeId && field.productType) {
    const fProdType = field.productType || "";
    const pType = productType || "";
    return fProdType.toLowerCase() === pType.toLowerCase();
  }

  return true;
}

interface LocalItem {
  id: string; // React key
  productTypeId: string;
  productType: string;
  quantity: number;
  price: number;
  familyMemberId: string | null; // null = self
  selectedFeatures: string[];

  // Measurement details
  measurementId: string | null;
  measurementValues: Record<string, string>;
  customValues: Record<string, string>;
  photos: string[];
  notes: string;

  expanded: boolean;
}

export default function EditOrderScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    customers,
    productTypes,
    measurements,
    familyMembers,
    updateOrder,
    addMeasurement,
    updateMeasurement,
    addFamilyMember,
    addCustomField,
    deleteCustomField,
    customFields,
    updateProductType,
  } = useData();

  const [loading, setLoading] = useState(false);
  const [initialOrder, setInitialOrder] = useState<Order | null>(null);

  // --- Form State ---
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");

  // Order-level product reference photos
  const [orderPhotos, setOrderPhotos] = useState<string[]>([]);

  // Discount controls
  const [discountType, setDiscountType] = useState<"none" | "fixed" | "percent">("none");
  const [discountValue, setDiscountValue] = useState("");

  const [localItems, setLocalItems] = useState<LocalItem[]>([]);

  // Modals State
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [showMeasModal, setShowMeasModal] = useState(false);
  const [measDraftValues, setMeasDraftValues] = useState<Record<string, string>>({});
  const [measDraftCustom, setMeasDraftCustom] = useState<Record<string, string>>({});
  const [measDraftPhotos, setMeasDraftPhotos] = useState<string[]>([]);
  const [measDraftNotes, setMeasDraftNotes] = useState("");
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  const [showAddCustomFieldModal, setShowAddCustomFieldModal] = useState(false);
  const [newCustomFieldName, setNewCustomFieldName] = useState("");
  const [savingCustomField, setSavingCustomField] = useState(false);

  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [familyDraftName, setFamilyDraftName] = useState("");
  const [familyDraftRelation, setFamilyDraftRelation] = useState<Relation>("other");
  const [savingFamily, setSavingFamily] = useState(false);
  const [familyAssignTargetIdx, setFamilyAssignTargetIdx] = useState<number | null>(null);

  const [showCustomFeatureModal, setShowCustomFeatureModal] = useState(false);
  const [customFeatureInput, setCustomFeatureInput] = useState("");
  const [customFeatureTargetIdx, setCustomFeatureTargetIdx] = useState<number | null>(null);
  const [savingCustomFeature, setSavingCustomFeature] = useState(false);
  const [itemCustomFeatureText, setItemCustomFeatureText] = useState<Record<string, string>>({});

  // --- Load Order Data ---
  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const allOrders = await import("@/utils/storage").then(m => m.getStorageItem<Order[]>("@tailorbook/orders"));
      const orderData = allOrders?.find((o: Order) => o.id === id);

      if (orderData) {
        setInitialOrder({ ...orderData });
        setSelectedCustomerId(orderData.customerId);
        setCustomerSearch(orderData.customerName);
        setNotes(orderData.notes ?? "");
        setDeliveryDate(orderData.deliveryDate ?? "");

        // Load order-level photos
        setOrderPhotos(orderData.photos ?? []);

        // Calculate advance amount from balance
        const totalAmount = Number(orderData.totalAmount) || 0;
        const balanceDue = Number(orderData.balanceDue) || 0;
        const advanceFromOrder = totalAmount - balanceDue;
        setAdvanceAmount(advanceFromOrder > 0 ? String(advanceFromOrder) : "");

        // Convert order items to local format
        const items = orderData.items || [];
        const localItemsData: LocalItem[] = items.map(item => {
          let mv = item.measurementValues;
          if (typeof mv === "string") {
            try {
              mv = JSON.parse(mv);
            } catch {
              mv = null;
            }
          }
          const measVals: Record<string, string> = {};
          if (mv) {
            Object.entries(mv).forEach(([k, v]) => {
              measVals[k] = String(v).replace(/"/g, "");
            });
          }

          return {
            id: item.id || generateId(),
            productTypeId: item.productTypeId || "",
            productType: item.productType,
            quantity: item.quantity,
            price: Number(item.price) || 0,
            familyMemberId: item.familyMemberId || null,
            selectedFeatures: item.featureLabel ? item.featureLabel.split(", ").filter(Boolean) : [],
            measurementId: item.measurementId || null,
            measurementValues: measVals,
            customValues: {},
            photos: [],
            notes: "",
            expanded: false,
          };
        });

        setLocalItems(localItemsData);
      } else {
        Alert.alert("Error", "Order not found");
        router.back();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load order");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // --- Helpers ---
  const selectedCustomer = customers.find((cu) => cu.id === selectedCustomerId);

  const customerFamilyMembers = useMemo(() => {
    return familyMembers.filter((fm) => fm.primaryCustomerId === selectedCustomerId);
  }, [familyMembers, selectedCustomerId]);

  function findLatestMeasurement(
    customerId: string,
    familyMemberId: string | null,
    productTypeId: string,
    productTypeName: string,
  ): Measurement | null {
    if (!customerId) return null;
    return measurements
      .filter((m) => {
        const samePerson = familyMemberId === null ? !m.familyMemberId : m.familyMemberId === familyMemberId;
        const mProdType = m.productType || "";
        const searchProdTypeName = productTypeName || "";
        const sameProduct =
          (productTypeId && m.productTypeId === productTypeId) ||
          (mProdType && searchProdTypeName && mProdType.toLowerCase() === searchProdTypeName.toLowerCase());
        return m.customerId === customerId && samePerson && sameProduct;
      })
      .sort((a, b) => {
        const keyA = latestMeasurementKey(a) || "";
        const keyB = latestMeasurementKey(b) || "";
        const dateCompare = keyB.localeCompare(keyA);
        if (dateCompare !== 0) return dateCompare;
        const createdA = a.createdAt || "";
        const createdB = b.createdAt || "";
        return createdB.localeCompare(createdA);
      })[0] || null;
  }

  function getCustomFieldsForScope(
    customerId: string,
    familyMemberId: string | null,
    productTypeId: string,
    productTypeName: string,
  ) {
    return customFields.filter((field) =>
      customFieldMatchesScope(field, customerId, familyMemberId, productTypeId, productTypeName)
    );
  }

  function getCustomFieldsForItem(item: LocalItem) {
    return getCustomFieldsForScope(selectedCustomerId, item.familyMemberId, item.productTypeId, item.productType);
  }

  function getMeasurementState(customerId: string, familyMemberId: string | null, productTypeId: string, productTypeName: string) {
    const latest = findLatestMeasurement(customerId, familyMemberId, productTypeId, productTypeName);
    if (!latest) {
      return {
        measurementId: null,
        measurementValues: {},
        customValues: {},
        photos: [],
        notes: ""
      };
    }

    const mVals: Record<string, string> = {};
    MEASUREMENT_KEYS.forEach((k) => {
      const v = (latest as any)[k];
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) mVals[k] = String(n);
    });

    const cVals: Record<string, string> = {};
    const scopedFields = getCustomFieldsForScope(customerId, familyMemberId, productTypeId, productTypeName);
    const customList = Array.isArray(latest.customMeasurements) ? latest.customMeasurements : [];
    customList.forEach((cm) => {
      if (cm && cm.label) {
        const match = scopedFields.find((cf) => cf && cf.fieldName && cf.fieldName.toLowerCase() === cm.label.toLowerCase());
        if (match) cVals[match.id] = String(cm.value);
      }
    });

    return {
      measurementId: latest.id,
      measurementValues: mVals,
      customValues: cVals,
      photos: latest.photos ?? [],
      notes: latest.notes ?? ""
    };
  }

  function getProductForItem(item: LocalItem): ProductType | undefined {
    return productTypes.find((p) => p.id === item.productTypeId)
      ?? productTypes.find((p) => {
        const pName = p.name || "";
        const itemProdType = item.productType || "";
        return pName.toLowerCase() === itemProdType.toLowerCase();
      });
  }

  function getAssigneeGender(familyMemberId: string | null): Gender | undefined {
    return familyMemberId
      ? familyMembers.find((fm) => fm.id === familyMemberId)?.gender
      : selectedCustomer?.gender;
  }

  function getMatchingFeatures(product: ProductType | undefined, familyMemberId: string | null) {
    const assigneeGender = getAssigneeGender(familyMemberId);
    const seen = new Set<string>();
    return (product?.features ?? []).filter((feature) => {
      const key = (feature.label || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return featureMatchesGender(feature.gender, assigneeGender);
    });
  }

  function getValidSelectedFeatures(item: LocalItem) {
    const matchingLabels = new Set(
      getMatchingFeatures(getProductForItem(item), item.familyMemberId).map((feature) => feature.label)
    );
    return item.selectedFeatures.filter((label) => matchingLabels.has(label));
  }

  // --- Change Detection ---
  function detectChanges(): boolean {
    if (!initialOrder) return true;

    // Check basic fields
    if (initialOrder.customerId !== selectedCustomerId) return true;
    if (initialOrder.deliveryDate !== (deliveryDate || null)) return true;
    if (initialOrder.notes !== (notes.trim() || null)) return true;

    // Check order-level photos
    const initialPhotos = (initialOrder.photos ?? []) as string[];
    if (JSON.stringify(initialPhotos) !== JSON.stringify(orderPhotos)) return true;

    // Check items
    const initialItems = initialOrder.items || [];
    if (initialItems.length !== localItems.length) return true;

    // Compare item properties
    for (let i = 0; i < initialItems.length; i++) {
      const orig = initialItems[i];
      const loc = localItems[i];

      if (orig.productType !== loc.productType) return true;
      if (orig.quantity !== loc.quantity) return true;
      if (Number(orig.price) !== loc.price) return true;
      if (orig.familyMemberId !== loc.familyMemberId) return true;
      if (orig.featureLabel !== loc.selectedFeatures.join(", ")) return true;
      if (orig.measurementId !== loc.measurementId) return true;

      // Compare measurement values (normalize)
      const origMeas = orig.measurementValues || {};
      const locMeas = loc.measurementValues;
      if (JSON.stringify(origMeas) !== JSON.stringify(locMeas)) return true;
    }

    return false;
  }

  // --- Item Management ---
  function addLocalItem() {
    if (productTypes.length === 0) return;
    const pt = productTypes[0];
    const measState = getMeasurementState(selectedCustomerId, null, pt.id, pt.name);
    setLocalItems((prev) => [
      ...prev.map((it) => ({ ...it, expanded: false })),
      {
        id: generateId(),
        productTypeId: pt.id,
        productType: pt.name,
        quantity: 1,
        price: pt.amount ? Number(pt.amount) : 0,
        familyMemberId: null,
        selectedFeatures: [],
        ...measState,
        expanded: true
      }
    ]);
  }

  function removeLocalItem(id: string) {
    setLocalItems((prev) => prev.filter((item) => item.id !== id));
  }


  function updateItemProduct(idx: number, productTypeId: string) {
    const pt = productTypes.find((p) => p.id === productTypeId);
    if (!pt) return;
    setLocalItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      const measState = getMeasurementState(selectedCustomerId, item.familyMemberId, pt.id, pt.name);
      updated[idx] = {
        ...item,
        productTypeId,
        productType: pt.name,
        price: pt.amount ? Number(pt.amount) : 0,
        selectedFeatures: [],
        ...measState
      };
      return updated;
    });
  }

  function updateItemAssignee(idx: number, familyMemberId: string | null) {
    setLocalItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      const measState = getMeasurementState(selectedCustomerId, familyMemberId, item.productTypeId, item.productType);
      const nextItem = { ...item, familyMemberId };
      updated[idx] = {
        ...nextItem,
        selectedFeatures: getValidSelectedFeatures(nextItem),
        ...measState
      };
      return updated;
    });
  }

  function toggleItemFeature(idx: number, label: string) {
    setLocalItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      const isSelected = item.selectedFeatures.includes(label);
      const nextFeatures = isSelected
        ? item.selectedFeatures.filter((f) => f !== label)
        : [...item.selectedFeatures, label];
      updated[idx] = {
        ...item,
        selectedFeatures: nextFeatures
      };
      return updated;
    });
  }

  // --- Customer Selection ---
  function selectCustomer(id: string) {
    const cu = customers.find((c) => c.id === id);
    if (cu) {
      setSelectedCustomerId(id);
      setCustomerSearch(cu.name);
      setShowCustomerList(false);
      setShowCustomerModal(false);
      setLocalItems([]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  // --- Measurement Modal ---
  function openMeasurementEditor(idx: number) {
    const item = localItems[idx];
    setActiveItemIndex(idx);
    setMeasDraftValues(item.measurementValues);
    setMeasDraftCustom(item.customValues);
    setMeasDraftPhotos(item.photos);
    setMeasDraftNotes(item.notes);
    setShowMeasModal(true);
  }

  async function handleSaveMeasurement() {
    if (activeItemIndex === null || !selectedCustomer) return;
    const item = localItems[activeItemIndex];
    setSavingMeasurement(true);
    try {
      const valuesToSave: Record<string, number> = {};
      const fields = getFieldsForProduct(item.productType);
      fields.forEach((k) => {
        const val = measDraftValues[k];
        if (!val) return;
        const n = parseFloat(val);
        if (Number.isFinite(n) && n > 0) valuesToSave[k] = n;
      });

      const customToSave = getCustomFieldsForItem(item)
        .map((cf) => {
          const raw = measDraftCustom[cf.id] || "";
          const n = parseFloat(raw);
          return { label: cf.fieldName, value: Number.isFinite(n) ? n : 0 };
        })
        .filter((cm) => cm.value > 0);

      if (Object.keys(valuesToSave).length === 0 && customToSave.length === 0) {
        Alert.alert("No measurements", "Please enter at least one measurement value before saving.");
        setSavingMeasurement(false);
        return;
      }

      const payload = {
        customerId: selectedCustomerId,
        customerName: selectedCustomer.name,
        familyMemberId: item.familyMemberId || undefined,
        productType: item.productType,
        productTypeId: item.productTypeId || undefined,
        featureLabel: getValidSelectedFeatures(item).join(", ") || undefined,
        measurementDate: new Date().toISOString().split("T")[0],
        photos: measDraftPhotos,
        notes: measDraftNotes.trim() || undefined,
        customMeasurements: customToSave,
        ...valuesToSave
      };

      let finalMeasId = item.measurementId;
      if (item.measurementId) {
        await updateMeasurement(item.measurementId, payload);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const newMeas = await addMeasurement(payload as any);
        finalMeasId = newMeas.id;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setLocalItems((prev) => {
        const updated = [...prev];
        updated[activeItemIndex] = {
          ...updated[activeItemIndex],
          measurementId: finalMeasId,
          measurementValues: measDraftValues,
          customValues: measDraftCustom,
          photos: measDraftPhotos,
          notes: measDraftNotes
        };
        return updated;
      });
      setShowMeasModal(false);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to save measurement");
    } finally {
      setSavingMeasurement(false);
    }
  }

  // --- Order-level Photos ---
  async function handleAddOrderPhoto() {
    const picked = await pickMeasurementPhotos(orderPhotos.length);
    if (picked.length === 0) return;
    setOrderPhotos((prev) => [...prev, ...picked.map((p) => p.base64).filter(Boolean)]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleRemoveOrderPhoto(idx: number) {
    setOrderPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  // --- Per-item Photo Management ---
  async function handleAddItemPhoto(idx: number) {
    const item = localItems[idx];
    const picked = await pickMeasurementPhotos(item.photos.length);
    if (picked.length === 0) return;
    setLocalItems((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        photos: [...updated[idx].photos, ...picked.map((p) => p.base64).filter(Boolean)],
      };
      return updated;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleRemoveItemPhoto(idx: number, photoIdx: number) {
    setLocalItems((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        photos: updated[idx].photos.filter((_, i) => i !== photoIdx),
      };
      return updated;
    });
  }

  // --- Custom Fields ---
  async function handleAddCustomField() {
    const trimmed = newCustomFieldName.trim();
    if (!trimmed) {
      Alert.alert("Field name required", "Please enter a name for the custom measurement field.");
      return;
    }
    setSavingCustomField(true);
    try {
      const item = activeItemIndex === null ? null : localItems[activeItemIndex];
      if (!item) {
        Alert.alert("No item selected", "Please select an order item before adding a custom field.");
        return;
      }
      await addCustomField(trimmed, {
        customerId: selectedCustomerId,
        familyMemberId: item.familyMemberId,
        productTypeId: item.productTypeId,
        productType: item.productType,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewCustomFieldName("");
      setShowAddCustomFieldModal(false);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to add custom field");
    } finally {
      setSavingCustomField(false);
    }
  }

  async function handleDeleteCustomField(cfId: string, cfName: string) {
    Alert.alert(
      `Delete "${cfName}"?`,
      `"${cfName}" will be removed from the master list. Historical order and measurement values that used this field will not be affected.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCustomField(cfId);
              setMeasDraftCustom((prev) => {
                const next = { ...prev };
                delete next[cfId];
                return next;
              });
              setLocalItems((prev) =>
                prev.map((it) => {
                  const { [cfId]: _removed, ...rest } = it.customValues;
                  return { ...it, customValues: rest };
                })
              );
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Failed to delete custom field");
            }
          },
        },
      ]
    );
  }

  // --- Custom Features ---
  function openCustomFeatureModal(idx: number) {
    const item = localItems[idx];
    const text = (itemCustomFeatureText[item.id] ?? "").trim();
    if (!text) return;
    setCustomFeatureTargetIdx(idx);
    setCustomFeatureInput(text);
    setShowCustomFeatureModal(true);
  }

  async function handleAddCustomFeature() {
    if (customFeatureTargetIdx === null) return;
    const label = customFeatureInput.trim();
    if (!label || label.length < 2) {
      Alert.alert("Validation", "Feature name must be at least 2 characters.");
      return;
    }
    const item = localItems[customFeatureTargetIdx];
    const pt = getProductForItem(item);
    if (!pt) {
      Alert.alert("Error", "Product type not found.");
      return;
    }
    const existing = (pt.features ?? []).find(
      (f) => f.label.toLowerCase() === label.toLowerCase()
    );
    if (existing) {
      setLocalItems((prev) => {
        const updated = [...prev];
        const it = updated[customFeatureTargetIdx];
        if (!it.selectedFeatures.includes(existing.label)) {
          updated[customFeatureTargetIdx] = {
            ...it,
            selectedFeatures: [...it.selectedFeatures, existing.label],
          };
        }
        return updated;
      });
      setItemCustomFeatureText((prev) => ({ ...prev, [item.id]: "" }));
      setShowCustomFeatureModal(false);
      return;
    }
    setSavingCustomFeature(true);
    try {
      const newFeature = { label, gender: "both" as const };
      const updatedFeatures = [...(pt.features ?? []), newFeature];
      await updateProductType(pt.id, { features: updatedFeatures });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLocalItems((prev) => {
        const updated = [...prev];
        const it = updated[customFeatureTargetIdx];
        updated[customFeatureTargetIdx] = {
          ...it,
          selectedFeatures: [...it.selectedFeatures, label],
        };
        return updated;
      });
      setItemCustomFeatureText((prev) => ({ ...prev, [item.id]: "" }));
      setShowCustomFeatureModal(false);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to add feature");
    } finally {
      setSavingCustomFeature(false);
    }
  }

  // --- Family Member ---
  function openFamilyCreator(idx: number) {
    setFamilyAssignTargetIdx(idx);
    setFamilyDraftName("");
    setFamilyDraftRelation("other");
    setShowFamilyModal(true);
  }

  async function handleSaveFamilyMember() {
    if (!selectedCustomerId || !familyDraftName.trim()) {
      Alert.alert("Error", "Please enter family member's name");
      return;
    }
    if (familyDraftName.trim().length < 2) {
      Alert.alert("Validation", "Family member's name must be at least 2 characters");
      return;
    }
    setSavingFamily(true);
    try {
      const member = await addFamilyMember({
        primaryCustomerId: selectedCustomerId,
        name: familyDraftName.trim(),
        relation: familyDraftRelation,
        gender: "unisex"
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (familyAssignTargetIdx !== null) {
        updateItemAssignee(familyAssignTargetIdx, member.id);
      }
      setShowFamilyModal(false);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to add family member");
    } finally {
      setSavingFamily(false);
    }
  }

  // --- Handle Update ---
  async function handleUpdate() {
    if (!selectedCustomerId || !selectedCustomer) {
      Alert.alert("Customer required", "Please select a customer before saving the order.");
      return;
    }
    if (localItems.length === 0) {
      Alert.alert("No items", "Please include at least one item in the order.");
      return;
    }

    // Validation
    for (let i = 0; i < localItems.length; i++) {
      const it = localItems[i];
      if (!it.productType || !it.productType.trim()) {
        Alert.alert("Product Type required", `Item #${i + 1}: please select a product type.`);
        return;
      }
      if (!(it.price > 0)) {
        Alert.alert("Amount required", `Item #${i + 1}: amount must be greater than 0.`);
        return;
      }
      if (!(it.quantity >= 1)) {
        Alert.alert("Quantity required", `Item #${i + 1}: quantity must be at least 1.`);
        return;
      }
      if (it.familyMemberId === undefined) {
        Alert.alert("Assignee required", `Item #${i + 1}: please choose who this item is for.`);
        return;
      }
      const hasMeasurementValues = Object.values(it.measurementValues).some(
        (v) => v && Number(v) > 0
      );
      const hasCustomValues = Object.values(it.customValues).some(
        (v) => v && Number(v) > 0
      );
      if (!it.measurementId && !hasMeasurementValues && !hasCustomValues) {
        Alert.alert(
          "Measurement required",
          `Item #${i + 1}: please record measurement details before saving.`
        );
        return;
      }
    }

    // Discount validation
    if (discountType !== "none") {
      const n = Number(discountValue);
      if (!Number.isFinite(n) || n <= 0) {
        Alert.alert(
          "Invalid discount",
          discountType === "percent"
            ? "Please enter a discount percentage greater than 0."
            : "Please enter a discount amount greater than 0."
        );
        return;
      }
      if (discountType === "percent" && n > 100) {
        Alert.alert("Invalid discount", "Discount percentage cannot exceed 100.");
        return;
      }
    }

    // Check if changes were made
    if (!detectChanges()) {
      Alert.alert("No Changes", "No changes detected. The order is already up to date.");
      router.back();
      return;
    }

    setLoading(true);
    try {
      const orderItemsList = localItems.map((item) => {
        const member = item.familyMemberId
          ? familyMembers.find((fm) => fm.id === item.familyMemberId)
          : undefined;

        const mValues: Record<string, string> = {};
        Object.entries(item.measurementValues).forEach(([k, v]) => {
          if (v && Number(v) > 0) mValues[k] = `${v}"`;
        });
        Object.entries(item.customValues).forEach(([fid, val]) => {
          const cf = customFields.find((f) => f.id === fid);
          if (cf && val && Number(val) > 0) {
            mValues[cf.fieldName] = `${val}"`;
          }
        });

        return {
          id: item.id,
          productTypeId: item.productTypeId || undefined,
          productType: item.productType,
          featureLabel: getValidSelectedFeatures(item).join(", ") || null,
          quantity: item.quantity,
          price: item.price,
          measurementId: item.measurementId,
          familyMemberId: item.familyMemberId,
          personName: member?.name ?? selectedCustomer?.name,
          relation: member?.relation ?? "self",
          measurementValues: Object.keys(mValues).length > 0 ? mValues : null,
        };
      });

      await updateOrder(id, {
        customerId: selectedCustomerId,
        customerName: selectedCustomer.name,
        customerMobile: selectedCustomer.mobile,
        deliveryDate: deliveryDate || undefined,
        notes: notes.trim() || undefined,
        advanceAmount: advancePaid,
        photos: orderPhotos,
        items: orderItemsList,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Order updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to update order");
    } finally {
      setLoading(false);
    }
  }

  // --- Computed Values ---
  const orderItemsList = useMemo(() => {
    return localItems.map((item) => {
      const member = item.familyMemberId
        ? familyMembers.find((fm) => fm.id === item.familyMemberId)
        : undefined;

      const mValues: Record<string, string> = {};
      Object.entries(item.measurementValues).forEach(([k, v]) => {
        if (v && Number(v) > 0) mValues[k] = `${v}"`;
      });
      Object.entries(item.customValues).forEach(([fid, val]) => {
        const cf = customFields.find((f) => f.id === fid);
        if (cf && val && Number(val) > 0) {
          mValues[cf.fieldName] = `${val}"`;
        }
      });

      return {
        id: item.id,
        productTypeId: item.productTypeId || undefined,
        productType: item.productType,
        featureLabel: getValidSelectedFeatures(item).join(", ") || null,
        quantity: item.quantity,
        price: item.price,
        measurementId: item.measurementId,
        familyMemberId: item.familyMemberId,
        personName: member?.name ?? selectedCustomer?.name,
        relation: member?.relation ?? "self",
        measurementValues: Object.keys(mValues).length > 0 ? mValues : null,
      };
    });
  }, [localItems, familyMembers, selectedCustomer, customFields, productTypes]);

  const totalAmount = useMemo(() => {
    return orderItemsList.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [orderItemsList]);

  const discountAmount = useMemo(() => {
    if (discountType === "none") return 0;
    const raw = Number(discountValue);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    if (discountType === "percent") {
      const pct = Math.min(raw, 100);
      return Math.min(Math.round((totalAmount * pct) / 100), totalAmount);
    }
    return Math.min(Math.round(raw), totalAmount);
  }, [discountType, discountValue, totalAmount]);

  const finalAmount = useMemo(() => Math.max(0, totalAmount - discountAmount), [totalAmount, discountAmount]);

  const advancePaid = useMemo(() => {
    const n = Number(advanceAmount);
    return isNaN(n) ? 0 : Math.min(n, finalAmount);
  }, [advanceAmount, finalAmount]);

  const balanceDue = useMemo(() => finalAmount - advancePaid, [finalAmount, advancePaid]);

  const filteredCustomers = customers.filter(
    (cu) => {
      const cuName = cu.name || "";
      const searchVal = customerSearch || "";
      const cuMobile = cu.mobile || "";
      return cuName.toLowerCase().includes(searchVal.toLowerCase()) ||
             cuMobile.includes(searchVal);
    }
  );

  const modalFiltered = customers.filter(
    (cu) => {
      const cuName = cu.name || "";
      const searchVal = modalSearch || "";
      const cuMobile = cu.mobile || "";
      return cuName.toLowerCase().includes(searchVal.toLowerCase()) ||
             cuMobile.includes(searchVal);
    }
  );

  const useModalPicker = customers.length > CUSTOMER_INLINE_LIMIT;

  const topPad = Platform.OS === "web" ? 67 : 0;
  const activeItem = activeItemIndex === null ? null : localItems[activeItemIndex] ?? null;
  const activeCustomFields = activeItem ? getCustomFieldsForItem(activeItem) : [];

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: c.background }}>
        <ActivityIndicator size="large" color={c.primary} />
        <Text style={{ marginTop: 16, color: c.mutedForeground }}>Loading order...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: c.background }}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + topPad + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: c.card,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={24} color={c.foreground} />
        </Pressable>
        <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: c.foreground }}>
          Update Order
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {/* Customer Picker */}
        <Card style={{ padding: 16, gap: 12 }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: c.mutedForeground }}>
            Customer Details
          </Text>
          <View style={{ position: "relative" }}>
            <View
              style={{
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 8,
                paddingVertical: 12,
                paddingHorizontal: 14,
                backgroundColor: c.muted + "30",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <MaterialIcons name="person" size={20} color={c.mutedForeground} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontFamily: "Inter_500Medium",
                  color: c.foreground,
                }}
                numberOfLines={1}
              >
                {customerSearch || (selectedCustomer ? selectedCustomer.name : "Select a customer")}
              </Text>
              <View
                style={{
                  backgroundColor: c.muted,
                  borderRadius: 4,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: "Inter_600SemiBold",
                    color: c.mutedForeground,
                    textTransform: "uppercase",
                  }}
                >
                  Locked
                </Text>
              </View>
            </View>
            {/* Hidden native input to keep focus behavior */}
            <Input
              placeholder="Search Customer..."
              value={customerSearch}
              onChangeText={() => {}}
              onFocus={() => {}}
              style={{ position: "absolute", opacity: 0, height: 0, width: 0 }}
            />
            {showCustomerList && !useModalPicker && customerSearch.length > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: 50,
                  left: 0,
                  right: 0,
                  backgroundColor: c.card,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: c.border,
                  maxHeight: 200,
                  zIndex: 10,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 10,
                  elevation: 5,
                }}
              >
                <ScrollView keyboardShouldPersistTaps="handled">
                  {filteredCustomers.map((cu) => (
                    <Pressable
                      key={cu.id}
                      onPress={() => selectCustomer(cu.id)}
                      style={{
                        padding: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: c.border,
                      }}
                    >
                      <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                        {cu.name}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 2 }}>
                        {cu.mobile}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {selectedCustomer && (
            <View style={{ backgroundColor: c.muted + "40", borderRadius: 8, padding: 12, marginTop: 4 }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                Primary Customer: {selectedCustomer.name}
              </Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 2 }}>
                Phone: {selectedCustomer.mobile}
              </Text>
            </View>
          )}
        </Card>

        {/* Dynamic Items Section */}
        {!!selectedCustomerId && (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>
                Order Items ({localItems.length})
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pressable
                  onPress={addLocalItem}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.primary + "10", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 }}
                >
                  <MaterialIcons name="add" size={16} color={c.primary} />
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.primary }}>
                    Add Item
                  </Text>
                </Pressable>
              </View>
            </View>

            {localItems.map((item, idx) => {
              const pt = getProductForItem(item);
              const matchingFeatures = getMatchingFeatures(pt, item.familyMemberId);

              const measSummaryList: string[] = [];
              getFieldsForProduct(item.productType).forEach((k) => {
                const val = item.measurementValues[k];
                if (val) measSummaryList.push(`${titleCase(k)}: ${val}"`);
              });
              Object.entries(item.customValues).forEach(([fid, val]) => {
                const cf = customFields.find((f) => f.id === fid);
                if (cf && val) measSummaryList.push(`${cf.fieldName}: ${val}"`);
              });
              const summaryParts: string[] = [];
              if (item.selectedFeatures.length > 0) {
                summaryParts.push(item.selectedFeatures.join(", "));
              }
              if (measSummaryList.length > 0) {
                summaryParts.push(measSummaryList.join("  ·  "));
              }
              const summaryText = summaryParts.join("  ·  ") || "Tap to add measurements & features";

              return (
                <Card key={item.id || `item-${idx}`} style={{ padding: 16, borderWidth: 1, borderColor: c.border }}>
                  {!item.expanded ? (
                    /* Collapsed State */
                    <Pressable
                      onPress={() => {
                        setLocalItems((prev) => {
                          const updated = [...prev];
                          updated[idx] = { ...updated[idx], expanded: true };
                          return updated;
                        });
                      }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                    >
                      {/* Photo Thumbnail */}
                      {item.photos[0] ? (
                        <Image
                          source={{ uri: base64ToDataUri(item.photos[0]) }}
                          style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: c.muted }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" }}>
                          <MaterialIcons name="image" size={20} color={c.mutedForeground} />
                        </View>
                      )}

                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.foreground }}>
                            {item.productType}
                          </Text>
                          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                            {item.quantity} x {formatCurrency(item.price)}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, color: c.mutedForeground, fontFamily: "Inter_400Regular" }} numberOfLines={1}>
                          {summaryText}
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {localItems.length > 1 && (
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              removeLocalItem(item.id);
                            }}
                            style={{ padding: 4 }}
                          >
                            <MaterialIcons name="delete" size={20} color={c.destructive} />
                          </Pressable>
                        )}
                        <MaterialIcons name="keyboard-arrow-down" size={24} color={c.mutedForeground} />
                      </View>
                    </Pressable>
                  ) : (
                    /* Expanded State */
                    <View style={{ gap: 14 }}>
                      {/* Expanded Header */}
                      <Pressable
                        onPress={() => {
                          setLocalItems((prev) => {
                            const updated = [...prev];
                            updated[idx] = { ...updated[idx], expanded: false };
                            return updated;
                          });
                        }}
                        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.border + "50" }}
                      >
                        <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.foreground }}>
                          Item #{idx + 1} ({item.productType})
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          {localItems.length > 1 && (
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                removeLocalItem(item.id);
                              }}
                              style={{ padding: 4 }}
                            >
                              <MaterialIcons name="delete" size={20} color={c.destructive} />
                            </Pressable>
                          )}
                          <MaterialIcons name="keyboard-arrow-up" size={24} color={c.mutedForeground} />
                        </View>
                      </Pressable>

                      {/* Product Type Chips */}
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Product Type
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                          <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }}>
                            {productTypes.map((p) => (
                              <Pressable
                                key={p.id}
                                onPress={() => updateItemProduct(idx, p.id)}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 7,
                                  borderRadius: 20,
                                  backgroundColor: item.productTypeId === p.id ? c.primary : c.muted,
                                  borderWidth: 1,
                                  borderColor: item.productTypeId === p.id ? c.primary : "transparent",
                                }}
                              >
                                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: item.productTypeId === p.id ? "#FFFFFF" : c.mutedForeground }}>
                                  {p.name}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </ScrollView>
                      </View>

                      {/* Quantity and Price Inputs */}
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            Price (₹)
                          </Text>
                          <TextInput
                            keyboardType="number-pad"
                            value={item.price === 0 ? "" : String(item.price)}
                            onChangeText={(val) => {
                              const clean = val.replace(/[^0-9]/g, "").slice(0, 7);
                              setLocalItems((prev) => {
                                const updated = [...prev];
                                updated[idx].price = clean === "" ? 0 : Math.min(9999999, Number(clean));
                                return updated;
                              });
                            }}
                            maxLength={7}
                            style={{
                              borderWidth: 1,
                              borderColor: c.border,
                              borderRadius: 8,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              fontSize: 14,
                              color: c.foreground,
                              backgroundColor: c.input,
                              fontFamily: "Inter_600SemiBold",
                            }}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            Qty
                          </Text>
                          <TextInput
                            keyboardType="number-pad"
                            value={
                              item.quantity === 1
                                ? "1"
                                : item.quantity === 0
                                ? ""
                                : String(item.quantity)
                            }
                            onChangeText={(val) => {
                              const clean = val.replace(/[^0-9]/g, "").slice(0, 4);
                              setLocalItems((prev) => {
                                const updated = [...prev];
                                updated[idx].quantity = clean === "" ? 0 : Math.min(9999, Number(clean));
                                return updated;
                              });
                            }}
                            maxLength={4}
                            style={{
                              borderWidth: 1,
                              borderColor: c.border,
                              borderRadius: 8,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              fontSize: 14,
                              color: c.foreground,
                              backgroundColor: c.input,
                              textAlign: "center",
                              fontFamily: "Inter_600SemiBold",
                            }}
                          />
                        </View>
                      </View>

                      {/* Assign To Chips */}
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Assign To
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                          <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4, alignItems: "center" }}>
                            <Pressable
                              onPress={() => updateItemAssignee(idx, null)}
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 7,
                                borderRadius: 20,
                                backgroundColor: item.familyMemberId === null ? c.primary : c.muted,
                                borderWidth: 1,
                                borderColor: item.familyMemberId === null ? c.primary : "transparent",
                              }}
                            >
                              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: item.familyMemberId === null ? "#FFFFFF" : c.mutedForeground }}>
                                Self
                              </Text>
                            </Pressable>
                            {customerFamilyMembers.map((fm) => (
                              <Pressable
                                key={fm.id}
                                onPress={() => updateItemAssignee(idx, fm.id)}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 7,
                                  borderRadius: 20,
                                  backgroundColor: item.familyMemberId === fm.id ? c.primary : c.muted,
                                  borderWidth: 1,
                                  borderColor: item.familyMemberId === fm.id ? c.primary : "transparent",
                                }}
                              >
                                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: item.familyMemberId === fm.id ? "#FFFFFF" : c.mutedForeground }}>
                                  {fm.name} ({titleCase(fm.relation)})
                                </Text>
                              </Pressable>
                            ))}
                            <Pressable
                              onPress={() => openFamilyCreator(idx)}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: c.primary,
                                borderStyle: "dashed",
                              }}
                            >
                              <MaterialIcons name="add" size={14} color={c.primary} />
                              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.primary }}>
                                Add Family
                              </Text>
                            </Pressable>
                          </View>
                        </ScrollView>
                      </View>

                      {/* Features/Sub-types */}
                      <View style={{ gap: 8 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Features / Sub-types
                        </Text>

                        {matchingFeatures.length > 0 ? (
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {matchingFeatures.map((feat) => {
                              const isSel = item.selectedFeatures.includes(feat.label);
                              return (
                                <Pressable
                                  key={feat.label}
                                  onPress={() => toggleItemFeature(idx, feat.label)}
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 8,
                                    backgroundColor: isSel ? c.primary + "10" : c.muted + "20",
                                    borderWidth: 1,
                                    borderColor: isSel ? c.primary : c.border,
                                  }}
                                >
                                  <MaterialIcons
                                    name={isSel ? "check-box" : "check-box-outline-blank"}
                                    size={16}
                                    color={isSel ? c.primary : c.mutedForeground}
                                  />
                                  <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: isSel ? c.primary : c.foreground }}>
                                    {feat.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        ) : (
                          <View style={{ padding: 10, borderRadius: 8, backgroundColor: c.muted + "20", borderWidth: 1, borderColor: c.border }}>
                            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
                              {pt?.features?.length ? "No sub-types match this assignee" : "No sub-types added yet. Add one below!"}
                            </Text>
                          </View>
                        )}

                        {/* Inline Add Custom Feature */}
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            borderWidth: 1,
                            borderColor: c.border,
                            borderRadius: 10,
                            backgroundColor: c.input,
                            overflow: "hidden",
                            marginTop: 2,
                          }}
                        >
                          <TextInput
                            style={{
                              flex: 1,
                              fontSize: 13,
                              fontFamily: "Inter_400Regular",
                              color: c.foreground,
                              paddingHorizontal: 12,
                              paddingVertical: 9,
                            }}
                            placeholder="e.g. Half Sleeve, V-Neck"
                            placeholderTextColor={c.mutedForeground}
                            value={itemCustomFeatureText[item.id] ?? ""}
                            onChangeText={(v) =>
                              setItemCustomFeatureText((prev) => ({ ...prev, [item.id]: v.slice(0, 60) }))
                            }
                            onSubmitEditing={() => openCustomFeatureModal(idx)}
                            returnKeyType="done"
                            maxLength={60}
                          />
                          <Pressable
                            onPress={() => openCustomFeatureModal(idx)}
                            style={{
                              backgroundColor: c.primary,
                              paddingHorizontal: 14,
                              paddingVertical: 9,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <MaterialIcons name="add" size={18} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      </View>

                      {/* Measurement Box */}
                      <View style={{ gap: 6, marginTop: 4 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Measurements Details
                        </Text>
                        <View
                          style={{
                            padding: 12,
                            borderRadius: 10,
                            backgroundColor: c.muted + "30",
                            borderWidth: 1,
                            borderColor: c.border,
                            gap: 10,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: item.measurementId ? c.foreground : c.mutedForeground }}>
                                {summaryText}
                              </Text>
                              {item.photos.length > 0 && (
                                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                                  {item.photos.slice(0, 4).map((p, pIdx) => (
                                    <Image
                                      key={pIdx}
                                      source={{ uri: base64ToDataUri(p) }}
                                      style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: c.muted }}
                                    />
                                  ))}
                                </View>
                              )}
                            </View>
                            <Pressable
                              onPress={() => openMeasurementEditor(idx)}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                backgroundColor: c.primary,
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                              }}
                            >
                              <MaterialIcons name={item.measurementId ? "edit" : "add"} size={16} color="#FFFFFF" />
                              <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
                                {item.measurementId ? "Edit" : "Add"}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}

        {/* Order Meta Info */}
        {!!selectedCustomerId && (
          <Card style={{ padding: 16, gap: 14 }}>
            {/* Product Photos */}
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ gap: 2 }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Product Photos ({orderPhotos.length}/4)
                  </Text>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
                    Reference images for this order
                  </Text>
                </View>
                {orderPhotos.length < 4 && (
                  <Pressable
                    onPress={handleAddOrderPhoto}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: c.primary + "12",
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: c.primary + "40",
                    }}
                  >
                    <MaterialIcons name="add-a-photo" size={14} color={c.primary} />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.primary }}>
                      Add Photo
                    </Text>
                  </Pressable>
                )}
              </View>

              {orderPhotos.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {orderPhotos.map((p, pIdx) => (
                    <View key={pIdx} style={{ position: "relative" }}>
                      <Image
                        source={{ uri: base64ToDataUri(p) }}
                        style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: c.muted }}
                        resizeMode="cover"
                      />
                      <Pressable
                        onPress={() => handleRemoveOrderPhoto(pIdx)}
                        style={{
                          position: "absolute",
                          top: -6,
                          right: -6,
                          backgroundColor: "#EF4444",
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 2,
                          borderColor: c.card,
                        }}
                      >
                        <MaterialIcons name="close" size={12} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Pressable
                  onPress={handleAddOrderPhoto}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderStyle: "dashed",
                    borderRadius: 10,
                    paddingVertical: 16,
                    backgroundColor: c.muted + "20",
                  }}
                >
                  <MaterialIcons name="add-a-photo" size={20} color={c.mutedForeground} />
                  <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: c.mutedForeground }}>
                    Tap to add product photos
                  </Text>
                </Pressable>
              )}
            </View>

            <DatePicker
              label="Delivery Date (Optional)"
              value={deliveryDate}
              onChange={setDeliveryDate}
            />

            {/* Advance Payment */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Advance Paid (₹)
              </Text>
              <TextInput
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={c.mutedForeground}
                style={{
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  fontSize: 16,
                  color: c.foreground,
                  backgroundColor: c.input,
                  fontFamily: "Inter_600SemiBold",
                }}
                value={advanceAmount}
                onChangeText={(v) => setAdvanceAmount(v.replace(/[^0-9]/g, "").slice(0, 7))}
                maxLength={7}
              />
              {advancePaid > 0 && totalAmount > 0 && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: balanceDue === 0 ? "#D1FAE5" : "#FEF3C7", borderRadius: 8, padding: 10 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: balanceDue === 0 ? "#059669" : "#D97706" }}>
                    {balanceDue === 0 ? "✓ Fully Paid" : `Balance Due`}
                  </Text>
                  {balanceDue > 0 && (
                    <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#D97706" }}>
                      {formatCurrency(balanceDue)}
                    </Text>
                  )}
                </View>
              )}
            </View>

            <Input
              label="Order Notes (Optional)"
              placeholder="E.g. urgent, specific tailoring design instructions..."
              value={notes}
              onChangeText={(v) => setNotes(v.slice(0, 500))}
              multiline
              numberOfLines={3}
              maxLength={500}
            />

            {/* Discount controls */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Discount (Optional)
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {([
                  { id: "none", label: "None" },
                  { id: "fixed", label: "Fixed ₹" },
                  { id: "percent", label: "% Percent" },
                ] as { id: "none" | "fixed" | "percent"; label: string }[]).map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      setDiscountType(opt.id);
                      if (opt.id === "none") setDiscountValue("");
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 8,
                      alignItems: "center",
                      backgroundColor: discountType === opt.id ? c.primary : c.muted,
                      borderWidth: 1,
                      borderColor: discountType === opt.id ? c.primary : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: discountType === opt.id ? "#FFFFFF" : c.mutedForeground }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {discountType !== "none" && (
                <TextInput
                  keyboardType="decimal-pad"
                  placeholder={discountType === "percent" ? "e.g. 10 (%)" : "e.g. 100 (₹)"}
                  placeholderTextColor={c.mutedForeground}
                  style={{
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    fontSize: 16,
                    color: c.foreground,
                    backgroundColor: c.input,
                    fontFamily: "Inter_600SemiBold",
                  }}
                  value={discountValue}
                  onChangeText={(v) => {
                    const clean = v.replace(/[^0-9.]/g, "");
                    const parts = clean.split(".");
                    const safe = parts.length > 1 ? parts[0] + "." + parts.slice(1).join("") : clean;
                    setDiscountValue(safe.slice(0, 6));
                  }}
                  maxLength={6}
                />
              )}
              {discountType !== "none" && discountAmount > 0 && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: "#FEF3C7", borderRadius: 8, padding: 10 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#92400E" }}>
                    Discount applied
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#92400E" }}>
                    -{formatCurrency(discountAmount)}
                  </Text>
                </View>
              )}
            </View>
          </Card>
        )}

        {/* Total & Action */}
        {!!selectedCustomerId && (
          <View style={{ gap: 12, marginTop: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: c.mutedForeground }}>
                Subtotal
              </Text>
              <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: c.foreground }}>
                {formatCurrency(totalAmount)}
              </Text>
            </View>
            {discountAmount > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: "#D97706" }}>
                  Discount{discountType === "percent" ? ` (${Math.round(Number(discountValue) || 0)}%)` : ""}
                </Text>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#D97706" }}>
                  -{formatCurrency(discountAmount)}
                </Text>
              </View>
            )}
            {discountAmount > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 }}>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>
                  Final Amount
                </Text>
                <Text style={{ fontSize: 22, fontFamily: "Inter_800ExtraBold", color: c.foreground }}>
                  {formatCurrency(finalAmount)}
                </Text>
              </View>
            )}
            {advancePaid > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: "#059669" }}>
                  Advance Paid
                </Text>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#059669" }}>
                  -{formatCurrency(advancePaid)}
                </Text>
              </View>
            )}
            {advancePaid > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 }}>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.foreground }}>
                  Balance Due
                </Text>
                <Text style={{ fontSize: 20, fontFamily: "Inter_800ExtraBold", color: balanceDue === 0 ? "#059669" : "#D97706" }}>
                  {formatCurrency(balanceDue)}
                </Text>
              </View>
            )}

            <Button
              label="Update Order"
              onPress={handleUpdate}
              loading={loading}
              icon="save"
              size="lg"
            />
          </View>
        )}
      </ScrollView>

      {/* Customer Picker Modal */}
      <Modal visible={showCustomerModal} animationType="slide">
        <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border, gap: 12 }}>
            <Pressable onPress={() => setShowCustomerModal(false)} style={{ padding: 4 }}>
              <MaterialIcons name="close" size={24} color={c.foreground} />
            </Pressable>
            <TextInput
              autoFocus
              placeholder="Search customers..."
              style={{ flex: 1, fontSize: 16, color: c.foreground, fontFamily: "Inter_400Regular" }}
              value={modalSearch}
              onChangeText={setModalSearch}
            />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {modalFiltered.map((cu) => (
              <Pressable
                key={cu.id}
                onPress={() => selectCustomer(cu.id)}
                style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: c.border }}
              >
                <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: c.foreground }}>
                  {cu.name}
                </Text>
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginTop: 4 }}>
                  {cu.mobile}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Inline Measurement Modal */}
      {activeItemIndex !== null && (
        <Modal visible={showMeasModal} animationType="slide">
          <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Pressable onPress={() => setShowMeasModal(false)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={24} color={c.foreground} />
              </Pressable>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
                Edit Measurements ({localItems[activeItemIndex]?.productType})
              </Text>
              <Button
                label="Save"
                onPress={handleSaveMeasurement}
                loading={savingMeasurement}
                size="sm"
              />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
              {/* Standard Fields */}
              <View style={{ gap: 12 }}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Standard Measurements (inches)
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}>
                  {MEASUREMENT_FIELDS.filter((f) =>
                    getFieldsForProduct(localItems[activeItemIndex]?.productType).includes(f.key as MeasurementKey)
                  ).map((field) => (
                    <View key={field.key} style={{ width: "50%", paddingHorizontal: 6, marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 4 }}>
                        {field.label}
                      </Text>
                      <TextInput
                        keyboardType="decimal-pad"
                        placeholder="--"
                        value={measDraftValues[field.key] || ""}
                        onChangeText={(val) => {
                          const clean = val.replace(/[^0-9.]/g, "");
                          const parts = clean.split(".");
                          const safe = parts.length > 1 ? parts[0] + "." + parts.slice(1).join("") : clean;
                          setMeasDraftValues((prev) => ({ ...prev, [field.key]: safe }));
                        }}
                        maxLength={5}
                        style={{
                          borderWidth: 1,
                          borderColor: c.border,
                          borderRadius: 8,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          fontSize: 14,
                          color: c.foreground,
                          backgroundColor: c.input,
                          fontFamily: "Inter_600SemiBold",
                        }}
                      />
                    </View>
                  ))}
                </View>
              </View>

              {/* Custom Fields */}
              <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Custom Measurement Fields
                  </Text>
                  <Pressable
                    onPress={() => {
                      setNewCustomFieldName("");
                      setShowAddCustomFieldModal(true);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingVertical: 4,
                      paddingHorizontal: 10,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: c.primary,
                      borderStyle: "dashed",
                    }}
                  >
                    <MaterialIcons name="add" size={12} color={c.primary} />
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: c.primary }}>
                      Add Custom Field
                    </Text>
                  </Pressable>
                </View>

                {activeCustomFields.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}>
                    {activeCustomFields.map((cf) => (
                      <View key={cf.id} style={{ width: "50%", paddingHorizontal: 6, marginBottom: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.foreground, flex: 1 }} numberOfLines={1}>
                            {cf.fieldName}
                          </Text>
                          <Pressable
                            onPress={() => handleDeleteCustomField(cf.id, cf.fieldName)}
                            hitSlop={8}
                            style={{ paddingLeft: 4 }}
                          >
                            <MaterialIcons name="delete-outline" size={16} color={c.destructive ?? "#EF4444"} />
                          </Pressable>
                        </View>
                        <TextInput
                          keyboardType="decimal-pad"
                          placeholder="--"
                          value={measDraftCustom[cf.id] || ""}
                          onChangeText={(val) => {
                            const clean = val.replace(/[^0-9.]/g, "");
                            const parts = clean.split(".");
                            const safe = parts.length > 1 ? parts[0] + "." + parts.slice(1).join("") : clean;
                            setMeasDraftCustom((prev) => ({ ...prev, [cf.id]: safe }));
                          }}
                          maxLength={5}
                          style={{
                            borderWidth: 1,
                            borderColor: c.border,
                            borderRadius: 8,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            fontSize: 14,
                            color: c.foreground,
                            backgroundColor: c.input,
                            fontFamily: "Inter_600SemiBold",
                          }}
                        />
                      </View>
                    ))}
                  </View>
                )}

                {activeCustomFields.length === 0 && (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: c.muted + "20",
                      borderWidth: 1,
                      borderColor: c.border,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: c.mutedForeground, textAlign: "center" }}>
                      No custom fields yet. Tap "Add Custom Field" above to create one.
                    </Text>
                  </View>
                )}
              </View>

              {/* Notes */}
              <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16 }}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Measurement Notes
                </Text>
                <TextInput
                  placeholder="Any specific fit adjustments or instructions..."
                  value={measDraftNotes}
                  onChangeText={(v) => setMeasDraftNotes(v.slice(0, 500))}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  style={{
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    color: c.foreground,
                    backgroundColor: c.input,
                    minHeight: 80,
                    textAlignVertical: "top",
                  }}
                />
              </View>
            </ScrollView>
          </View>

          {/* Add Custom Field overlay */}
          {showAddCustomFieldModal && (
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: "flex-end",
                zIndex: 1000,
                elevation: 1000,
              }}
            >
              <Pressable
                onPress={() => {
                  if (!savingCustomField) {
                    setShowAddCustomFieldModal(false);
                    setNewCustomFieldName("");
                  }
                }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.4)",
                }}
              />
              <View
                style={{
                  backgroundColor: c.card,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  padding: 24,
                  paddingBottom: insets.bottom + 24,
                  gap: 16,
                  borderTopWidth: 1,
                  borderTopColor: c.border,
                  zIndex: 1001,
                  elevation: 1001,
                }}
              >
                <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
                  Add Custom Field
                </Text>
                <Input
                  label="Field Name"
                  placeholder="e.g. Collar Width, Arm Opening"
                  value={newCustomFieldName}
                  onChangeText={(v) => setNewCustomFieldName(v.slice(0, 60))}
                  icon="straighten"
                  autoFocus
                  maxLength={60}
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button
                    label="Cancel"
                    onPress={() => {
                      setShowAddCustomFieldModal(false);
                      setNewCustomFieldName("");
                    }}
                    variant="outline"
                    style={{ flex: 1 }}
                    disabled={savingCustomField}
                  />
                  <Button
                    label="Add Field"
                    onPress={handleAddCustomField}
                    loading={savingCustomField}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </KeyboardAvoidingView>
          )}
        </Modal>
      )}

      {/* Add Custom Feature Modal */}
      <Modal
        visible={showCustomFeatureModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomFeatureModal(false)}
      >
        <Pressable
          onPress={() => !savingCustomFeature && setShowCustomFeatureModal(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: c.card,
              borderRadius: 16,
              padding: 24,
              width: "100%",
              maxWidth: 400,
              gap: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
              Add Custom Feature
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
              Save "{customFeatureInput}" as a new feature for this product type?
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                label="Cancel"
                onPress={() => setShowCustomFeatureModal(false)}
                variant="outline"
                style={{ flex: 1 }}
                disabled={savingCustomFeature}
              />
              <Button
                label="Save Feature"
                onPress={handleAddCustomFeature}
                loading={savingCustomFeature}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Family Member Modal */}
      <Modal
        visible={showFamilyModal}
        transparent
        animationType="fade"
        onRequestClose={() => !savingFamily && setShowFamilyModal(false)}
      >
        <Pressable
          onPress={() => !savingFamily && setShowFamilyModal(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: c.card,
              borderRadius: 16,
              padding: 24,
              width: "100%",
              maxWidth: 400,
              gap: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.foreground }}>
              Add Family Member
            </Text>
            <Input
              label="Name"
              placeholder="Enter name"
              value={familyDraftName}
              onChangeText={(v) => setFamilyDraftName(v.slice(0, 60))}
              autoFocus
            />
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Relation
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {(["self", "spouse", "son", "daughter", "father", "mother", "brother", "sister", "other"] as Relation[]).map((rel) => (
                  <Pressable
                    key={rel}
                    onPress={() => setFamilyDraftRelation(rel)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: familyDraftRelation === rel ? c.primary : c.muted,
                      borderWidth: 1,
                      borderColor: familyDraftRelation === rel ? c.primary : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: familyDraftRelation === rel ? "#FFFFFF" : c.mutedForeground }}>
                      {titleCase(rel)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                label="Cancel"
                onPress={() => setShowFamilyModal(false)}
                variant="outline"
                style={{ flex: 1 }}
                disabled={savingFamily}
              />
              <Button
                label="Add"
                onPress={handleSaveFamilyMember}
                loading={savingFamily}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
