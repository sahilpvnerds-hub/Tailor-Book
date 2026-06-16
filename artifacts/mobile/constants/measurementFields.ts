export const MEASUREMENT_FIELDS = [
  { key: "chest",       label: "Chest" },
  { key: "shoulder",    label: "Shoulder" },
  { key: "neck",        label: "Neck" },
  { key: "sleeve",      label: "Sleeve" },
  { key: "waist",       label: "Waist" },
  { key: "length",      label: "Length" },
  { key: "hip",         label: "Hip" },
  { key: "thigh",       label: "Thigh" },
  { key: "pantLength",  label: "Pant Length" },
  { key: "bottomWidth", label: "Bottom Width" },
  { key: "armhole",     label: "Armhole" },
  { key: "wrist",       label: "Wrist" },
] as const;

export type MeasurementKey = (typeof MEASUREMENT_FIELDS)[number]["key"];
