"use client";

import { useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { createListing, updateListing } from "./actions";
import { ListingCondition, ListingType, RentalPeriod } from "@/generated/prisma/enums";
import {
  CONDITION_LABELS,
  LISTING_TYPE_LABELS,
  RENTAL_PERIOD_LABELS,
} from "@/lib/listing-labels";
import { PhotoPicker } from "@/components/PhotoPicker";
import { uploadToStorage } from "@/lib/upload-to-storage";

type Category = {
  id: string;
  name: string;
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
  condition: ListingCondition;
  type: ListingType;
  rentalPeriod: RentalPeriod | null;
  categoryId: string;
  imageUrl: string | null;
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
  existingImageUrl,
}: {
  categories: Category[];
  listing?: EditableListing;
  /** Displayable URL for the current photo, when editing. */
  existingImageUrl?: string | null;
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
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  const submitting = stage.kind !== "idle";

  function handleFileSelected(selected: File | null) {
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

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
      const imageKey = file ? await uploadImage(file) : null;
      setStage({ kind: "saving" });

      const fields = {
        title,
        description,
        price,
        condition,
        type,
        // Ignored by the server for a sale, but sent unconditionally so the
        // client holds no opinion about which fields matter.
        rentalPeriod,
        categoryId,
      };

      const result = editing
        ? await updateListing(listing.id, {
            ...fields,
            // Omitted entirely when no new photo was chosen, so an edit that
            // doesn't touch the image doesn't clear it. Sending null would
            // mean "remove the photo".
            ...(imageKey === null ? {} : { imageKey }),
          })
        : await createListing({ ...fields, imageKey });

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
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

      <div className="flex flex-col gap-1.5">
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

      <div className="flex flex-col gap-1.5">
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
        <div className="flex flex-col gap-1.5">
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

      <div className="flex flex-col gap-1.5">
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

      <div className="flex flex-col gap-1.5">
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

      <PhotoPicker
        id="image"
        label={editing ? "Replace photo (optional)" : "Photo (optional)"}
        file={file}
        previewUrl={previewUrl}
        existingImageUrl={existingImageUrl ?? null}
        editing={editing}
        disabled={submitting}
        onFileChange={handleFileSelected}
      />

      {stage.kind === "uploading" && (
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${stage.percent ?? 0}%` }}
            />
          </div>
          <p className="text-xs text-secondary">
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
