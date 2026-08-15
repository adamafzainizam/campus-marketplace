"use client";

import { useRef, useState } from "react";
import {
  imageExtensionFor,
  isValidFileSize,
  MAX_FILE_SIZE,
} from "@/lib/upload-constraints";

/**
 * Photo chooser: a drop zone that also works as an ordinary button.
 *
 * The bare `<input type="file">` it replaces rendered as small underlined
 * text that did not look clickable, which is what prompted this — a control
 * whose most important job is being obviously pressable.
 *
 * Accessibility is the reason for the shape of it. The real `<input>` is still
 * there, still focusable, and the whole zone is its `<label>` — so a click
 * anywhere in the zone opens the picker, and a keyboard user tabs to a real
 * file input and presses Enter exactly as they would anywhere else. Drag and
 * drop is layered on top and is never the only way in.
 *
 * The file is checked here against the same constraints the server enforces,
 * so an oversized or wrong-typed file is refused instantly rather than after a
 * round trip. This is a courtesy, not a control: `/api/upload` re-checks
 * everything, because nothing arriving from a browser can be trusted.
 */
export function PhotoPicker({
  id,
  label,
  file,
  previewUrl,
  existingImageUrl,
  editing,
  disabled,
  onFileChange,
}: {
  id: string;
  label: string;
  file: File | null;
  previewUrl: string | null;
  existingImageUrl: string | null;
  editing: boolean;
  disabled: boolean;
  onFileChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  function accept(candidate: File | null) {
    setRejected(null);
    if (!candidate) {
      onFileChange(null);
      return;
    }

    if (!imageExtensionFor(candidate.type)) {
      setRejected("That needs to be a JPEG, PNG, or WebP image.");
      return;
    }
    if (!isValidFileSize(candidate.size)) {
      setRejected(
        `That photo is ${formatBytes(candidate.size)}. The limit is ${formatBytes(MAX_FILE_SIZE)}.`,
      );
      return;
    }

    onFileChange(candidate);
  }

  const shownImage = previewUrl ?? existingImageUrl;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="label">{label}</span>

      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (disabled) return;
          accept(event.dataTransfer.files?.[0] ?? null);
        }}
        className={`dropzone ${dragging ? "dropzone-active" : ""} ${
          disabled ? "dropzone-disabled" : ""
        }`}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          onChange={(event) => accept(event.target.files?.[0] ?? null)}
          className="sr-only"
        />

        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-7 w-7 text-tertiary"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 16V4m0 0L8 8m4-4 4 4" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>

        <span className="text-sm font-medium">
          {file ? "Choose a different photo" : "Add a photo"}
        </span>
        <span className="text-fine text-secondary">
          Drag one here, or click to browse &middot; JPEG, PNG or WebP, up to{" "}
          {formatBytes(MAX_FILE_SIZE)}
        </span>
      </label>

      {rejected && (
        <p role="alert" className="notice notice-danger">
          {rejected}
        </p>
      )}

      {file && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-fine text-secondary">
            {file.name} &middot; {formatBytes(file.size)}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              accept(null);
              // Without this the same file cannot be re-selected after being
              // removed: the input still holds it, so `change` never fires.
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="btn btn-ghost btn-sm"
          >
            Remove
          </button>
        </div>
      )}

      {/* The chosen file wins over the stored one, so the preview always shows
          what will actually be saved. */}
      {shownImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shownImage}
            alt={previewUrl ? "Selected preview" : "Current photo"}
            className="mt-1 h-40 w-40 rounded-lg border border-line object-cover shadow-sm"
          />
          {editing && !previewUrl && (
            <p className="hint">Leave this empty to keep the current photo.</p>
          )}
        </>
      )}
    </div>
  );
}

/** "992 KB", "4.7 MB" — sizes people can compare to what their phone produces. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
