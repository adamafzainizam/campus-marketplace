"use client";

import Link from "next/link";
import { useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { createListing, updateListing } from "./actions";
import {
  ListingCondition,
  ListingType,
  RentalPeriod,
  ServiceRate,
} from "@/generated/prisma/enums";
import {
  CONDITION_LABELS,
  LISTING_TYPE_LABELS,
  RENTAL_PERIOD_LABELS,
  SERVICE_RATE_LABELS,
} from "@/lib/listing-labels";
import { PhotoPicker, type Photo } from "@/components/PhotoPicker";
import { uploadToStorage } from "@/lib/upload-to-storage";
import {
  isOtherCategorySlug,
  MAX_OTHER_CATEGORY_LENGTH,
} from "@/lib/category-order";
import {
  HALAL_NOT_VERIFIED,
  HALAL_STATUSES,
  halalOptionHint,
  halalOptionLabel,
  isFoodCategorySlug,
} from "@/lib/halal";
import { MAX_QUANTITY, MIN_QUANTITY } from "@/lib/listing-quantity";
import { legalPath } from "@/lib/legal";
import { HalalStatus } from "@/generated/prisma/enums";

type Category = {
  id: string;
  name: string;
  /** Needed to recognise the catch-all; matched by slug, never by label. */
  slug: string;
};

/**
 * The listing being edited, when the form is in edit mode. Absent means a new
 * listing. Kept as one optional prop rather than a `mode` flag plus separate
 * initial values, so it is impossible to be in edit mode without the values.
 */
export type EditableListing = {
  id: string;
  title: string;
  description: string;
  price: string;
  condition: ListingCondition | null;
  type: ListingType;
  rentalPeriod: RentalPeriod | null;
  serviceRate: ServiceRate | null;
  categoryId: string;
  otherCategory: string | null;
  quantity: number;
  halalStatus: HalalStatus | null;
  imageKeys: string[];
};

/** What the form is currently doing, so the button can say something useful. */
type Stage =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "uploading"; percent: number | null }
  | { kind: "saving" };

