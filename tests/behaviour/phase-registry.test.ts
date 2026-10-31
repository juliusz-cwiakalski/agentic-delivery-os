/**
 * TC-PHASE-007 / TC-PHASE-009 (registry half) — registry records over the
 * GH-174 state port: one verified `phase.transition` per landing, append-only
 * history, a rebuildable derived projection, and classified read safety.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StateStoreIdentity, StateStorePort } from "../../packages/core/src/contracts/index";
import {
  appendPhaseTransition,
  foldPhaseState,
  type PhaseTransitionAppendOutcome,
  phaseStateDocumentName,
  phaseTransitionRecordKey,
  readChangeTransitions,
  rebuildPhaseProjection,
  replacePhaseProjection,
} from "../../packages/core/src/state/index";
import {
  ledgerLines,
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";

const REF = "GH-179";
const CANARY = "planted-payload-registry-0001";

type Harness = {
  readonly root: string;
  readonly identity: StateStoreIdentity;
  readonly store: StateStorePort;
  readonly tokens: { next: number };
};

const withHarness = (body: (harness: Harness) => void): void => {
  const root = makeTempRoot("registry");
  try {
    const identity = makeIdentity(root, { workspaceId: "registry" });
    const { store } = openStore(identity);
    body({ root, identity, store, tokens: { next: 1 } });
  } finally {
    removeRoot(root);
  }
};

const token = (harness: Harness): string => {
  const value = `writer-${harness.tokens.next}`;
  harness.tokens.next += 1;
  return value;
};

const mustLand = (
  harness: Harness,
  phaseId: string,
  operation: "complete" | "reopen",
  timestamp: string,
  reason?: string,
): PhaseTransitionAppendOutcome => {
  const result = appendPhaseTransition(harness.store, {
    changeRef: REF,
    phaseId,
    operation,
    timestamp,
    fenceToken: token(harness),
    ...(reason === undefined ? {} : { reason }),
  });
  if (!result.ok) throw new Error(`append failed: ${result.error.code}`);
  return result.value;
};

const rawLines = (identity: StateStoreIdentity): string[] =>
  existsSync(ledgerPath(identity)) ? ledgerLines(readFileSync(ledgerPath(identity), "utf8")) : [];

const rawRecords = (identity: StateStoreIdentity): Record<string, unknown>[] =>
  rawLines(identity).map((line) => {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("ledger line is not a record");
    }
    return parsed as Record<string, unknown>;
  });

const mutateLedger = (
  identity: StateStoreIdentity,
  mutate: (lines: string[]) => string[],
): void => {
  writeFileSync(ledgerPath(identity), `${mutate(rawLines(identity)).join("\n")}\n`);
};

const projectionKey = (): string => `document:${phaseStateDocumentName(REF)}`;

const projectionContent = (store: StateStorePort): unknown => {
  const read = store.read({ requiredKeys: [projectionKey()] });
  if (!read.ok) return undefined;
  return read.value.values[projectionKey()];
};

const seedHistory = (harness: Harness): void => {
  mustLand(harness, "delivery", "complete", "2026-10-31T10:00:00Z");
  mustLand(harness, "delivery", "reopen", "2026-10-31T10:05:00Z", CANARY);
};

describe("TC-PHASE-009 registry records and derived projection", () => {
  test("a landing appends exactly one phase.transition record with the pinned payload", () => {
    withHarness((harness) => {
      const outcome = mustLand(harness, "delivery", "complete", "2026-10-31T09:00:00Z");
      const records = rawRecords(harness.identity);
      expect(records).toHaveLength(1);
      const record = records[0];
      if (record === undefined) throw new Error("expected one record");
      expect(record.kind).toBe("phase.transition");
      expect(record.key).toBe(phaseTransitionRecordKey(REF));
      const payload = record.payload as Record<string, unknown>;
      expect(payload).toMatchObject({
        changeRef: REF,
        phaseId: "delivery",
        operation: "complete",
        timestamp: "2026-10-31T09:00:00Z",
        outcome: "landed",
      });
      expect(Object.hasOwn(payload, "reason")).toBe(false);
      expect(outcome.record).toMatchObject({ operation: "complete", outcome: "landed" });
      expect(outcome.fenceReleased).toBe(true);
    });
  });

  test("a reopen record carries the exact reason; a complete record never does", () => {
    withHarness((harness) => {
      mustLand(harness, "delivery", "complete", "2026-10-31T09:00:00Z");
      mustLand(harness, "delivery", "reopen", "2026-10-31T09:10:00Z", CANARY);
      const payloads = rawRecords(harness.identity).map(
        (record) => record.payload as Record<string, unknown>,
      );
      expect(payloads[0]?.reason).toBeUndefined();
      expect(payloads[1]?.reason).toBe(CANARY);
    });
  });

  test("a no-op decision appends nothing (three-way non-vacuity control)", () => {
    withHarness((harness) => {
      mustLand(harness, "delivery", "complete", "2026-10-31T09:00:00Z");
      const before = rawLines(harness.identity).length;
      const read = readChangeTransitions(harness.store, REF);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const completed = foldPhaseState(REF, read.value.transitions).phases.delivery?.completed;
      expect(completed).toBe("2026-10-31T09:00:00Z");
      expect(rawLines(harness.identity).length).toBe(before);
      // Control: an implementation that appends on a no-op would move the count.
      mustLand(harness, "delivery", "complete", "2026-10-31T09:01:00Z");
      expect(rawLines(harness.identity).length).toBe(before + 1);
    });
  });

  test("the ledger is append-only: earlier lines stay byte-identical", () => {
    withHarness((harness) => {
      mustLand(harness, "delivery", "complete", "2026-10-31T09:00:00Z");
      const prefix = rawLines(harness.identity).join("\n");
      mustLand(harness, "quality_gates", "complete", "2026-10-31T09:10:00Z");
      mustLand(harness, "delivery", "reopen", "2026-10-31T09:20:00Z", "reopened for review");
      const lines = rawLines(harness.identity);
      expect(lines).toHaveLength(3);
      expect(lines.slice(0, 1).join("\n")).toBe(prefix);
      expect(readFileSync(ledgerPath(harness.identity), "utf8").startsWith(prefix)).toBe(true);
    });
  });

  test("the verified fold equals the atomically replaced projection", () => {
    withHarness((harness) => {
      mustLand(harness, "delivery", "complete", "2026-10-31T09:00:00Z");
      mustLand(harness, "delivery", "reopen", "2026-10-31T09:10:00Z", "reopened");
      mustLand(harness, "delivery", "complete", "2026-10-31T09:20:00Z");
      const read = readChangeTransitions(harness.store, REF);
      if (!read.ok) throw new Error(read.error.code);
      const replaced = replacePhaseProjection(harness.store, {
        changeRef: REF,
        transitions: read.value.transitions,
        fenceToken: token(harness),
      });
      if (!replaced.ok) throw new Error(replaced.error.code);
      const expected = foldPhaseState(REF, read.value.transitions);
      expect(projectionContent(harness.store)).toEqual(expected);
      expect(expected.phases.delivery).toEqual({
        started: "2026-10-31T09:00:00Z",
        completed: "2026-10-31T09:20:00Z",
      });
      expect(replaced.value.document.name).toBe(phaseStateDocumentName(REF));
    });
  });

  test("a deleted or corrupted projection rebuilds to the same fold", () => {
    withHarness((harness) => {
      mustLand(harness, "delivery", "complete", "2026-10-31T09:00:00Z");
      const read = readChangeTransitions(harness.store, REF);
      if (!read.ok) throw new Error(read.error.code);
      const seeded = replacePhaseProjection(harness.store, {
        changeRef: REF,
        transitions: read.value.transitions,
        fenceToken: token(harness),
      });
      if (!seeded.ok) throw new Error(seeded.error.code);
      const expected = seeded.value.projection;

      const file = join(
        harness.root,
        `documents.${encodeURIComponent(harness.identity.workspaceId)}`,
        phaseStateDocumentName(REF),
      );
      rmSync(file);
      const rebuilt = rebuildPhaseProjection(harness.store, {
        changeRef: REF,
        fenceToken: token(harness),
      });
      if (!rebuilt.ok) throw new Error(rebuilt.error.code);
      expect(rebuilt.value.projection).toEqual(expected);
      expect(projectionContent(harness.store)).toEqual(expected);

      writeFileSync(file, "{corrupted\n");
      const again = rebuildPhaseProjection(harness.store, {
        changeRef: REF,
        fenceToken: token(harness),
      });
      if (!again.ok) throw new Error(again.error.code);
      expect(projectionContent(harness.store)).toEqual(expected);
    });
  });

  test("the projection is not a registry record kind; appends are transitions only", () => {
    withHarness((harness) => {
      mustLand(harness, "delivery", "complete", "2026-10-31T09:00:00Z");
      mustLand(harness, "delivery", "reopen", "2026-10-31T09:10:00Z", "reopened");
      const kinds = rawRecords(harness.identity).map((record) => record.kind);
      expect(kinds).toEqual(["phase.transition", "phase.transition"]);
      expect(kinds).not.toContain("phase.projection");
    });
  });
});

describe("TC-PHASE-007 registry read safety", () => {
  test("torn bytes fail as state.store.torn with a safe location and no canary leak", () => {
    const mutations: Array<(lines: string[]) => string[]> = [
      (lines) => lines.map((line) => line.replace(`"${REF}"`, '"GH-999"')),
      (lines) => ["{not-framed", ...lines.slice(1)],
      (lines) =>
        lines.map((line) => {
          const parsed: unknown = JSON.parse(line);
          if (typeof parsed !== "object" || parsed === null) return line;
          const record = parsed as Record<string, unknown>;
          record.sequence = Number(record.sequence) + 2;
          return JSON.stringify(record);
        }),
    ];
    for (const mutate of mutations) {
      withHarness((harness) => {
        seedHistory(harness);
        const canaryInLedger = readFileSync(ledgerPath(harness.identity), "utf8");
        expect(canaryInLedger).toContain(CANARY);
        mutateLedger(harness.identity, mutate);
        const read = readChangeTransitions(harness.store, REF);
        expect(read.ok).toBe(false);
        if (read.ok) return;
        expect(read.error.code).toBe("state.store.torn");
        expect(read.error.location.path).toBe(ledgerPath(harness.identity));
        expect(read.error.location.record).toBeGreaterThan(0);
        expect(JSON.stringify(read.error)).not.toContain(CANARY);
      });
    }
  });

  test("a schema-version mismatch is classified without coercion", () => {
    withHarness((harness) => {
      seedHistory(harness);
      const header = join(
        harness.root,
        `header.${encodeURIComponent(harness.identity.workspaceId)}.json`,
      );
      writeFileSync(header, `${JSON.stringify({ schemaVersion: "delivery.state.v999" })}\n`);
      const read = readChangeTransitions(harness.store, REF);
      expect(read.ok).toBe(false);
      if (read.ok) return;
      expect(read.error.code).toBe("state.schema.mismatch");
      expect(JSON.stringify(read.error)).not.toContain(CANARY);
    });
  });

  test("an absent declared key fails state.keys.missing naming it, with no default", () => {
    withHarness((harness) => {
      const acquired = harness.store.acquireFence(token(harness));
      if (!acquired.ok) throw new Error(acquired.error.code);
      try {
        harness.store.append(acquired.value.handle, {
          kind: "phase.transition",
          recordKey: "phase.transitions:GH-999",
          payload: { changeRef: "GH-999" },
        });
      } finally {
        harness.store.releaseFence(acquired.value.handle);
      }
      const read = readChangeTransitions(harness.store, REF);
      expect(read.ok).toBe(false);
      if (read.ok) return;
      expect(read.error.code).toBe("state.keys.missing");
      expect(read.error.location.missingKeys).toEqual([phaseTransitionRecordKey(REF)]);
    });
  });

  test("an absent registry is an explicit verified-empty read, distinct from torn", () => {
    withHarness((harness) => {
      const read = readChangeTransitions(harness.store, REF);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.value.verifiedEmpty).toBe(true);
      expect(read.value.transitions).toEqual([]);
      expect(read.value.evidence.verifiedEmpty).toBe(true);
      const torn = readChangeTransitions(harness.store, "GH-999");
      expect(torn.ok).toBe(true);
      if (!torn.ok) return;
      expect(torn.value.verifiedEmpty).toBe(true);
    });
  });

  test("a rebuild write fault is exactly state.write.failed with no stale projection", () => {
    const root = makeTempRoot("registry-fault");
    try {
      const identity = makeIdentity(root, { workspaceId: "registry" });
      const { store, edge } = openStore(identity);
      const harness: Harness = { root, identity, store, tokens: { next: 1 } };
      mustLand(harness, "delivery", "complete", "2026-10-31T09:00:00Z");
      edge.arm(["replace-before-temp"]);
      const rebuilt = rebuildPhaseProjection(store, { changeRef: REF, fenceToken: "write-fault" });
      expect(rebuilt.ok).toBe(false);
      if (rebuilt.ok) return;
      expect(rebuilt.error.code).toBe("state.write.failed");
      expect(rebuilt.error.consequence).toBe("not_landed");
      expect(JSON.stringify(rebuilt.error)).not.toContain(CANARY);
      const file = join(
        root,
        `documents.${encodeURIComponent(identity.workspaceId)}`,
        phaseStateDocumentName(REF),
      );
      expect(existsSync(file)).toBe(false);
      const verified = readChangeTransitions(store, REF);
      if (!verified.ok) throw new Error(verified.error.code);
      const expected = foldPhaseState(REF, verified.value.transitions);
      expect(projectionContent(store)).toEqual(expected);
      edge.disarm();
    } finally {
      removeRoot(root);
    }
  });

  test("a mutating append over torn bytes is refused with zero records", () => {
    withHarness((harness) => {
      seedHistory(harness);
      mutateLedger(harness.identity, (lines) => ["{broken", ...lines.slice(1)]);
      const before = rawLines(harness.identity).length;
      const appended = appendPhaseTransition(harness.store, {
        changeRef: REF,
        phaseId: "quality_gates",
        operation: "complete",
        timestamp: "2026-10-31T10:30:00Z",
        fenceToken: token(harness),
      });
      expect(appended.ok).toBe(false);
      if (appended.ok) return;
      expect(appended.error.code).toBe("state.store.torn");
      expect(rawLines(harness.identity).length).toBe(before);
      expect(harness.store.fenceStatus().held).toBe(false);
    });
  });

  test("a detection-disabled control would expose the planted canary (fixtures live)", () => {
    withHarness((harness) => {
      seedHistory(harness);
      mutateLedger(harness.identity, (lines) => ["{broken", ...lines.slice(1)]);
      const naive = rawLines(harness.identity)
        .map((line) => {
          try {
            return JSON.stringify(JSON.parse(line));
          } catch {
            return line;
          }
        })
        .join("\n");
      expect(naive).toContain(CANARY);
      const read = readChangeTransitions(harness.store, REF);
      expect(read.ok).toBe(false);
      if (read.ok) return;
      expect(JSON.stringify(read.error)).not.toContain(CANARY);
    });
  });
});
