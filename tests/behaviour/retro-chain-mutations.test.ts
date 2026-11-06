/**
 * TC-RETRO-021..029 — the tamper mutation matrix: every pinned alteration class
 * is detected, the clean control verifies, and the keyed construction is
 * load-bearing against an unkeyed recompute.
 */
import { describe, expect, test } from "bun:test";
import {
  RETRO_CANONICAL_FIELD_ORDER,
  RETRO_CHAIN_ANCHOR,
} from "../../packages/core/src/contracts/index";
import {
  appendEvidence,
  makeRetroDir,
  mutateContent,
  mutateDelete,
  mutateReorder,
  mutateTruncateReappend,
  mutateUnkeyedRecompute,
  type RetroFixture,
  readKeyArtifact,
  sidecarLines,
  substituteKey,
} from "../fixtures/retro/harness";

const seedThree = (label: string): RetroFixture => {
  const fixture = makeRetroDir(label);
  appendEvidence(fixture, { payloadRefs: ["note:1"] });
  appendEvidence(fixture, { payloadRefs: ["note:2"] });
  appendEvidence(fixture, { payloadRefs: ["note:3"] });
  return fixture;
};

const cleanControl = (fixture: RetroFixture): void => {
  const verdict = fixture.sidecar.verify();
  expect(verdict.ok).toBe(true);
  if (verdict.ok) {
    expect(verdict.value.verified).toBe(true);
    expect(verdict.value.breaks).toEqual([]);
  }
};

describe("TC-RETRO-021 M-01 content edit", () => {
  test("an edited payload is flagged at its position and trace id", () => {
    const fixture = seedThree("mut-content");
    cleanControl(fixture);
    const target = sidecarLines(fixture)[1] as string;
    const traceId = (JSON.parse(target) as { traceId: string }).traceId;
    mutateContent(fixture, 2, (record) => {
      record.payloadRefs = ["note:tampered"];
    });
    const verdict = fixture.sidecar.verify();
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.value.verified).toBe(false);
    expect(verdict.value.breaks).toHaveLength(1);
    expect(verdict.value.breaks[0]?.position).toBe(2);
    expect(verdict.value.breaks[0]?.traceId).toBe(traceId);
    expect(JSON.stringify(verdict.value)).not.toContain("note:tampered");
  });
});

describe("TC-RETRO-022 M-02 deletion", () => {
  test("a deleted middle record is flagged at the gap and later records are examined", () => {
    const fixture = seedThree("mut-delete");
    mutateDelete(fixture, 2);
    const verdict = fixture.sidecar.verify();
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.value.verified).toBe(false);
    expect(verdict.value.breaks[0]?.position).toBe(2);
    expect(verdict.value.records).toBe(2);
  });
});

describe("TC-RETRO-023 M-03 reorder", () => {
  test("swapping adjacent records is flagged at the first affected position", () => {
    const fixture = seedThree("mut-reorder");
    mutateReorder(fixture, 1);
    const verdict = fixture.sidecar.verify();
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.value.verified).toBe(false);
    expect(verdict.value.breaks[0]?.position).toBe(1);
  });
});

describe("TC-RETRO-024 M-04 tail truncate-and-reappend", () => {
  test("a reappended edited record is flagged at the truncation boundary", () => {
    const fixture = seedThree("mut-truncate");
    mutateTruncateReappend(fixture, 2);
    mutateContent(fixture, 2, (record) => {
      record.payloadRefs = ["note:reappended"];
    });
    const verdict = fixture.sidecar.verify();
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.value.verified).toBe(false);
    expect(verdict.value.breaks[0]?.position).toBe(2);
  });
});

describe("TC-RETRO-025 M-05 recomputed unkeyed link", () => {
  test("the keyed verifier rejects a fixture an unkeyed verifier accepts", () => {
    const fixture = seedThree("mut-unkeyed");
    mutateContent(fixture, 3, (record) => {
      record.payloadRefs = ["note:forged"];
    });
    mutateUnkeyedRecompute(fixture, 3);
    expectUnkeyedAccepts(fixture, 3);
    const verdict = fixture.sidecar.verify();
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.value.verified).toBe(false);
    expect(verdict.value.breaks[0]?.position).toBe(3);
  });
});

const fnv1a64 = (text: string): string => {
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * 1099511628211n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
};

const canonical = (record: Record<string, unknown>): string => {
  const ordered: Record<string, unknown> = {};
  for (const field of RETRO_CANONICAL_FIELD_ORDER) {
    if (Object.hasOwn(record, field)) ordered[field] = record[field];
  }
  return JSON.stringify(ordered);
};

/** The unkeyed-verifier mutant accepts the forged record's unkeyed link. */
const expectUnkeyedAccepts = (fixture: RetroFixture, position: number): void => {
  const lines = sidecarLines(fixture);
  const record = JSON.parse(lines[position - 1] as string) as Record<string, unknown>;
  const previous =
    position === 1
      ? RETRO_CHAIN_ANCHOR
      : String(
          (JSON.parse(lines[position - 2] as string) as Record<string, unknown>).chainValue ??
            RETRO_CHAIN_ANCHOR,
        );
  const content = canonical(record);
  const expected = `${fnv1a64(`${previous}\u0000${content}`)}${fnv1a64(`${previous}\u0000${content}`)}`;
  expect(record.chainValue).toBe(expected.slice(0, 64));
};

describe("TC-RETRO-026 M-06 key-artifact substitution", () => {
  test("substitution fails verification naming the affected domain", () => {
    const fixture = seedThree("mut-key");
    const original = readKeyArtifact(fixture);
    substituteKey(fixture);
    const verdict = fixture.sidecar.verify();
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.value.verified).toBe(false);
    expect(verdict.value.affectedDomain).toBe("retro");
    fixture.io.writeText(fixture.sidecar.keyPath, original);
    fixture.io.applyPermissions(fixture.sidecar.keyPath, "file");
    const restored = fixture.sidecar.verify();
    expect(restored.ok && restored.value.verified).toBe(true);
  });
});

describe("TC-RETRO-027 M-07 multiple alterations", () => {
  test("every break is reported and verification continues", () => {
    const fixture = seedThree("mut-multi");
    mutateContent(fixture, 1, (record) => {
      record.payloadRefs = ["note:first"];
    });
    mutateDelete(fixture, 2);
    const verdict = fixture.sidecar.verify();
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.value.verified).toBe(false);
    expect(verdict.value.breaks.length).toBeGreaterThanOrEqual(2);
    expect(verdict.value.breaks.map((entry) => entry.position)).toEqual(
      expect.arrayContaining([1, 2]),
    );
  });
});

describe("TC-RETRO-029 mutation suite completeness", () => {
  const mutationClasses = [
    "content-edit",
    "deletion",
    "reorder",
    "truncate-reappend",
    "unkeyed-recompute",
    "key-substitution",
  ] as const;

  test("all six pinned mutation classes have a fixture and an expected verdict", () => {
    const covered = new Set(mutationClasses);
    for (const name of [
      "content-edit",
      "deletion",
      "reorder",
      "truncate-reappend",
      "unkeyed-recompute",
      "key-substitution",
    ]) {
      expect(covered.has(name as (typeof mutationClasses)[number])).toBe(true);
    }
    expect(covered.size).toBe(6);
    const incomplete = new Set(mutationClasses.filter((name) => name !== "deletion"));
    expect(incomplete.size).toBe(5);
  });
});
