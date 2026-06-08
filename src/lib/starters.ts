"use client";
/**
 * Starter designs — copyright-free, procedurally drawn shapes a customer can
 * begin from without uploading a photo. Each renders to a canvas, then flows
 * through the normal Brick Engine pipeline (so size/zoom/colors all work).
 */
export interface Starter {
  id: string;
  name: string;
  draw: (ctx: CanvasRenderingContext2D, s: number) => void;
}

function bg(ctx: CanvasRenderingContext2D, s: number, color = "#ffffff") {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, s, s);
}

function heart(ctx: CanvasRenderingContext2D, s: number) {
  const cx = s / 2;
  const cy = s * 0.46;
  const w = s * 0.66;
  ctx.fillStyle = "#c91a09";
  ctx.beginPath();
  ctx.moveTo(cx, cy + w * 0.55);
  ctx.bezierCurveTo(cx + w * 0.6, cy - w * 0.2, cx + w * 0.22, cy - w * 0.52, cx, cy - w * 0.12);
  ctx.bezierCurveTo(cx - w * 0.22, cy - w * 0.52, cx - w * 0.6, cy - w * 0.2, cx, cy + w * 0.55);
  ctx.closePath();
  ctx.fill();
}

function star(ctx: CanvasRenderingContext2D, s: number) {
  const cx = s / 2;
  const cy = s / 2;
  const R = s * 0.4;
  const r = R * 0.42;
  ctx.fillStyle = "#f2cd37";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function triangle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  flip: boolean,
) {
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const ang = -Math.PI / 2 + (flip ? Math.PI : 0) + (i * 2 * Math.PI) / 3;
    const x = cx + Math.cos(ang) * R;
    const y = cy + Math.sin(ang) * R;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

function magenDavid(ctx: CanvasRenderingContext2D, s: number, color = "#0055bf") {
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.055;
  ctx.lineJoin = "round";
  triangle(ctx, s / 2, s / 2, s * 0.34, false);
  triangle(ctx, s / 2, s / 2, s * 0.34, true);
}

function smiley(ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = "#f2cd37";
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b1b1b";
  ctx.beginPath();
  ctx.arc(s * 0.38, s * 0.42, s * 0.05, 0, Math.PI * 2);
  ctx.arc(s * 0.62, s * 0.42, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1b1b1b";
  ctx.lineWidth = s * 0.045;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(s / 2, s * 0.52, s * 0.2, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

function israelFlag(ctx: CanvasRenderingContext2D, s: number) {
  bg(ctx, s);
  ctx.fillStyle = "#0055bf";
  const stripe = s * 0.12;
  ctx.fillRect(0, s * 0.16, s, stripe);
  ctx.fillRect(0, s * 0.72, s, stripe);
  magenDavid(ctx, s);
}

function checker(ctx: CanvasRenderingContext2D, s: number) {
  const n = 8;
  const c = s / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#1b1b1b" : "#f2f3f2";
      ctx.fillRect(x * c, y * c, c, c);
    }
}

function paw(ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = "#582a12";
  // main pad
  ctx.beginPath();
  ctx.ellipse(s / 2, s * 0.62, s * 0.2, s * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  // toes
  const toes: [number, number, number][] = [
    [0.32, 0.36, 0.07],
    [0.45, 0.3, 0.075],
    [0.58, 0.3, 0.075],
    [0.7, 0.38, 0.07],
  ];
  for (const [tx, ty, r] of toes) {
    ctx.beginPath();
    ctx.ellipse(s * tx, s * ty, s * r, s * (r + 0.02), 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function gift(ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = "#c91a09"; // box
  ctx.fillRect(s * 0.22, s * 0.38, s * 0.56, s * 0.42);
  ctx.fillStyle = "#f2cd37"; // ribbon
  ctx.fillRect(s * 0.46, s * 0.38, s * 0.08, s * 0.42);
  ctx.fillRect(s * 0.22, s * 0.55, s * 0.56, s * 0.08);
  // bow
  ctx.beginPath();
  ctx.ellipse(s * 0.42, s * 0.32, s * 0.1, s * 0.07, 0, 0, Math.PI * 2);
  ctx.ellipse(s * 0.58, s * 0.32, s * 0.1, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
}

export const STARTERS: Starter[] = [
  { id: "heart", name: "לב", draw: (ctx, s) => (bg(ctx, s), heart(ctx, s)) },
  { id: "star", name: "כוכב", draw: (ctx, s) => (bg(ctx, s), star(ctx, s)) },
  {
    id: "magen-david",
    name: "מגן דוד",
    draw: (ctx, s) => (bg(ctx, s), magenDavid(ctx, s)),
  },
  { id: "smiley", name: "סמיילי", draw: (ctx, s) => (bg(ctx, s), smiley(ctx, s)) },
  { id: "flag", name: "דגל ישראל", draw: israelFlag },
  { id: "paw", name: "כף רגל", draw: (ctx, s) => (bg(ctx, s), paw(ctx, s)) },
  { id: "gift", name: "מתנה", draw: (ctx, s) => (bg(ctx, s), gift(ctx, s)) },
  { id: "checker", name: "שחמט", draw: checker },
];

/** Render a starter to ImageData synchronously (for showcases/previews). */
export function renderStarterImageData(id: string, size = 256): ImageData | null {
  const st = STARTERS.find((s) => s.id === id);
  if (typeof document === "undefined" || !st) return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  st.draw(ctx, size);
  return ctx.getImageData(0, 0, size, size);
}

/** Render a starter to ImageData + a PNG File (for the upload-on-order step). */
export async function renderStarter(
  id: string,
  size = 256,
): Promise<{ imageData: ImageData; file: File } | null> {
  const st = STARTERS.find((s) => s.id === id);
  if (!st) return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  st.draw(ctx, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return null;
  return { imageData, file: new File([blob], `${id}.png`, { type: "image/png" }) };
}

/** Small SVG-free thumbnail data URL for the gallery (drawn once). */
export function starterThumb(id: string, size = 64): string {
  const st = STARTERS.find((s) => s.id === id);
  if (typeof document === "undefined" || !st) return "";
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  st.draw(ctx, size);
  return canvas.toDataURL();
}
