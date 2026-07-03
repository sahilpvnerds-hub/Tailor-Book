# Edit Order Implementation Plan

## Overview
Create a full Edit Order experience using the same UI and components as Create Order, with the ability to modify all order aspects.

## 1. Backend Enhancement

### 1.1 Update PATCH Endpoint (already exists!)
The `/api/orders/:id` endpoint is already implemented and supports full order updates. No changes needed here.

### 1.2 Change Detection
Add a helper function in the backend to detect what actually changed:
```typescript
function detectOrderChanges(original: Order, updated: Order) {
  const changes: { field: string; oldValue: any; newValue: any }[] = [];
  
  // Compare basic fields
  if (original.customerId !== updated.customerId) changes.push({ field: 'customerId', oldValue: original.customerId, newValue: updated.customerId });
  if (original.status !== updated.status) changes.push({ field: 'status', oldValue: original.status, newValue: updated.status });
  if (original.deliveryDate !== updated.deliveryDate) changes.push({ field: 'deliveryDate', oldValue: original.deliveryDate, newValue: updated.deliveryDate });
  if (original.notes !== updated.notes) changes.push({ field: 'notes', oldValue: original.notes, newValue: updated.notes });
  if (original.advanceAmount !== updated.advanceAmount) changes.push({ field: 'advanceAmount', oldValue: original.advanceAmount, newValue: updated.advanceAmount });
  
  return changes;
}
```

## 2. Frontend DataContext Update

### 2.1 Add `updateOrder` function
```typescript
// artifacts/mobile/context/DataContext.tsx
async function updateOrder(orderId: string, data: {
  customerId?: string;
  customerName?: string;
  customerMobile?: string;
  status?: Order["status"];
  deliveryDate?: string;
  notes?: string;
  advanceAmount?: number;
  items: Array<Omit<OrderItem, "id" | "orderId" | "createdAt" | "deliveryStatus" | "invoiceId">>;
}) {
  // 1. Calculate totals
  const totalAmount = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const advanceAmount = Math.min(data.advanceAmount ?? 0, totalAmount);
  const balanceDue = Math.max(0, totalAmount - advanceAmount);
  
  // 2. Try API first
  try {
    const updated = await api.orders.update(orderId, {
      ...data,
      totalAmount,
      advanceAmount,
      balanceDue,
    });
    setOrders(orders.map(o => o.id === orderId ? updated : o));
    return updated;
  } catch (error) {
    // 3. Fallback to local storage
    const { getStorageItem, saveAllOrders } = await import("@/utils/storage");
    const allOrders = (await getStorageItem<Order[]>("@tailorbook/orders")) ?? [];
    const updatedOrder = {
      ...allOrders.find(o => o.id === orderId)!,
      ...data,
      totalAmount,
      advanceAmount,
      balanceDue,
      updatedAt: new Date().toISOString(),
    };
    const updatedList = allOrders.map(o => o.id === orderId ? updatedOrder : o);
    await saveAllOrders(updatedList);
    setOrders(updatedList);
    return updatedOrder;
  }
}
```

### 2.2 Update API Client
```typescript
// artifacts/mobile/utils/api.ts
export async function updateOrder(
  token: string,
  orderId: string,
  order: Partial<Order> & { items: Omit<OrderItem, "id" | "orderId" | "createdAt" | "deliveryStatus" | "invoiceId">[] }
): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(order),
  });
  // ...
}
```

## 3. Frontend Edit Order Screen

### 3.1 Create New Route: `edit/[id].tsx`
Copy `new.tsx` to `edit/[id].tsx` with these changes:

#### 3.1.1 Component Structure
```typescript
export default function EditOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initialOrder, setInitialOrder] = useState<Order | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Load order data on mount
  useEffect(() => {
    loadOrder();
  }, [id]);
  
  const loadOrder = async () => {
    const orderData = orders.find(o => o.id === id);
    if (orderData) {
      setInitialOrder({ ...orderData });
      setOrder(orderData);
    }
    setLoading(false);
  };
  
  // ... rest of the component
}
```

#### 3..1.2 Load and Prefill Data
```typescript
async function loadOrder() {
  setLoading(true);
  try {
    const allOrders = await getOrders();
    const orderData = allOrders.find(o => o.id === id);
    if (orderData) {
      setInitialOrder({ ...orderData });
      setOrder(orderData);
      
      // Convert order items to local format
      const localItems = orderData.items?.map(item => ({
        id: item.id,
        productTypeId: item.productTypeId || '',
        productType: item.productType,
        quantity: item.quantity,
        price: Number(item.price),
        familyMemberId: item.familyMemberId || null,
        selectedFeatures: item.featureLabel ? [item.featureLabel] : [],
        measurementId: item.measurementId || null,
        measurementValues: item.measurementValues || {},
        customValues: {},
        photos: [],
        notes: '',
        expanded: false,
      })) || [];
      
      setOrderItemsList(localItems);
    }
  } catch (error) {
    Alert.alert("Error", "Failed to load order");
  } finally {
    setLoading(false);
  }
}
```

