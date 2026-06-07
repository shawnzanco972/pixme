/**
 * POST /api/uploads/sign
 *
 * Mints a one-time signed upload URL into the private 'uploads' bucket so the
 * browser can PUT the customer's photo directly to Storage. We generate a draft
 * path here; the resulting object path is stored as the order's image_url at
 * checkout.
 *
 * Body: { contentType: string }
 * Returns: { path, token, signedUrl }
 */
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  createSignedUploadUrl,
  extensionForMime,
} from "@/lib/supabase/storage";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(request: Request) {
  let body: { contentType?: string };
  try {
    body = (await request.json()) as { contentType?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const contentType = body.contentType ?? "";
  if (!ALLOWED.has(contentType)) {
    return NextResponse.json(
      { error: "Unsupported image type" },
      { status: 415 },
    );
  }

  const draftId = randomUUID();
  const path = `b2c/drafts/${draftId}/original.${extensionForMime(contentType)}`;

  try {
    const signed = await createSignedUploadUrl(createAdminClient(), path);
    return NextResponse.json(signed);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create upload URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
