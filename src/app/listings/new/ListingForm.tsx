"use client";

import { useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { createListing } from "./actions";
import { ListingCondition, ListingType, RentalPeriod } from "@/generated/prisma/enums";
import {
  CONDITION_LABELS,
  LISTING_TYPE_LABELS,
  RENTAL_PERIOD_LABELS,
} from "@/lib/listing-labels";
import { uploadToStorage } from "@/lib/upload-to-storage";

type Category = {
  id: string;
  name: string;
};

/** What the form is currently doing, so the button can say something useful. */
type Stage =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "uploading"; percent: number | null }
  | { kind: "saving" };

export function ListingForm({ categories }: { categories: Category[] }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<ListingCondition>(ListingCondition.GOOD);
  const [type, setType] = useState<ListingType>(ListingType.SALE);
  const [rentalPeriod, setRentalPeriod] = useState<RentalPeriod>(RentalPeriod.WEEK);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  const submitting = stage.kind !== "idle";

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
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
      const result = await createListing({
        title,
        description,
        price,
        condition,
        type,
        // Ignored by the server for a sale, but sent unconditionally so the
        // client holds no opinion about which fields matter.
        rentalPeriod,
        categoryId,
        imageKey,
      });

      // createListing only returns when something went wrong; on success it
      // redirects. Returned failures carry a real message, unlike thrown ones
      // which Next masks in production builds.
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
        return "Saving listing...";
      default:
        return "Post listing";
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg">
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Listing type</legend>
        <div className="flex flex-wrap gap-2">
          {Object.values(ListingType).map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded border px-4 py-2 text-sm ${
                type === value
                  ? "border-foreground bg-foreground font-medium text-background"
                  : "border-zinc-300 dark:border-zinc-700"
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

      <div className="flex flex-col gap-1">
        <label htmlFor="price" className="text-sm font-medium">
          {type === ListingType.RENT ? "Rental price (RM)" : "Price (RM)"}
        </label>
        <input
          id="price"
          type="text"
          inputMode="decimal"
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {type === ListingType.RENT && (
        <div className="flex flex-col gap-1">
          <label htmlFor="rentalPeriod" className="text-sm font-medium">
            Price is per
          </label>
          <select
            id="rentalPeriod"
            value={rentalPeriod}
            onChange={(e) => setRentalPeriod(e.target.value as RentalPeriod)}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {Object.values(RentalPeriod).map((value) => (
              <option key={value} value={value}>
                {RENTAL_PERIOD_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="condition" className="text-sm font-medium">
          Condition
        </label>
        <select
          id="condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value as ListingCondition)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {Object.values(ListingCondition).map((value) => (
            <option key={value} value={value}>
              {CONDITION_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="text-sm font-medium">
          Category
        </label>
        <select
          id="category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="image" className="text-sm font-medium">
          Photo (optional)
        </label>
        <input
          id="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
        />
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Selected preview"
            className="mt-2 h-40 w-40 rounded object-cover"
          />
        )}
      </div>

      {stage.kind === "uploading" && (
        <div className="flex flex-col gap-1" aria-live="polite">
          <div className="h-2 w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full bg-foreground transition-[width] duration-200"
              style={{ width: `${stage.percent ?? 0}%` }}
            />
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {stage.percent === null
              ? "Uploading photo..."
              : `Uploading photo... ${stage.percent}%`}
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !categoryId}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {buttonLabel()}
      </button>
    </form>
  );
}
