import { ListingCondition } from "@/generated/prisma/enums";

export const CONDITION_LABELS: Record<ListingCondition, string> = {
  NEW: "New",
  LIKE_NEW: "Like new",
  GOOD: "Good",
  FAIR: "Fair",
  WORN: "Worn",
};
