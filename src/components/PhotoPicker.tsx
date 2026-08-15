"use client";

import { useRef, useState } from "react";
import {
  imageExtensionFor,
  isValidFileSize,
  MAX_FILE_SIZE,
  MAX_LISTING_PHOTOS,
} from "@/lib/upload-constraints";

/**
 * One photo held by the form.
 *
 * `existing` photos are already in R2 and carry the key that will be saved.
 * `new` photos are files chosen in this session and have no key until the form
 * uploads them on submit. Keeping both in one ordered list is what lets
 * "remove" and "make cover" work identically regardless of where a photo came
 * from — the alternative, two parallel lists, makes reordering across them a
 * special case, and special cases are where ordering bugs live.
 */
export type Photo =
  | { kind: "existing"; key: string; url: string }
  | { kind: "new"; file: File; url: string };

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
 * Files are checked here against the same constraints the server enforces, so
 * an oversized or wrong-typed file is refused instantly rather than after a
 * round trip. This is a courtesy, not a control: `/api/upload` re-checks
 * everything, because nothing arriving from a browser can be trusted.
 *
 * The first photo is the cover. That is stated on screen rather than left as
 * folklore, and "Make cover" moves a photo to the front rather than offering
 * drag-and-drop — this app deliberately has no drag interactions.
 */
export function PhotoPicker({
  id,
  label,
  photos,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  photos: Photo[];
  disabled: boolean;
  onChange: (photos: Photo[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  const full = photos.length >= MAX_LISTING_PHOTOS;
  const remaining = MAX_LISTING_PHOTOS - photos.length;

  /**
   * Accepts as many of the chosen files as there is room for, reporting the
   * first problem rather than silently dropping files. A bad file among good
   * ones does not discard the good ones.
   */
  function accept(candidates: FileList | null) {
    setRejected(null);
    if (!candidates || candidates.length === 0) return;

    const accepted: Photo[] = [];
    let problem: string | null = null;

    for (const candidate of Array.from(candidates)) {
      if (accepted.length >= remaining) {
        problem =
          remaining === 0
            ? `You already have ${MAX_LISTING_PHOTOS} photos.`
            : `Only ${MAX_LISTING_PHOTOS} photos per listing, so the rest were skipped.`;
        break;
      }
      if (!imageExtensionFor(candidate.type)) {
        problem = `${candidate.name} needs to be a JPEG, PNG, or WebP image.`;
        continue;
      }
      if (!isValidFileSize(candidate.size)) {
        problem = `${candidate.name} is ${formatBytes(candidate.size)}. The limit is ${formatBytes(MAX_FILE_SIZE)}.`;
        continue;
      }
      accepted.push({
        kind: "new",
        file: candidate,
        url: URL.createObjectURL(candidate),
      });
    }

    if (problem) setRejected(problem);
    if (accepted.length > 0) onChange([...photos, ...accepted]);

    // Without this the same file cannot be re-selected after being removed:
    // the input still holds it, so `change` never fires.
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(index: number) {
    const photo = photos[index];
    // Object URLs for files chosen this session are ours to release.
    if (photo.kind === "new") URL.revokeObjectURL(photo.url);
    onChange(photos.filter((_, i) => i !== index));
  }

  function makeCover(index: number) {
    const next = [...photos];
    const [photo] = next.splice(index, 1);
    onChange([photo, ...next]);
  }

  return (
    <div className="field-group">
      <span className="label">
        {label}
        {photos.length > 0 && (
          <span className="ml-2 font-normal text-secondary">
            {photos.length} of {MAX_LISTING_PHOTOS}
          </span>
        )}
      </span>

      {/* Hidden rather than disabled at the cap: a disabled drop zone invites
          a click that does nothing, which reads as broken. */}
      {!full && (
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
            accept(event.dataTransfer.files);
          }}
          className={`dropzone ${dragging ? "dropzone-active" : ""} ${
            disabled ? "dropzone-disabled" : ""
          }`}
        >
          <input
            ref={inputRef}
            id={id}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={(event) => accept(event.target.files)}
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
            {photos.length === 0 ? "Add photos" : "Add another"}
          </span>
          <span className="text-fine text-secondary">
            Drag them here, or click to browse &middot; JPEG, PNG or WebP, up to{" "}
            {formatBytes(MAX_FILE_SIZE)} each
          </span>
        </label>
      )}

      {rejected && (
        <p role="alert" className="notice notice-danger">
          {rejected}
        </p>
      )}

      {photos.length > 0 && (
        <ul className="mt-1 grid grid-cols-3 gap-3">
          {photos.map((photo, index) => (
            <li key={photo.kind === "existing" ? photo.key : photo.url}>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
                  className="aspect-square w-full rounded-lg border border-line object-cover shadow-sm"
                />
                {index === 0 && (
                  <span className="badge badge-accent absolute left-1 top-1">
                    Cover
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap gap-1">
                {index !== 0 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => makeCover(index)}
                    className="btn btn-ghost btn-sm"
                  >
                    Make cover
                  </button>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => remove(index)}
                  className="btn btn-ghost btn-sm"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {photos.length > 0 && (
        <p className="hint">
          The first photo is the cover — it is the one shown on the browse page
          and in messages.
        </p>
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
