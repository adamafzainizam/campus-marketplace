"use client";

import { useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { createListing } from "./actions";
import { ListingCondition } from "@/generated/prisma/enums";
import { CONDITION_LABELS } from "@/lib/listing-labels";

type Category = {
  id: string;
  name: string;
};

export function ListingForm({ categories }: { categories: Category[] }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<ListingCondition>(ListingCondition.GOOD);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  async function uploadImage(selectedFile: File): Promise<string> {
    const uploadRequest = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: selectedFile.type,
        fileSize: selectedFile.size,
      }),
    });

    if (!uploadRequest.ok) {
      const { error: message } = await uploadRequest.json();
      throw new Error(message ?? "Could not prepare image upload.");
    }

    const { uploadUrl, key } = await uploadRequest.json();

    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": selectedFile.type },
      body: selectedFile,
    });

    if (!putResponse.ok) {
      throw new Error("Image upload to storage failed.");
    }

    return key;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const imageKey = file ? await uploadImage(file) : null;
      await createListing({
        title,
        description,
        price,
        condition,
        categoryId,
        imageKey,
      });
    } catch (err) {
      unstable_rethrow(err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
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

      <div className="flex flex-col gap-1">
        <label htmlFor="price" className="text-sm font-medium">
          Price (RM)
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !categoryId}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {submitting ? "Posting..." : "Post listing"}
      </button>
    </form>
  );
}
