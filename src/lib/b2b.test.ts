import { describe, expect, it } from "vitest";

import {
  projectProgress,
  seatStatus,
  workspaceStatus,
  type WorkspaceLike,
} from "./b2b";
import { B2B_BUNDLES, bundleById, bundlePerSeat } from "./b2b-bundles";

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

describe("b2b bundles", () => {
  it("has exactly one featured tier and positive pricing", () => {
    expect(B2B_BUNDLES.filter((b) => b.featured)).toHaveLength(1);
    for (const b of B2B_BUNDLES) {
      expect(b.seats).toBeGreaterThan(0);
      expect(b.price).toBeGreaterThan(0);
      expect(bundlePerSeat(b)).toBeGreaterThan(0);
    }
  });

  it("looks up by id and rewards volume (cheaper per seat at scale)", () => {
    expect(bundleById("company-25")?.seats).toBe(25);
    expect(bundleById("nope")).toBeUndefined();
    const small = bundlePerSeat(B2B_BUNDLES[0]);
    const mid = bundlePerSeat(B2B_BUNDLES[1]);
    expect(mid).toBeLessThanOrEqual(small);
  });
});
