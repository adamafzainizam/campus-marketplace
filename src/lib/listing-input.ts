/**
 * Validates the full set of listing fields, shared by creation and editing.
 *
 * Both actions accept exactly the same shape and must apply exactly the same
 * rules — duplicating them is how an edit form quietly accepts something the
 * create form rejects. This module is the single place those rules are
 * assembled; the individual rules themselves live in `listing-constraints.ts`.
 *
 * Relative imports with explicit extensions: reached by a test, so the `@/`
 * alias would fail at runtime (Known Gotchas #21 and #23).
 */

import {
  validateCondition,
  validateDescription,
  validateId,
  validateListingType,
  validatePrice,
  validateRentalPeriod,
  validateServiceRate,
  validateTitle,
  type Result,
} from "./listing-constraints.ts";
import type {
  ListingCondition,
  ListingType,
  RentalPeriod,
  ServiceRate,
} from "../generated/prisma/enums.ts";

export type ValidatedListingInput = {
  title: string;
  description: string;
  price: string;
  condition: ListingCondition | null;
  categoryId: string;
  type: ListingType;
  rentalPeriod: RentalPeriod | null;
  serviceRate: ServiceRate | null;
};

/**
 * Returns every validated field, or the first error encountered.
 *
 * Takes `unknown`: a server action is a public POST endpoint, so the payload
 * is untrusted regardless of which form produced it.
 */
export function validateListingInput(input: unknown): Result<ValidatedListingInput> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Invalid request." };
  }
  const raw = input as Record<string, unknown>;

  const title = validateTitle(raw.title);
  if (!title.ok) return title;

  const description = validateDescription(raw.description);
  if (!description.ok) return description;

  const price = validatePrice(raw.price);
  if (!price.ok) return price;

  const categoryId = validateId(raw.categoryId, "Category");
  if (!categoryId.ok) return categoryId;

  // Type first: three other fields are contextual on it.
  const type = validateListingType(raw.type);
  if (!type.ok) return type;

  const condition = validateCondition(raw.condition, type.value);
  if (!condition.ok) return condition;

  // Required for a service, discarded otherwise, so a crafted payload can't
  // leave a sale rendering as "RM 30 / hour".
  const serviceRate = validateServiceRate(raw.serviceRate, type.value);
  if (!serviceRate.ok) return serviceRate;

  // Contextual on the type: required for a rental, discarded for a sale, so a
  // crafted payload can't leave a sale rendering as "RM 20.00 / week".
  const rentalPeriod = validateRentalPeriod(raw.rentalPeriod, type.value);
  if (!rentalPeriod.ok) return rentalPeriod;

  return {
    ok: true,
    value: {
      title: title.value,
      description: description.value,
      price: price.value,
      condition: condition.value,
      categoryId: categoryId.value,
      type: type.value,
      rentalPeriod: rentalPeriod.value,
      serviceRate: serviceRate.value,
    },
  };
}
