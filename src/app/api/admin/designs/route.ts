/**
 * Admin CRUD for the ready-made designs gallery — /api/admin/designs.
 *
 *  - POST   multipart/form-data { title, file, default_plates_x?, default_plates_y?, sort_order? }
 *           Uploads the artwork to the public 'designs' bucket and inserts a row.
 *  - PATCH  JSON { id, ...fields }  — update title/dims/sort_order/active.
 *  - DELETE JSON { id }             — remove the row and its storage object.
 *
 * All methods are admin-only (an authenticated Supabase session is required).
 * Writes use the service-role client so they bypass RLS deterministically.
 */
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { DESIGNS_BUCKET, extensionForMime } from "@/lib/supabase/storage";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/lib/supabase/types";

export const runtime = "nodejs";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB (matches the bucket cap)

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function clampPlates(value: unknown, fallback = 2): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, n));
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected form data" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  const file = form.get("file");
  if (!title) {
    return NextResponse.json({ error: "חסרה כותרת" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "חסרה תמונה" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "סוג קובץ לא נתמך (JPG/PNG/WEBP)" },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "הקובץ גדול מדי (עד 10MB)" }, { status: 413 });
  }

  const admin = createAdminClient();
  const path = `gallery/${randomUUID()}.${extensionForMime(file.type)}`;

  const { error: uploadErr } = await admin.storage
    .from(DESIGNS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data, error } = await admin
    .from("ready_designs")
    .insert({
      title,
      image_path: path,
      default_plates_x: clampPlates(form.get("default_plates_x")),
      default_plates_y: clampPlates(form.get("default_plates_y")),
      sort_order: Math.round(Number(form.get("sort_order") ?? 0)) || 0,
    })
    .select()
    .single();

  if (error) {
    // Roll back the orphaned upload so we don't leak storage objects.
    await admin.storage.from(DESIGNS_BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ design: data });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    id?: string;
    title?: string;
    default_plates_x?: number;
    default_plates_y?: number;
    sort_order?: number;
    active?: boolean;
    is_hero?: boolean;
    settings?: Record<string, unknown> | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const patch: TablesUpdate<"ready_designs"> = {};
  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim();
  }
  if (body.default_plates_x != null) {
    patch.default_plates_x = clampPlates(body.default_plates_x);
  }
  if (body.default_plates_y != null) {
    patch.default_plates_y = clampPlates(body.default_plates_y);
  }
  if (body.sort_order != null) {
    patch.sort_order = Math.round(Number(body.sort_order)) || 0;
  }
  if (typeof body.active === "boolean") {
    patch.active = body.active;
  }
  if (typeof body.is_hero === "boolean") {
    patch.is_hero = body.is_hero;
  }
  if (body.settings !== undefined) {
    patch.settings = (body.settings ?? null) as TablesUpdate<"ready_designs">["settings"];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Only one design may be the hero — clear the flag everywhere before setting
  // it here (the partial unique index would otherwise reject two heroes).
  if (body.is_hero === true) {
    await admin
      .from("ready_designs")
      .update({ is_hero: false })
      .eq("is_hero", true);
  }

  const { data, error } = await admin
    .from("ready_designs")
    .update(patch)
    .eq("id", body.id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ design: data });
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const admin = createAdminClient();
  // Look up the storage path so we can clean up the object after deleting.
  const { data: row } = await admin
    .from("ready_designs")
    .select("image_path")
    .eq("id", body.id)
    .single();

  const { error } = await admin.from("ready_designs").delete().eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (row?.image_path) {
    await admin.storage.from(DESIGNS_BUCKET).remove([row.image_path]);
  }
  return NextResponse.json({ ok: true });
}
