/**
 * Generates the downloadable brand SVGs in public/brand.
 *
 *   npm run dev            # in another terminal
 *   node scripts/export-brand.mjs
 *
 * Re-run after ANY change to BrandLogo.tsx.
 *
 * WHY IT SCRAPES A RUNNING SERVER instead of importing the component: the
 * source is .tsx, and the only transpiler in this project's dependency tree
 * (jiti, via Next) parses it as .ts and dies on the JSX fragment in `Plate`.
 * Rather than add a build dependency just for an export script, this reads the
 * SSR'd markup from /playbook/logo — which is not a workaround so much as the
 * stronger guarantee: the exported file is byte-for-byte what the site serves,
 * so it cannot drift from the component. Assets are marked up with
 * `data-export="<name>"` on that page; add one there to add one here.
 *
 * PNGs are deliberately NOT produced here. Rasterising SVG text requires the
 * Rubik font to be available to the rasteriser, which Node cannot guarantee.
 * The proof sheet rasterises in the browser instead, where Rubik is loaded and
 * correct by construction — see DownloadPng on /playbook/logo.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = process.env.ORIGIN ?? "http://localhost:3000";
const PAGE = `${ORIGIN}/playbook/logo`;
const INK = "#191c1e";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "brand");

let html;
try {
  const res = await fetch(PAGE);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  html = await res.text();
} catch (err) {
  console.error(`\nCould not read ${PAGE} — is the dev server running?\n  ${err.message}\n`);
  process.exit(1);
}

/** Pull each `data-export="name"` block's first <svg>…</svg>. */
function extract(html) {
  const out = [];
  const re = /data-export="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const rest = html.slice(m.index);
    const start = rest.indexOf("<svg");
    const end = rest.indexOf("</svg>");
    if (start === -1 || end === -1) continue;
    out.push([m[1], rest.slice(start, end + "</svg>".length)]);
  }
  return out;
}

/** Make the markup stand alone outside the app. */
function standalone(svg) {
  let s = svg
    // The app resolves the typeface through a CSS variable that does not exist
    // in a bare .svg file — name the family directly.
    .replace(
      /font-family="var\(--font-rubik\),\s*system-ui,\s*sans-serif"/g,
      'font-family="Rubik, system-ui, sans-serif"',
    )
    // `currentColor` has nothing to inherit from in a standalone file.
    .replace(/currentColor/g, INK)
    // React emits the app's utility classes; they mean nothing outside it.
    .replace(/\sclass="[^"]*"/g, "");

  const vb = s.match(/viewBox="([\d.\s-]+)"/)?.[1].trim().split(/\s+/).map(Number);
  const size = vb ? ` width="${vb[2].toFixed(2)}" height="${vb[3].toFixed(2)}"` : "";
  s = s.replace("<svg", `<svg xmlns="http://www.w3.org/2000/svg"${size}`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${s}\n`;
}

const assets = extract(html);
if (!assets.length) {
  console.error("No [data-export] assets found on the page. Did the markup change?");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
for (const [name, svg] of assets) {
  const file = standalone(svg);
  writeFileSync(join(outDir, `${name}.svg`), file, "utf8");
  console.log(`  ${name}.svg  ${file.length.toLocaleString()} bytes`);
}
console.log(`\n${assets.length} SVG files written to public/brand/`);
