/** Normalized extras the assistant can extract from customer messages. */
export const EXTRA_ITEM_VALUES = [
  "baby_seat",
  "booster_seat",
  "bicycle",
  "golf_bag",
  "sports_equipment",
  "pet_box",
  "pushchair",
  "wheelchair",
  "other",
] as const;

export type ExtraItem = (typeof EXTRA_ITEM_VALUES)[number];

export const EXTRA_ITEM_LABELS: Record<ExtraItem, string> = {
  baby_seat: "Baby seat",
  booster_seat: "Booster seat",
  bicycle: "Bicycle",
  golf_bag: "Golf bag",
  sports_equipment: "Sports equipment",
  pet_box: "Pet box",
  pushchair: "Pushchair / stroller",
  wheelchair: "Wheelchair",
  other: "Other",
};

export function isExtraItem(value: string): value is ExtraItem {
  return (EXTRA_ITEM_VALUES as readonly string[]).includes(value);
}
