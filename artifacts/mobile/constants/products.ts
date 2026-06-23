import { MeasurementKey } from "./measurementFields";
import type { ProductFeature } from "@/types";

export { MEASUREMENT_FIELDS, MeasurementKey } from "./measurementFields";

// Default product types (seeded on first launch if none exist)
export const DEFAULT_PRODUCT_TYPES = [
  { name: "Shirt", amount: 500 },
  { name: "Pant", amount: 700 },
  { name: "Kurta", amount: 600 },
  { name: "Blazer", amount: 2000 },
  { name: "Lenga", amount: 2500 },
  { name: "Coat", amount: 3000 },
  { name: "Safari Suit", amount: 1800 },
  { name: "Jacket", amount: 1500 },
  { name: "School Uniform", amount: 800 },
];

// Which measurement fields to show for each product type
export const PRODUCT_FIELDS: Record<string, MeasurementKey[]> = {
  Shirt:          ["chest", "shoulder", "neck", "sleeve", "length"],
  Pant:           ["waist", "hip", "pantLength", "bottomWidth", "thigh"],
  Kurta:          ["chest", "shoulder", "sleeve", "length", "hip"],
  Blazer:         ["chest", "shoulder", "sleeve", "length", "armhole"],
  Coat:           ["chest", "shoulder", "sleeve", "length", "armhole", "wrist"],
  Lenga:          ["waist", "hip", "length", "chest"],
  "Safari Suit":  ["chest", "shoulder", "sleeve", "length", "waist"],
  Jacket:         ["chest", "shoulder", "sleeve", "length", "armhole"],
  "School Uniform": ["chest", "shoulder", "sleeve", "length", "waist"],
};

// Fallback: all fields for unknown product types
export const ALL_MEASUREMENT_KEYS: MeasurementKey[] = [
  "chest", "shoulder", "neck", "sleeve", "waist",
  "length", "hip", "thigh", "pantLength", "bottomWidth",
  "armhole", "wrist",
];

export function getFieldsForProduct(productName: string): MeasurementKey[] {
  return PRODUCT_FIELDS[productName] ?? ALL_MEASUREMENT_KEYS;
}

// ─── Feature suggestions (shared with the Product Master UI) ────────────────
export type FeatureGender = "male" | "female" | "both";

/** Sub-type feature suggestions keyed by product-name keyword. Every
 *  tailor's product master is seeded with these so the picker comes
 *  pre-populated with everything ticked by default. */
export const FEATURE_SUGGESTIONS: Record<string, { label: string; gender: FeatureGender }[]> = {
  shirt: [
    { label: "Half Sleeve", gender: "both" },
    { label: "Full Sleeve", gender: "both" },
    { label: "Half Boy Shirt", gender: "male" },
    { label: "Full Boy Shirt", gender: "male" },
    { label: "Collar Shirt", gender: "male" },
    { label: "Formal Shirt", gender: "male" },
    { label: "Casual Shirt", gender: "both" },
  ],
  kurta: [
    { label: "Straight Kurta", gender: "both" },
    { label: "V-Type Kurta", gender: "female" },
    { label: "Round-Type Kurta", gender: "female" },
    { label: "Anarkali", gender: "female" },
    { label: "Angrakha", gender: "male" },
    { label: "Band Collar Kurta", gender: "male" },
    { label: "Short Kurta", gender: "male" },
  ],
  pant: [
    { label: "Regular Fit", gender: "both" },
    { label: "Slim Fit", gender: "both" },
    { label: "Bootcut", gender: "both" },
    { label: "Pleated", gender: "both" },
    { label: "Straight Cut", gender: "both" },
  ],
  trouser: [
    { label: "Regular Fit", gender: "both" },
    { label: "Slim Fit", gender: "both" },
    { label: "Formal", gender: "both" },
    { label: "Casual", gender: "both" },
  ],
  lehenga: [
    { label: "A-Line", gender: "female" },
    { label: "Circular", gender: "female" },
    { label: "Mermaid", gender: "female" },
    { label: "Straight", gender: "female" },
  ],
  lenga: [
    { label: "A-Line", gender: "female" },
    { label: "Circular", gender: "female" },
    { label: "Mermaid", gender: "female" },
    { label: "Straight", gender: "female" },
  ],
  blouse: [
    { label: "Short Sleeve", gender: "female" },
    { label: "Sleeveless", gender: "female" },
    { label: "Long Sleeve", gender: "female" },
    { label: "Back Open", gender: "female" },
    { label: "Round Neck", gender: "female" },
    { label: "V-Neck", gender: "female" },
  ],
  suit: [
    { label: "Single Breasted", gender: "male" },
    { label: "Double Breasted", gender: "male" },
    { label: "3-Piece", gender: "male" },
    { label: "2-Piece", gender: "male" },
  ],
  blazer: [
    { label: "Slim Fit", gender: "both" },
    { label: "Regular Fit", gender: "both" },
    { label: "Single Button", gender: "both" },
    { label: "Double Button", gender: "both" },
  ],
  coat: [
    { label: "Single Breasted", gender: "male" },
    { label: "Double Breasted", gender: "male" },
    { label: "Trench", gender: "both" },
    { label: "Overcoat", gender: "male" },
  ],
  jacket: [
    { label: "Bomber", gender: "male" },
    { label: "Denim", gender: "both" },
    { label: "Leather", gender: "male" },
    { label: "Padded", gender: "both" },
  ],
  salwar: [
    { label: "Churidar", gender: "female" },
    { label: "Patiala", gender: "female" },
    { label: "Palazzo", gender: "female" },
    { label: "Straight", gender: "female" },
  ],
  dupatta: [
    { label: "Plain", gender: "female" },
    { label: "Embroidered", gender: "female" },
    { label: "Printed", gender: "female" },
  ],
  uniform: [
    { label: "Half Sleeve", gender: "both" },
    { label: "Full Sleeve", gender: "both" },
    { label: "Regular Fit", gender: "both" },
  ],
  safari: [
    { label: "Half Sleeve", gender: "male" },
    { label: "Full Sleeve", gender: "male" },
    { label: "Regular Fit", gender: "both" },
  ],
};

/** Return the suggestions that match `productName`, optionally filtered
 *  by gender. `gender === "all"` returns every suggestion. */
export function getProductSuggestions(
  productName: string,
  gender: FeatureGender | "all" = "all",
): { label: string; gender: FeatureGender }[] {
  const lower = productName.toLowerCase();
  // Find every keyword that matches so a product like "Safari Suit"
  // picks up suggestions from BOTH "suit" and "safari".
  const matched: { label: string; gender: FeatureGender }[] = [];
  const seen = new Set<string>();
  for (const [key, list] of Object.entries(FEATURE_SUGGESTIONS)) {
    if (!lower.includes(key)) continue;
    for (const item of list) {
      if (seen.has(item.label)) continue;
      seen.add(item.label);
      matched.push(item);
    }
  }
  if (gender === "all") return matched;
  return matched.filter((s) => s.gender === "both" || s.gender === gender);
}

/** Helper: convert a list of suggestions to the persisted ProductFeature
 *  shape used by the data layer. */
export function defaultFeaturesFor(
  productName: string,
  gender: FeatureGender | "all" = "all",
): ProductFeature[] {
  return getProductSuggestions(productName, gender).map((s) => ({
    label: s.label,
    gender: s.gender,
  }));
}
