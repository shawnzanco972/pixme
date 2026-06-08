import { describe, expect, it } from "vitest";

import {
  projectProgress,
  seatStatus,
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
