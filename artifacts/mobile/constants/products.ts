import { MeasurementKey } from "./measurementFields";

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
