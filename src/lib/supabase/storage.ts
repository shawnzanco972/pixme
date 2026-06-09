/**
 * Supabase Storage helpers for the 'uploads' bucket (customer photos).
 *
 * Design (see IMPLEMENTATION_PLAN.md Phase 1.2):
 *  - Bucket is PRIVATE. Reads happen via short-lived signed download URLs,
 *    available only to authenticated admins (enforced by Storage RLS).
 *  - Uploads use **signed upload URLs**: trusted server code mints a one-time
 *    token, the browser PUTs the file straight to Storage with that token.
 *
 * These functions take the Supabase client as an argument (dependency
 * injection) so the module stays isomorphic:
 *  - mint signed URLs on the SERVER with `createAdminClient()`
 *  - upload from the BROWSER with the anon client from `createClient()`
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

export const UPLOADS_BUCKET = "uploads" as const;

type Client = SupabaseClient<Database>;

/** Public bucket for ready-made design artwork (shown on the marketing site). */
export const DESIGNS_BUCKET = "designs" as const;

/**
 * Public URL for an object in the public 'designs' bucket. No signing needed —
 * the bucket is public, so this is a stable, cacheable URL.
 */
export function designPublicUrl(client: Client, path: string): string {
  return client.storage.from(DESIGNS_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Map a MIME type to a safe file extension for object paths. */
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function extensionForMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? "bin";
}

// --- Path builders (pure) --------------------------------------------------

/** Storage path for a B2C customer's original photo: `b2c/{orderId}/original.{ext}`. */
export function b2cOriginalPhotoPath(orderId: string, mime: string): string {
  return `b2c/${orderId}/original.${extensionForMime(mime)}`;
}

/**
 * Storage path for a B2B employee submission photo:
 * `b2b/{workspaceId}/{submissionId}.{ext}`.
 */
export function b2bSubmissionPhotoPath(
  workspaceId: string,
  submissionId: string,
  mime: string,
): string {
  return `b2b/${workspaceId}/${submissionId}.${extensionForMime(mime)}`;
}

// --- Signed upload (SERVER mints, BROWSER uploads) -------------------------

export interface SignedUpload {
  /** Object path within the bucket. */
  path: string;
  /** One-time token authorizing the upload to `path`. */
  token: string;
  /** Fully-qualified signed URL the client can PUT to. */
  signedUrl: string;
}

/**
 * SERVER-side: mint a one-time signed upload URL for `path`.
 * Call with `createAdminClient()` (service role) from a Route Handler / action.
 */
export async function createSignedUploadUrl(
  client: Client,
  path: string,
): Promise<SignedUpload> {
  const { data, error } = await client.storage
    .from(UPLOADS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(
      `Failed to create signed upload URL for "${path}": ${error?.message ?? "unknown error"}`,
    );
  }
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * BROWSER-side: upload a file to a previously-minted signed upload URL.
 * Call with the anon client from `createClient()`.
 */
export async function uploadToSignedUrl(
  client: Client,
  path: string,
  token: string,
  file: File | Blob,
): Promise<{ path: string }> {
  const { data, error } = await client.storage
    .from(UPLOADS_BUCKET)
    .uploadToSignedUrl(path, token, file, {
      contentType: file instanceof File ? file.type : undefined,
    });

  if (error || !data) {
    throw new Error(
      `Upload to "${path}" failed: ${error?.message ?? "unknown error"}`,
    );
  }
  return { path: data.path };
}

// --- Signed download (admin viewing) --------------------------------------

/**
 * SERVER-side: mint a short-lived signed URL to view/download an object.
 * Bucket is private, so this is how admins preview customer photos.
 * @param expiresInSeconds default 1 hour
 */
export async function createSignedDownloadUrl(
  client: Client,
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await client.storage
    .from(UPLOADS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    throw new Error(
      `Failed to create signed download URL for "${path}": ${error?.message ?? "unknown error"}`,
    );
  }
  return data.signedUrl;
}