#### 3.1.3 Handle Update
```typescript
async function handleUpdate() {
  // Validate all fields
  if (!selectedCustomerId || !orderItemsList.length) {
    Alert.alert("Validation", "Please select customer and add at least one item");
    return;
  }
  
  // Check if anything changed
  const hasChanges = detectChanges(initialOrder, {
    customerId: selectedCustomerId,
    customerName: selectedCustomer.name,
    customerMobile: selectedCustomer.mobile,
    deliveryDate: deliveryDate || undefined,
    notes: notes.trim() || undefined,
    advanceAmount: advancePaid,
    items: orderItemsList,
  });
  
  if (!hasChanges) {
    Alert.alert("No Changes", "No changes detected");
    router.back();
    return;
  }
  
  setLoading(true);
  try {
    await updateOrder(id, {
      customerId: selectedCustomerId,
      customerName: selectedCustomer.name,
      customerMobile: selectedCustomer.mobile,
      deliveryDate: deliveryDate || undefined,
      notes: notes.trim() || undefined,
      advanceAmount: advancePaid,
      items: orderItemsList.map(item => ({
        productTypeId: item.productTypeId,
        productType: item.productType,
        quantity: item.quantity,
        price: item.price,
        featureLabel: item.selectedFeatures[0] || undefined,
        measurementId: item.measurementId || undefined,
        familyMemberId: item.familyMemberId || undefined,
        personName: item.familyMemberId ? familyMembers.find(m => m.id === item.familyMemberId)?.name : undefined,
        relation: item.familyMemberId ? familyMembers.find(m => m.id === item.familyMemberId)?.relation : undefined,
        measurementValues: item.measurementValues || undefined,
      })),
    });
    
    Alert.alert("Success", "Order updated successfully", [
      { text: "OK", onPress: () => router.back() }
    ]);
  } catch (error) {
    Alert.alert("Error", "Failed to update order");
  } finally {
    setLoading(false);
  }
}
```

### 3.2 Change Detection Helper
```typescript
function detectChanges(original: Order | null, updated: any): boolean {
  if (!original) return true;
  
  // Check basic fields
  if (original.customerId !== updated.customerId) return true;
  if (original.status !== updated.status) return true;
  if (original.deliveryDate !== updated.deliveryDate) return true;
  if (original.notes !== updated.notes) return true;
  if (original.advanceAmount !== updated.advanceAmount) return true;
  
  // Check items
  const originalItems = original.items || [];
  if (originalItems.length !== updated.items.length) return true;
  
  for (let i = 0; i < originalItems.length; i++) {
    const orig = originalItems[i];
    const upd = updated.items[i];
    
    if (orig.productType !== upd.productType) return true;
    if (orig.quantity !== upd.quantity) return true;
    if (orig.price !== upd.price) return true;
    if (orig.familyMemberId !== upd.familyMemberId) return true;
    if (orig.featureLabel !== upd.featureLabel) return true;
    if (orig.measurementId !== upd.measurementId) return true;
    if (JSON.stringify(orig.measurementValues) !== JSON.stringify(upd.measurementValues)) return true;
  }
  
  return false;
}
```

## 4. Update Navigation

### 4.1 Orders List
Add edit buttons to each order item:
```typescript
// artifacts/mobile/app/(tabs)/orders.tsx
<Pressable onPress={() => router.push(`/orders/edit/${order.id}`)}>
  <MaterialIcons name="edit" size={16} color={colors.primary} />
</Pressable>
```

### 4.2 Order Detail Screen
Update the edit button to open the new edit screen:
```typescript
// artifacts/mobile/app/orders/[id].tsx
<Pressable
  onPress={() => router.push(`/orders/edit/${order.id}`)}
  disabled={isOrderLocked}
>
  <MaterialIcons name="edit" size={20} color={c.primary} />
</Pressable>
```

## 5. Update UI Text

### 5.1 Edit Order Screen
- Title: "Update Order"
- Button: "Update Order"
- Header: "Update Order #{orderNumber}"

### 5.2 Preset Values
- Customer picker: pre-select current customer
- Items: pre-fill all existing items
- Delivery date: show current date if set
- Advance paid: show current advance amount
- Notes: show existing notes
- Discount: show applied discount

## 6. Testing Scenarios

### 6.1 Edit Scenarios
1. Edit customer details
2. Add new product to order
3. Remove existing product
4. Change product type (Shirt → Pant)
5. Update quantity, price
6. Change family member assignment
7. Edit measurements
8. Add/remove product photos
9. Update advance payment
10. Apply discount
11. Change delivery date

### 6.2 Edge Cases
1. Edit completed order (should prevent editing)
2. Edit order with invoices (should allow editing non-invoiced items)
3. Edit order with partial deliveries
4. Offline editing
5. Cancel edit (should show warning if changes made)

## 7. Performance Considerations

1. Lazy load product types and family members
2. Debounce item calculations
3. Optimize photo handling
4. Prevent unnecessary re-renders

## 8. Rollout Plan

1. Phase 1: Implement basic edit screen with core functionality
2. Phase 2: Add all product editing features
3. Phase 3: Add measurement and photo editing
4. Phase 4: Add advanced payment and discount handling
5. Phase 5: Testing and optimization

This plan ensures a comprehensive Edit Order experience while reusing existing Create Order UI components and maintaining data consistency.