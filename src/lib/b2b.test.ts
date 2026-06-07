import { describe, expect, it } from "vitest";

import { workspaceStatus, type WorkspaceLike } from "./b2b";

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
