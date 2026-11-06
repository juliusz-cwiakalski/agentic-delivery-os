/**
 * TC-GH222-020/021/022 — the reusable artifact-boundary verdict matrix and the
 * retro-registry / ceremony-artifact stand-in kinds: valid, verified-empty,
 * torn, and unknown are distinct before any value returns; schema violations
 * and unknown kinds are classified; no retro pipeline or ceremony runner
 * behaviour exists, is imported, or is required (DEC-1, NG-1, DM-4).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ERROR_TABLE,
  type ErrorTableEntry,
  STATE_BOUNDARY_VERDICTS,
} from "../../packages/core/src/contracts/index";
import { createArtifactBoundary } from "../../packages/core/src/state/index";
import {
  appendArtifact,
  CEREMONY_BOUNDARY,
  RETRO_BOUNDARY,
} from "../fixtures/state/artifact-declarations";
import {
  ledgerBytes,
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";

const guidanceFor = (code: string): string =>
  (ERROR_TABLE as readonly ErrorTableEntry[]).find((entry) => entry.code === code)
    ?.remediationHint ?? "";

const retroPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  schemaId: "delivery.retro.finding.v1",
  findingId: "F-1",
  severity: "high",
  count: 2,
  ...overrides,
});

const ceremonyPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  schemaId: "delivery.ceremony.artifact.v1",
  artifactId: "A-1",
  status: "pending",
  ...overrides,
});

describe("TC-GH222-020 artifact-boundary verdict matrix", () => {
  test("valid, verified-empty, torn, and unknown are distinct", () => {
    const root = makeTempRoot("gh222-boundary-matrix");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const boundary = createArtifactBoundary(store, RETRO_BOUNDARY);
      expect([...STATE_BOUNDARY_VERDICTS]).toEqual(["valid", "verified-empty", "torn", "unknown"]);

      // Verified-empty: nothing under the boundary's namespace yet.
      const empty = boundary.read();
      const emptyVerdict = empty.ok ? empty.value.verdict : empty.error.code;
      expect(empty.ok).toBe(true);
      if (empty.ok) {
        expect(empty.value.verdict).toBe("verified-empty");
        expect(empty.value.artifacts).toEqual([]);
        expect(empty.value.evidence.verifiedEmpty).toBe(true);
        expect(empty.value.evidence.recordCount).toBe(0);
      }

      // Valid: a conforming artifact round-trips with evidence.
      const appended = appendArtifact(boundary, store, {
        kind: "retro.finding",
        recordKey: "retro.records:F-1",
        payload: retroPayload() as never,
      });
      expect(appended.ok).toBe(true);
      const valid = boundary.read();
      const validVerdict = valid.ok ? valid.value.verdict : valid.error.code;
      expect(valid.ok).toBe(true);
      if (valid.ok) {
        expect(valid.value.verdict).toBe("valid");
        expect(valid.value.artifacts).toHaveLength(1);
        expect(valid.value.artifacts[0]?.payload).toEqual(retroPayload() as never);
        expect(valid.value.evidence.verifiedEmpty).toBe(false);
        expect(valid.value.evidence.recordCount).toBe(1);
      }

      // Torn: a malformed ledger line classifies before any value returns.
      writeFileSync(ledgerPath(identity), `${ledgerText(identity)}{not-json\n`);
      const torn = boundary.read();
      expect(torn.ok).toBe(false);
      if (!torn.ok) {
        expect(torn.error.code).toBe("state.store.torn");
        expect(torn.error.location.path).toContain("ledger.");
        expect(typeof torn.error.location.record).toBe("number");
        expect(guidanceFor(torn.error.code)).toContain("salvage");
      }
      const verdicts = new Set(["verified-empty", torn.ok ? "unreachable" : torn.error.code]);
      expect(verdicts.size).toBe(2);

      // Unknown: an undeclared kind at the boundary.
      const otherRoot = makeTempRoot("gh222-boundary-matrix-unknown");
      let unknownCode = "unreachable";
      try {
        const otherIdentity = makeIdentity(otherRoot);
        const other = openStore(otherIdentity);
        const otherBoundary = createArtifactBoundary(other.store, RETRO_BOUNDARY);
        const raw = appendArtifact(otherBoundary, other.store, {
          kind: "retro.mystery",
          recordKey: "retro.records:X",
          payload: retroPayload() as never,
        });
        // The write path refuses the undeclared kind (no raw append needed).
        expect(raw.ok).toBe(false);
        if (!raw.ok) unknownCode = raw.error.code;
      } finally {
        removeRoot(otherRoot);
      }

      const observed = new Set([
        validVerdict,
        emptyVerdict,
        torn.ok ? "unreachable" : torn.error.code,
        unknownCode,
      ]);
      expect(observed.size).toBe(4);
    } finally {
      removeRoot(root);
    }
  });

  test("the declaration is reusable data: a second kind needs no code change", () => {
    const root = makeTempRoot("gh222-boundary-reusable");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const ceremony = createArtifactBoundary(store, CEREMONY_BOUNDARY);
      const appended = appendArtifact(ceremony, store, {
        kind: "ceremony.artifact",
        recordKey: "ceremony.artifacts:A-1",
        payload: ceremonyPayload() as never,
      });
      expect(appended.ok).toBe(true);
      const read = ceremony.read();
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.value.verdict).toBe("valid");
      expect(read.value.artifacts[0]?.kind).toBe("ceremony.artifact");
      // The retro boundary ignores the ceremony kind (different namespace) and
      // the raw store stays kind-agnostic.
      const retro = createArtifactBoundary(store, RETRO_BOUNDARY);
      const retroRead = retro.read();
      expect(retroRead.ok).toBe(true);
      if (retroRead.ok) expect(retroRead.value.verdict).toBe("verified-empty");
    } finally {
      removeRoot(root);
    }
  });

  test("the suite imports no retro pipeline or ceremony runner module", () => {
    const source = readFileSync(
      join(process.cwd(), "tests/behaviour/state-artifact-boundary.test.ts"),
      "utf8",
    );
    const moduleLines = source
      .split("\n")
      .filter((line) => line.trimStart().startsWith("import ") || line.includes(' from "'));
    for (const line of moduleLines) {
      expect(line).not.toContain("retro");
      expect(line).not.toContain("ceremony");
    }
    expect(existsSync(join(process.cwd(), "packages/core/src/state/retro.ts"))).toBe(false);
    expect(existsSync(join(process.cwd(), "packages/core/src/state/ceremony.ts"))).toBe(false);
  });
});

describe("TC-GH222-021 retro-registry stand-in kind", () => {
  test("a conforming artifact round-trips exactly, including falsy fields", () => {
    const root = makeTempRoot("gh222-retro-standing");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const boundary = createArtifactBoundary(store, RETRO_BOUNDARY);
      const payload = retroPayload({ count: 0, resolved: false, note: "" });
      const appended = appendArtifact(boundary, store, {
        kind: "retro.finding",
        recordKey: "retro.records:F-1",
        payload: payload as never,
      });
      expect(appended.ok).toBe(true);
      const read = boundary.read();
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const artifact = read.value.artifacts[0];
      expect(artifact?.payload).toEqual(payload as never);
      const recorded = (artifact?.payload ?? {}) as Record<string, unknown>;
      expect(recorded.resolved).toBe(false);
      expect(recorded.count).toBe(0);
    } finally {
      removeRoot(root);
    }
  });

  test("missing-required and wrong-typed writes are refused with digest stability", () => {
    const root = makeTempRoot("gh222-retro-violations");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const boundary = createArtifactBoundary(store, RETRO_BOUNDARY);
      appendArtifact(boundary, store, {
        kind: "retro.finding",
        recordKey: "retro.records:F-1",
        payload: retroPayload() as never,
      });
      const before = ledgerBytes(identity);

      const missing = appendArtifact(boundary, store, {
        kind: "retro.finding",
        recordKey: "retro.records:F-2",
        payload: { schemaId: "delivery.retro.finding.v1", findingId: "F-2", count: 1 } as never,
      });
      expect(missing.ok).toBe(false);
      if (!missing.ok) {
        expect(missing.error.code).toBe("state.store.unknown");
        expect(missing.error.consequence).toBe("not_landed");
      }

      const wrongType = appendArtifact(boundary, store, {
        kind: "retro.finding",
        recordKey: "retro.records:F-3",
        payload: retroPayload({ findingId: "F-3", count: "two" }) as never,
      });
      expect(wrongType.ok).toBe(false);
      if (!wrongType.ok) expect(wrongType.error.code).toBe("state.store.unknown");

      const vocabulary = appendArtifact(boundary, store, {
        kind: "retro.finding",
        recordKey: "retro.records:F-4",
        payload: retroPayload({ findingId: "F-4", severity: "SEVERE" }) as never,
      });
      expect(vocabulary.ok).toBe(false);
      if (!vocabulary.ok) expect(vocabulary.error.code).toBe("state.store.unknown");

      expect(ledgerBytes(identity).equals(before)).toBe(true);
      const read = boundary.read();
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.artifacts).toHaveLength(1);
        expect(read.value.artifacts[0]?.payload).toEqual(retroPayload() as never);
      }
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-GH222-022 ceremony-artifact stand-in kind", () => {
  test("malformed bytes are torn; vocabulary and identity violations are unknown", () => {
    const root = makeTempRoot("gh222-ceremony-standing");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const boundary = createArtifactBoundary(store, CEREMONY_BOUNDARY);

      // A malformed artifact through the boundary cannot be written; the raw
      // store admits bytes, and the boundary classifies the result as torn.
      writeFileSync(ledgerPath(identity), `{not-a-record\n`);
      const torn = boundary.read();
      expect(torn.ok).toBe(false);
      if (!torn.ok) expect(torn.error.code).toBe("state.store.torn");
      writeFileSync(ledgerPath(identity), "");

      // Out-of-vocabulary value and missing identity are unknown reads.
      const acquired = store.acquireFence("ceremony-seed");
      if (!acquired.ok) throw new Error(acquired.error.code);
      try {
        const seeded = store.append(acquired.value.handle, {
          kind: "ceremony.artifact",
          recordKey: "ceremony.artifacts:A-1",
          payload: ceremonyPayload({ status: "almost-approved" }) as never,
        });
        expect(seeded.ok).toBe(true);
        const unknown = boundary.read();
        expect(unknown.ok).toBe(false);
        if (!unknown.ok) {
          expect(unknown.error.code).toBe("state.store.unknown");
          expect(unknown.error.location.path).toContain("ledger.");
          expect(typeof unknown.error.location.record).toBe("number");
          expect(guidanceFor(unknown.error.code)).toContain("boundary");
        }
      } finally {
        store.releaseFence(acquired.value.handle);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("an undeclared sibling kind classifies as unknown, never ignored", () => {
    const root = makeTempRoot("gh222-ceremony-sibling");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const boundary = createArtifactBoundary(store, CEREMONY_BOUNDARY);
      const acquired = store.acquireFence("ceremony-seed");
      if (!acquired.ok) throw new Error(acquired.error.code);
      try {
        const seeded = store.append(acquired.value.handle, {
          kind: "ceremony.flyer",
          recordKey: "ceremony.artifacts:F-1",
          payload: ceremonyPayload({ artifactId: "F-1" }) as never,
        });
        expect(seeded.ok).toBe(true);
      } finally {
        store.releaseFence(acquired.value.handle);
      }
      const read = boundary.read();
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.error.code).toBe("state.store.unknown");
        expect(read.error.location.record).toBe(1);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("missing identity and refused writes leave the ledger unchanged", () => {
    const root = makeTempRoot("gh222-ceremony-identity");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const boundary = createArtifactBoundary(store, CEREMONY_BOUNDARY);
      const seeded = appendArtifact(boundary, store, {
        kind: "ceremony.artifact",
        recordKey: "ceremony.artifacts:A-0",
        payload: ceremonyPayload({ artifactId: "A-0" }) as never,
      });
      expect(seeded.ok).toBe(true);
      const before = ledgerBytes(identity);
      const refused = appendArtifact(boundary, store, {
        kind: "ceremony.artifact",
        recordKey: "ceremony.artifacts:A-1",
        payload: { schemaId: "delivery.ceremony.artifact.v1", status: "pending" } as never,
      });
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error.code).toBe("state.store.unknown");
      const undeclared = appendArtifact(boundary, store, {
        kind: "ceremony.unknown",
        recordKey: "ceremony.artifacts:A-2",
        payload: ceremonyPayload({ artifactId: "A-2" }) as never,
      });
      expect(undeclared.ok).toBe(false);
      if (!undeclared.ok) expect(undeclared.error.code).toBe("state.store.unknown");
      expect(ledgerBytes(identity).equals(before)).toBe(true);
      const read = boundary.read();
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.artifacts).toHaveLength(1);
        expect(read.value.artifacts[0]?.payload).toEqual(
          ceremonyPayload({ artifactId: "A-0" }) as never,
        );
      }
      expect(ledgerText(identity)).not.toContain("ceremony.unknown");
    } finally {
      removeRoot(root);
    }
  });
});
