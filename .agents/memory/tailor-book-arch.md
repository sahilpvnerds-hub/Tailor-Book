---
name: Tailor Book architecture
description: Key non-obvious decisions for the Tailor Book Expo mobile app
---

## Stack decisions

- **AsyncStorage-only** — no API server. `utils/api.ts` is a dead stub. `@workspace/api-client` is NOT used by the mobile app.
- `utils/storage.ts` is the single source for all AsyncStorage helpers, ID gen, and `displayOrderLabel` / `formatCurrency` / `formatDate`.
- `context/DataContext.tsx` owns all CRUD for customers, measurements, invoices, productTypes, familyMembers, customFields, notifications.
- `context/AuthContext.tsx` owns all user/session state including `updateProfile`, `updateOnboardingComplete`, admin approval flow.

## Data model highlights

- `Customer` — name, mobile, gender only (no email/address/notes).
- `FamilyMember` — linked to customer by `customerId`; has relation and gender.
- `Measurement` — `productTypeId` + `productType` name; delivery date field; `customMeasurements[]`.
- `Invoice` — no GST. `subtotal === total`. Items have `productTypeId` for auto-fill.
- `ProductType` — name + amount; seeded from `DEFAULT_PRODUCT_TYPES` on first launch.

## Screen notes

- Tab layout: Home, Products, Customers, Invoices, More. Measurements tab hidden (`href: null`) — reached via customer detail.
- `customers/[id]` — family members section with add/delete modal.
- `measurements/new` — product-specific fields via `getFieldsForProduct()`, delivery date, custom fields modal.
- `invoices/new` — searchable customer TextInput, product type chips auto-fill price.
- `more` — Admin panel + Help & Support + Sign Out only.
- `onboarding` — shown for new tailors (`user.role === 'tailor' && !user.onboardingComplete`).

**Why:** User requirements: pure AsyncStorage, no backend for client data, add family members, remove GST, product-specific measurements, delivery date.