export function ListingForm({
  categories,
  listing,
  existingPhotos = [],
}: {
  categories: Category[];
  listing?: EditableListing;
  /** Photos already saved on this listing, when editing: key plus a URL. */
  existingPhotos?: { key: string; url: string }[];
}) {
  const editing = listing !== undefined;

  const [title, setTitle] = useState(listing?.title ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [price, setPrice] = useState(listing?.price ?? "");
  const [condition, setCondition] = useState<ListingCondition>(
    listing?.condition ?? ListingCondition.GOOD,
  );
  const [type, setType] = useState<ListingType>(listing?.type ?? ListingType.SALE);
  const [rentalPeriod, setRentalPeriod] = useState<RentalPeriod>(
    listing?.rentalPeriod ?? RentalPeriod.WEEK,
  );
  const [categoryId, setCategoryId] = useState(
    listing?.categoryId ?? categories[0]?.id ?? "",
  );
  const [otherCategory, setOtherCategory] = useState(
    listing?.otherCategory ?? "",
  );
  const [serviceRate, setServiceRate] = useState<ServiceRate>(
    listing?.serviceRate ?? ServiceRate.HOUR,
  );
  const [quantity, setQuantity] = useState(String(listing?.quantity ?? MIN_QUANTITY));
  const [hasMany, setHasMany] = useState((listing?.quantity ?? 1) > 1);
  const [halalStatus, setHalalStatus] = useState<string>(
    listing?.halalStatus ?? "",
  );
  const [photos, setPhotos] = useState<Photo[]>(() =>
    existingPhotos.map((photo) => ({ kind: "existing", ...photo })),
  );
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  const submitting = stage.kind !== "idle";

  // Derived from the selected category rather than tracked separately, so the
  // field cannot be left showing after the seller moves off "Other".
  const selectedSlug = categories.find(
    (category) => category.id === categoryId,
  )?.slug;
  const otherSelected = isOtherCategorySlug(selectedSlug);
  const foodSelected = isFoodCategorySlug(selectedSlug);
  const isService = type === ListingType.SERVICE;

  async function uploadImage(selectedFile: File): Promise<string> {
    setStage({ kind: "preparing" });

    let uploadRequest: Response;
    try {
      uploadRequest = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: selectedFile.type,
          fileSize: selectedFile.size,
        }),
      });
    } catch {
      throw new Error("Could not reach the server. Check your connection and try again.");
    }

    if (!uploadRequest.ok) {
      const { error: message } = await uploadRequest.json().catch(() => ({ error: null }));
      throw new Error(message ?? "Could not prepare the image upload.");
    }

    const { uploadUrl, key } = await uploadRequest.json();

    setStage({ kind: "uploading", percent: 0 });
    await uploadToStorage(uploadUrl, selectedFile, ({ percent }) => {
      setStage({ kind: "uploading", percent });
    });

    return key;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      // Uploaded in order so the array the server receives is the order the
      // seller arranged, and the cover stays the cover.
      const imageKeys: string[] = [];
      for (const photo of photos) {
        imageKeys.push(
          photo.kind === "existing" ? photo.key : await uploadImage(photo.file),
        );
      }
      setStage({ kind: "saving" });

      const fields = {
        title,
        description,
        price,
        condition,
        type,
        // Ignored by the server for a sale, but sent unconditionally so the
        // client holds no opinion about which fields matter. The two price
        // units are siblings and must stay together: serviceRate was missing
        // from this object from the day services shipped, so every attempt to
        // post one was rejected for a field the person had actually filled in.
        rentalPeriod,
        serviceRate,
        categoryId,
        // Sent unconditionally for the same reason as rentalPeriod: the server
        // decides whether it applies, and discards it when it does not.
        otherCategory,
        // Both sent unconditionally, for the same reason as rentalPeriod: the
        // server decides whether each applies and discards it when it does not.
        quantity: hasMany ? quantity : String(MIN_QUANTITY),
        halalStatus,
      };

      const result = editing
        ? await updateListing(listing.id, {
            ...fields,
            // Always sent when editing: the picker holds the full intended
            // set, so an edit that removed every photo must be able to say so.
            imageKeys,
          })
        : await createListing({ ...fields, imageKeys });

      // Both only return when something went wrong; on success they redirect.
      // Returned failures carry a real message, unlike thrown ones which Next
      // masks in production builds.
      if (result && !result.ok) {
        setError(result.error);
        setStage({ kind: "idle" });
        return;
      }
    } catch (err) {
      unstable_rethrow(err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage({ kind: "idle" });
    }
  }

  function buttonLabel(): string {
    switch (stage.kind) {
      case "preparing":
        return "Preparing upload...";
      case "uploading":
        return stage.percent === null
          ? "Uploading photo..."
          : `Uploading photo... ${stage.percent}%`;
      case "saving":
        return editing ? "Saving changes..." : "Saving listing...";
      default:
        return editing ? "Save changes" : "Post listing";
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="field-group">
        <label htmlFor="title" className="label">
          Title
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field"
        />
      </div>

      <div className="field-group">
        <label htmlFor="description" className="label">
          Description
        </label>
        <textarea
          id="description"
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="field"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1">Listing type</legend>
        <div className="flex flex-wrap gap-2">
          {Object.values(ListingType).map((value) => (
            <label
              key={value}
              className={`chip cursor-pointer ${
 type === value
 ? "chip-selected"
 : "border-line"
 }`}
            >
              <input
                type="radio"
                name="listingType"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="sr-only"
              />
              {LISTING_TYPE_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field-group">
        <label htmlFor="price" className="label">
          {type === ListingType.RENT ? "Rental price (RM)" : "Price (RM)"}
        </label>
        <input
          id="price"
          type="text"
          inputMode="decimal"
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="field"
        />
      </div>

      {type === ListingType.RENT && (
        <div className="field-group">
          <label htmlFor="rentalPeriod" className="label">
            Price is per
          </label>
          <select
            id="rentalPeriod"
            value={rentalPeriod}
            onChange={(e) => setRentalPeriod(e.target.value as RentalPeriod)}
            className="field"
          >
            {Object.values(RentalPeriod).map((value) => (
              <option key={value} value={value}>
                {RENTAL_PERIOD_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      )}

      {isService && (
        <div className="field-group">
          <label htmlFor="serviceRate" className="label">
            Price is per
          </label>
          <select
            id="serviceRate"
            value={serviceRate}
            onChange={(e) => setServiceRate(e.target.value as ServiceRate)}
            className="field"
          >
            {Object.values(ServiceRate).map((value) => (
              <option key={value} value={value}>
                {value === ServiceRate.FIXED
                  ? "the whole job (fixed price)"
                  : SERVICE_RATE_LABELS[value]}
              </option>
            ))}
          </select>

          {/* The rule put where the decision is made, rather than behind a
              link. Services is precisely where assignment-writing gets
              advertised, and the Acceptable Use Policy already bans it. */}
          <p className="notice notice-neutral mt-1">
            Tutoring, printing, repairs and skills are all welcome. Writing or
            completing someone else&rsquo;s assignment is not &mdash; see the{" "}
            <Link
              href={legalPath("acceptable-use")}
              className="underline underline-offset-2"
            >
              Acceptable Use Policy
            </Link>
            .
          </p>
        </div>
      )}

      {/* An hour of somebody's time has no condition. Hidden here and
          discarded server-side, so the two cannot disagree. */}
      {!isService && (
      <div className="field-group">
        <label htmlFor="condition" className="label">
          Condition
        </label>
        <select
          id="condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value as ListingCondition)}
          className="field"
        >
          {Object.values(ListingCondition).map((value) => (
            <option key={value} value={value}>
              {CONDITION_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      )}

      <div className="field-group">
        <label htmlFor="category" className="label">
          Category
        </label>
        <select
          id="category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="field"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* Only when the catch-all is chosen. "Other" on its own tells a buyer
          nothing and tells us nothing about which category is missing, which
          is the more useful of the two. */}
      {otherSelected && (
        <div className="field-group">
          <label htmlFor="otherCategory" className="label">
            What kind of item is it?
          </label>
          <input
            id="otherCategory"
            value={otherCategory}
            onChange={(e) => setOtherCategory(e.target.value)}
            maxLength={MAX_OTHER_CATEGORY_LENGTH}
            className="field"
            placeholder="e.g. Bicycle parts, Lab coat, Concert ticket"
          />
          <p className="hint">
            A couple of words. This is shown on your listing, and it tells us
            which categories are missing.
          </p>
        </div>
      )}

      {/* Food only. Silence about a dietary restriction is the harmful state,
          so a choice is required — and "I'd rather not say" exists so that
          requiring one never forces a false claim. */}
      {foodSelected && (
        <fieldset className="field-group">
          <legend className="label mb-1">Is this halal?</legend>
          <div className="space-y-2">
            {HALAL_STATUSES.map((value) => (
              <label
                key={value}
                htmlFor={`halal-${value}`}
                className="flex cursor-pointer gap-2"
              >
                <input
                  type="radio"
                  id={`halal-${value}`}
                  name="halalStatus"
                  value={value}
                  checked={halalStatus === value}
                  onChange={() => setHalalStatus(value)}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="label">
                    {halalOptionLabel(value)}
                  </span>
                  <span className="block text-fine text-secondary">
                    {halalOptionHint(value)}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="hint">{HALAL_NOT_VERIFIED}</p>
        </fieldset>
      )}

      {/* Not food-specific: textbooks, lab coats and calculators are all sold
          in numbers greater than one. */}
      <div className="field-group">
        <label htmlFor="hasMany" className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            id="hasMany"
            checked={hasMany}
            onChange={(e) => {
              setHasMany(e.target.checked);
              if (!e.target.checked) setQuantity(String(MIN_QUANTITY));
            }}
          />
          <span className="text-sm">I have more than one of these</span>
        </label>

        {hasMany && (
          <>
            <label htmlFor="quantity" className="label mt-1">
              How many?
            </label>
            <input
              id="quantity"
              type="number"
              inputMode="numeric"
              min={MIN_QUANTITY}
              max={MAX_QUANTITY}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="field"
            />
            <p className="hint">
              Buyers see &ldquo;{quantity || "0"} available&rdquo;. Nothing is
              counted automatically &mdash; no money goes through this site, so
              you&rsquo;ll need to update this yourself as they go.
            </p>
          </>
        )}
      </div>

      <PhotoPicker
        id="image"
        label="Photos (optional)"
        photos={photos}
        disabled={submitting}
        onChange={setPhotos}
      />

      {stage.kind === "uploading" && (
        <div className="field-group" aria-live="polite">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${stage.percent ?? 0}%` }}
            />
          </div>
          <p className="text-fine text-secondary">
            {stage.percent === null
              ? "Uploading photo..."
              : `Uploading photo... ${stage.percent}%`}
          </p>
        </div>
      )}

      {error && (
        <p className="notice notice-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !categoryId}
        className="btn btn-primary w-full"
      >
        {buttonLabel()}
      </button>
    </form>
  );
}
