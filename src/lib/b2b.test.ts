import { describe, expect, it } from "vitest";

import {
  balancedDims,
  defaultAllocation,
  fitPlateDims,
  projectProgress,
  seatStatus,
  totalPlateCredits,
  workspaceStatus,
  type WorkspaceLike,
} from "./b2b";
import {
  computeB2bQuote,
  managedFeePerSeat,
  MAX_SELF_SERVE_SEATS,
  mosaicDiscount,
} from "./b2b-pricing";
import { computePrice } from "./pricing";

const base: WorkspaceLike = {
  active: true,
  expiration_date: null,
  max_slots: 5,
  slots_used: 0,
};

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_000_000_000_000;

describe("workspaceStatus", () => {
  it("is open for an active, non-expired workspace with free slots", () => {
    const s = workspaceStatus(base, NOW);
    expect(s.open).toBe(true);
    expect(s.remaining).toBe(5);
  });

  it("is closed when inactive", () => {
    expect(workspaceStatus({ ...base, active: false }, NOW).open).toBe(false);
  });

  it("is closed and full when slots are exhausted", () => {
    const s = workspaceStatus({ ...base, slots_used: 5 }, NOW);
    expect(s.open).toBe(false);
    expect(s.full).toBe(true);
    expect(s.remaining).toBe(0);
  });

  it("is closed and expired past the expiration date", () => {
    const s = workspaceStatus(
      { ...base, expiration_date: new Date(NOW - DAY).toISOString() },
      NOW,
    );
    expect(s.open).toBe(false);
    expect(s.expired).toBe(true);
  });

  it("handles a missing workspace", () => {
    expect(workspaceStatus(null, NOW).open).toBe(false);
  });
});

describe("seatStatus", () => {
  it("maps submission states to seat lifecycle", () => {
    expect(seatStatus(null)).toBe("not_started");
    expect(seatStatus(undefined)).toBe("not_started");
    expect(seatStatus("pending")).toBe("submitted");
    expect(seatStatus("processing")).toBe("submitted");
    expect(seatStatus("ready")).toBe("ready");
    expect(seatStatus("rejected")).toBe("rejected");
  });
});

describe("projectProgress", () => {
  it("counts seats and computes the done fraction", () => {
    const p = projectProgress([
      "not_started",
      "submitted",
      "ready",
      "rejected",
    ]);
    expect(p.total).toBe(4);
    expect(p.notStarted).toBe(1);
    expect(p.ready).toBe(1);
    // 3 of 4 have submitted something (anything but not_started).
    expect(p.doneFraction).toBeCloseTo(0.75, 5);
  });

  it("is empty-safe", () => {
    expect(projectProgress([]).doneFraction).toBe(0);
  });
});

describe("computeB2bQuote", () => {
  it("at low volume equals employees × the regular physical mosaic price", () => {
    const q = computeB2bQuote(5, "2x2", false); // below the first discount tier
    const perMosaic = computePrice(q.cols, q.rows, "physical").total;
    expect(q.discount).toBe(0);
    expect(q.perMosaic).toBe(perMosaic);
    expect(q.total).toBe(perMosaic * 5);
  });

  it("applies a gradual volume discount (more = cheaper per unit)", () => {
    const base = computeB2bQuote(5, "2x2", false).perMosaic;
    const at25 = computeB2bQuote(25, "2x2", false).perMosaic;
    const at50 = computeB2bQuote(50, "2x2", false).perMosaic;
    expect(at25).toBeLessThan(base);
    expect(at50).toBeLessThan(at25);
    expect(computeB2bQuote(50, "2x2", false).savings).toBeGreaterThan(0);
    expect(mosaicDiscount(9)).toBe(0);
    expect(mosaicDiscount(50)).toBeGreaterThan(mosaicDiscount(25));
  });

  it("managed fee per seat drops to ₪10 at 50+", () => {
    expect(managedFeePerSeat(10)).toBe(18);
    expect(managedFeePerSeat(50)).toBe(10);
    const q = computeB2bQuote(50, "2x2", true);
    expect(q.managementTotal).toBe(50 * 10);
  });

  it("flags orders over the self-serve cap for a quote", () => {
    expect(computeB2bQuote(MAX_SELF_SERVE_SEATS, "2x2", false).requiresQuote).toBe(
      false,
    );
    expect(
      computeB2bQuote(MAX_SELF_SERVE_SEATS + 1, "2x2", false).requiresQuote,
    ).toBe(true);
  });

  it("clamps employees to at least 1 and falls back for unknown sizes", () => {
    const q = computeB2bQuote(0, "nope", false);
    expect(q.employees).toBe(1);
    expect(q.cols).toBeGreaterThan(0);
  });

  it("larger sizes cost more per mosaic", () => {
    const small = computeB2bQuote(5, "1x1", false).perMosaic;
    const big = computeB2bQuote(5, "3x3", false).perMosaic;
    expect(big).toBeGreaterThan(small);
  });
});

describe("plate credits & allocation", () => {
  const order = { licenses_purchased: 3, plates_x: 3, plates_y: 2 };

  it("default allocation is the purchased per-employee size", () => {
    expect(defaultAllocation(order)).toBe(6);
  });

  it("total pool = employees × size + top-ups", () => {
    expect(totalPlateCredits(order)).toBe(18);
    expect(totalPlateCredits({ ...order, extra_plate_credits: 6 })).toBe(24);
  });

  it("balancedDims picks a near-square shape within budget", () => {
    expect(balancedDims(6)).toEqual({ x: 2, y: 3 });
    expect(balancedDims(9)).toEqual({ x: 3, y: 3 });
    expect(balancedDims(8)).toEqual({ x: 2, y: 4 });
    expect(balancedDims(4)).toEqual({ x: 2, y: 2 });
  });

  it("fitPlateDims auto-adjusts the other axis to stay within budget", () => {
    // budget 6: set W=3 → H caps at 2
    expect(fitPlateDims({ changed: "x", x: 3, y: 3, budget: 6 })).toEqual({
      x: 3,
      y: 2,
    });
    // then set H=3 → W drops to 2
    expect(fitPlateDims({ changed: "y", x: 3, y: 3, budget: 6 })).toEqual({
      x: 2,
      y: 3,
    });
  });

  it("fitPlateDims allows using fewer plates than the budget", () => {
    // 2×2 = 4 is fine under a budget of 6 (employee gives up plates)
    expect(fitPlateDims({ changed: "x", x: 2, y: 2, budget: 6 })).toEqual({
      x: 2,
      y: 2,
    });
  });

  it("fitPlateDims never exceeds budget or drops below 1", () => {
    const r = fitPlateDims({ changed: "x", x: 99, y: 99, budget: 6 });
    expect(r.x * r.y).toBeLessThanOrEqual(6);
    expect(r.x).toBeGreaterThanOrEqual(1);
    expect(r.y).toBeGreaterThanOrEqual(1);
  });
});
