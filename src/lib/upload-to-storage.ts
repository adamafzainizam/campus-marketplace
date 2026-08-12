/**
 * Browser-side upload of a file to a presigned storage URL.
 *
 * Uses XMLHttpRequest rather than fetch for one reason: fetch cannot report
 * upload progress. There is no way to observe bytes-sent with fetch, so a large
 * photo on a slow connection produces a frozen button and no feedback. XHR
 * exposes `upload.onprogress`, which is what makes a progress bar possible.
 */

export type UploadProgress = {
  /** 0-100, or null while the total size is still unknown. */
  percent: number | null;
};

const UPLOAD_TIMEOUT_MS = 120_000;

export function uploadToStorage(
  url: string,
  file: File,
  onProgress: (progress: UploadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.timeout = UPLOAD_TIMEOUT_MS;

    xhr.upload.addEventListener("progress", (event) => {
      onProgress({
        percent: event.lengthComputable
          ? Math.round((event.loaded / event.total) * 100)
          : null,
      });
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      // The storage provider answered, but refused the upload. A 403 here
      // usually means the presigned URL expired mid-upload.
      reject(
        new Error(
          xhr.status === 403
            ? "The upload link expired before the photo finished sending. Please try again."
            : `Image storage rejected the upload (error ${xhr.status}).`,
        ),
      );
    });

    // Fires when the request never completed at network level: DNS failure,
    // connection dropped, blocked by an extension, or CORS. Deliberately
    // distinct from the "load" path above, where we did get a response.
    xhr.addEventListener("error", () => {
      reject(
        new Error(
          "Could not reach image storage. Check your internet connection and try again.",
        ),
      );
    });

    xhr.addEventListener("timeout", () => {
      reject(
        new Error(
          "The photo upload timed out. Your connection may be slow — try again, or use a smaller image.",
        ),
      );
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled."));
    });

    xhr.send(file);
  });
}
