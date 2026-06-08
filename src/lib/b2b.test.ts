import { describe, expect, it } from "vitest";

import {
  projectProgress,
  seatStatus,
  workspaceStatus,
  type WorkspaceLike,
} from "./b2b";
import {
  computeB2bQuote,
  MANAGED_FEE_PER_SEAT,
  MAX_SELF_SERVE_SEATS,
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
  it("prices a B2B set as employees × the regular physical mosaic price", () => {
    const q = computeB2bQuote(10, "2x2", false);
    const perMosaic = computePrice(q.cols, q.rows, "physical").total;
    expect(q.perMosaic).toBe(perMosaic);
    expect(q.mosaicsTotal).toBe(perMosaic * 10);
    // The whole point of the fix: NOT dramatically cheaper than B2C.
    expect(q.total).toBe(perMosaic * 10);
  });

  it("adds the managed upsell per seat when enabled", () => {
    const plain = computeB2bQuote(20, "2x2", false);
    const managed = computeB2bQuote(20, "2x2", true);
    expect(managed.managementTotal).toBe(20 * MANAGED_FEE_PER_SEAT);
    expect(managed.total - plain.total).toBe(20 * MANAGED_FEE_PER_SEAT);
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
