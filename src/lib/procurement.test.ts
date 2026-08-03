import { describe, expect, it } from "vitest";

import {
  buildProcurementExport,
  codeMapFromRows,
  procurementToCsv,
  type ManufacturerCodeMap,
} from "./procurement";
import type { RestockReport } from "./restock";
import { decodePixelMap, encodePixelMap } from "./brick-engine/palette";

const report: RestockReport = {
  orderCount: 1,
  totalPieces: 30,
  totalGrams: 5,
  lines: [
    { id: 3, colorId: "black", displayCode: "N4", name: "Black", hex: "#1b1b1b", rgb: [27, 27, 27], core: true, pieces: 20, piecesWithSpare: 25, grams: 4 },
    { id: 30, colorId: "dark-purple", displayCode: "A17", name: "Dark Purple", hex: "#3f3691", rgb: [63, 54, 145], core: false, pieces: 10, piecesWithSpare: 15, grams: 2.4 },
  ],
};

describe("buildProcurementExport", () => {
  const codes: ManufacturerCodeMap = new Map([
    ["black", { code: "0" }],
    // dark-purple intentionally UNMAPPED for gobricks.
  ]);

  it("emits the chosen manufacturer's codes and flags unmapped colors", () => {
    const exp = buildProcurementExport(report, codes, { manufacturer: "peiye" });
    expect(exp.manufacturer).toBe("peiye");
    expect(exp.lines[0]).toMatchObject({
      colorId: "black",
      manufacturerCode: "0",
      part: "3024",
      sku: "3024-0", // composed part-code
      pieces: 25, // piecesWithSpare by default
    });
    expect(exp.lines[1].manufacturerCode).toBeNull();
    expect(exp.unmapped).toEqual(["dark-purple"]);
  });

  it("can order the bare design count instead of with-spare", () => {
    const exp = buildProcurementExport(report, codes, { withSpare: false });
    expect(exp.lines[0].pieces).toBe(20);
    expect(exp.totalPieces).toBe(30);
  });

  it("renders a stable CSV in the manufacturer's numbering", () => {
    const exp = buildProcurementExport(report, codes);
    expect(procurementToCsv(exp)).toBe(
      [
        "part,manufacturer_code,sku,color_id,display_code,name,pieces,grams",
        "3024,0,3024-0,black,N4,Black,25,4",
        "3024,,,dark-purple,A17,Dark Purple,15,2.4",
      ].join("\n"),
    );
  });

  it("codeMapFromRows filters to one manufacturer", () => {
    const map = codeMapFromRows(
      [
        { color_id: "black", manufacturer: "gobricks", code: "0" },
        { color_id: "black", manufacturer: "bricklink", code: "11" },
        { color_id: "red", manufacturer: "gobricks", code: "4" },
      ],
      "gobricks",
    );
    expect(map.get("black")?.code).toBe("0");
    expect(map.get("red")?.code).toBe("4");
    expect(map.size).toBe(2);
  });
});

describe("determinism across the int->slug remap", () => {
  it("encode/decode is a lossless inverse (pixel_map stays byte-identical)", () => {
    // A representative map spanning legacy + new ids.
    const map = [
      [0, 3, 11, 17],
      [23, 24, 30, 7],
      [10, 9, 8, 4],
    ];
    const slugMap = encodePixelMap(map);
    // Persisted form is slugs (never numbers / manufacturer codes).
    expect(slugMap.flat().every((s) => typeof s === "string")).toBe(true);
    // Round-trips exactly — the PDF/parts pipeline sees the same cells.
    expect(decodePixelMap(slugMap)).toEqual(map);
  });
});
