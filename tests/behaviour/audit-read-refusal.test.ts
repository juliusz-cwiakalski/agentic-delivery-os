/**
 * TC-GH223-040 — a missing or invalid bound/filter refuses with the existing
 * `input.value.rejected` identity, returns no records, and writes nothing.
 */
import { describe, expect, test } from "bun:test";
import type { AuditReadQuery } from "../../packages/core/src/contracts/index";
import { readAuditLedger } from "../../packages/core/src/state/index";
import {
  ledgerDigest,
  makeAuditStore,
  removeRoot,
  seedAuditPairs,
} from "../fixtures/state/harness";

const refusal = (query: unknown): string | undefined => {
  const fixture = makeAuditStore("refusal-probe");
  try {
    seedAuditPairs(fixture.store, 1);
    const before = ledgerDigest(fixture.identity);
    const read = readAuditLedger(fixture.store, query as AuditReadQuery);
    expect(ledgerDigest(fixture.identity)).toBe(before);
    expect(fixture.store.fenceStatus().held).toBe(false);
    return read.ok ? undefined : read.error.code;
  } finally {
    removeRoot(fixture.root);
  }
};

describe("TC-GH223-040 read refusals", () => {
  test("the bound is mandatory and invalid bounds refuse", () => {
    expect(refusal({})).toBe("input.value.rejected");
    expect(refusal({ limit: 0 })).toBe("input.value.rejected");
    expect(refusal({ limit: -1 })).toBe("input.value.rejected");
    expect(refusal({ limit: 1.5 })).toBe("input.value.rejected");
    expect(refusal({ limit: Number.NaN })).toBe("input.value.rejected");
  });

  test("invalid filters refuse and an omitted window is valid", () => {
    expect(refusal({ limit: 10, outcomeClass: "mystery" })).toBe("input.value.rejected");
    expect(refusal({ limit: 10, from: 1.5 })).toBe("input.value.rejected");
    expect(refusal({ limit: 10, to: -1 })).toBe("input.value.rejected");
    expect(refusal({ limit: 10, from: 3000, to: 1000 })).toBe("input.value.rejected");
    expect(refusal({ limit: 10, scope: 7 })).toBe("input.value.rejected");
    expect(refusal({ limit: 10, repo: 7 })).toBe("input.value.rejected");
    expect(refusal({ limit: 10, command: 7 })).toBe("input.value.rejected");
    // An entirely omitted window is valid (unfiltered on time).
    expect(refusal({ limit: 10 })).toBeUndefined();
  });

  test("a valid query with the same filters succeeds (the refusal is specific)", () => {
    const fixture = makeAuditStore("refusal-valid");
    try {
      seedAuditPairs(fixture.store, 2);
      const read = readAuditLedger(fixture.store, {
        limit: 10,
        from: 0,
        to: 999999,
        scope: "workspace-a",
      });
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.records.length).toBe(2);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
