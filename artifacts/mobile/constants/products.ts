import { Product } from "@/types";

export const DEFAULT_PRODUCTS: Product[] = [
  { id: "shirt", name: "Shirt", price: 500 },
  { id: "pant", name: "Pant", price: 700 },
  { id: "blazer", name: "Blazer", price: 2000 },
  { id: "kurta", name: "Kurta", price: 600 },
  { id: "lenga", name: "Lenga", price: 2500 },
  { id: "coat", name: "Coat", price: 3000 },
  { id: "safari_suit", name: "Safari Suit", price: 1800 },
  { id: "jacket", name: "Jacket", price: 1500 },
  { id: "school_uniform", name: "School Uniform", price: 800 },
];

export const MEASUREMENT_FIELDS = [
  { key: "chest", label: "Chest" },
  { key: "shoulder", label: "Shoulder" },
  { key: "neck", label: "Neck" },
  { key: "sleeve", label: "Sleeve" },
  { key: "waist", label: "Waist" },
  { key: "length", label: "Length" },
  { key: "hip", label: "Hip" },
  { key: "thigh", label: "Thigh" },
  { key: "pantLength", label: "Pant Length" },
  { key: "bottomWidth", label: "Bottom Width" },
  { key: "armhole", label: "Armhole" },
  { key: "wrist", label: "Wrist" },
] as const;

export type MeasurementKey = (typeof MEASUREMENT_FIELDS)[number]["key"];

export const GST_RATES = [0, 5, 12, 18];
