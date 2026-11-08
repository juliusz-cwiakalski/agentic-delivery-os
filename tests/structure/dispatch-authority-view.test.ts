/**
 * TC-HAND-004 (phase-3 structure slice) — the derived authority view is
 * complete, rebuilt from the folded handover ledger, replaced atomically, and
 * fail-safe: absent, unreadable, or malformed resolves to dual-run.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildDispatchAuthorityView,
  dualRunAuthority,
  foldDispatchHandover,
  parseDispatchAuthorityText,
  parseDispatchAuthorityView,
} from "../../packages/core/src/domain/dispatch-authority";
import {
  appendDispatchHandover,
  readDispatchHandover,
  writeDispatchAuthority,
} from "../../packages/core/src/app/dispatch-ledger";
import {
  listDispatchAuthority,
  readDispatchAuthority,
} from "../../packages/adapters/src/file/dispatch-authority";
import { createDispatchState } from "../fixtures/dispatch/harness";
import { makeHandover, REPOSITORY, REPOSITORY_BETA } from "../fixtures/dispatch/ledger";

describe("TC-HAND-004 the derived view is complete and fail-safe", () => {
  test("the view names identity, authority, handover reference, time, and reversal availability", () => {
    const folded = foldDispatchHandover([makeHandover({ repository: REPOSITORY })]);
    const view = buildDispatchAuthorityView(REPOSITORY, folded);
    expect(view).toMatchObject({
      schema: "delivery.dispatch.authority.v1",
      repository: REPOSITORY,
      authority: "authoritative",
      recordedAt: makeHandover().recordedAt,
      reversalAvailable: true,
    });
    expect(view.handoverRef).toContain(REPOSITORY);
    expect(parseDispatchAuthorityView(view)).toEqual(view);
  });

  test("the latest operation per repository governs and other repositories are untouched", () => {
    const folded = foldDispatchHandover([
      makeHandover({ repository: REPOSITORY, operation: "authoritative" }),
      makeHandover({ repository: REPOSITORY_BETA, operation: "authoritative" }),
      makeHandover({
        repository: REPOSITORY,
        operation: "dual-run",
        recordedAt: "2026-11-09T10:00:00.000Z",
      }),
    ]);
    expect(folded).toHaveLength(2);
    expect(buildDispatchAuthorityView(REPOSITORY, folded).authority).toBe("dual-run");
    expect(buildDispatchAuthorityView(REPOSITORY_BETA, folded).authority).toBe("authoritative");
    expect(buildDispatchAuthorityView(REPOSITORY, folded).reversalAvailable).toBe(false);
  });

  test("the view is rebuilt from the folded ledger after a flip and a reversal", () => {
    const state = createDispatchState("authority-fold");
    try {
      appendDispatchHandover(
        state.store,
        state.fenceToken,
        makeHandover({ operation: "authoritative" }),
      );
      const afterFlip = readDispatchHandover(state.store);
      expect(afterFlip.ok).toBe(true);
      if (!afterFlip.ok) return;
      const foldedFlip = foldDispatchHandover(afterFlip.records);
      expect(buildDispatchAuthorityView(REPOSITORY, foldedFlip).authority).toBe("authoritative");

      appendDispatchHandover(
        state.store,
        state.fenceToken,
        makeHandover({ operation: "dual-run", recordedAt: "2026-11-10T10:00:00.000Z" }),
      );
      const afterReversal = readDispatchHandover(state.store);
      expect(afterReversal.ok).toBe(true);
      if (!afterReversal.ok) return;
      expect(afterReversal.records).toHaveLength(2);
      const foldedReversal = foldDispatchHandover(afterReversal.records);
      expect(buildDispatchAuthorityView(REPOSITORY, foldedReversal).authority).toBe("dual-run");
    } finally {
      state.dispose();
    }
  });

  test("the view is replaced atomically and always reads as a complete version", () => {
    const state = createDispatchState("authority-atomic");
    try {
      const first = { ...dualRunAuthority(REPOSITORY), authority: "authoritative" as const };
      const second = { ...dualRunAuthority(REPOSITORY), authority: "dual-run" as const };
      expect(writeDispatchAuthority(state.store, state.fenceToken, first).ok).toBe(true);
      expect(readDispatchAuthority(state.root, REPOSITORY).authority).toBe("authoritative");
      expect(writeDispatchAuthority(state.store, state.fenceToken, second).ok).toBe(true);
      expect(readDispatchAuthority(state.root, REPOSITORY).authority).toBe("dual-run");
      // The observed file is always a complete JSON document.
      expect(
        parseDispatchAuthorityView(
          JSON.parse(
            readFileSync(
              join(
                state.root,
                `documents.${encodeURIComponent(state.workspaceId)}`,
                "dispatch-authority.json",
              ),
              "utf8",
            ),
          ),
        ),
      ).toBeDefined();
    } finally {
      state.dispose();
    }
  });

  test("absent, unreadable, and malformed views resolve to dual-run without throwing", () => {
    const state = createDispatchState("authority-degraded");
    try {
      expect(readDispatchAuthority(state.root, REPOSITORY)).toEqual(dualRunAuthority(REPOSITORY));

      const documents = join(state.root, `documents.${encodeURIComponent(state.workspaceId)}`);
      mkdirSync(documents, { recursive: true });
      const path = join(documents, "dispatch-authority.json");

      writeFileSync(path, "{ not-json");
      expect(readDispatchAuthority(state.root, REPOSITORY)).toEqual(dualRunAuthority(REPOSITORY));

      writeFileSync(path, JSON.stringify({ schema: "other", repository: REPOSITORY }));
      expect(readDispatchAuthority(state.root, REPOSITORY)).toEqual(dualRunAuthority(REPOSITORY));

      chmodSync(path, 0o000);
      expect(readDispatchAuthority(state.root, REPOSITORY)).toEqual(dualRunAuthority(REPOSITORY));
      chmodSync(path, 0o600);
    } finally {
      state.dispose();
    }
  });

  test("the text parser is fail-safe for null, absent, and malformed input", () => {
    expect(parseDispatchAuthorityText(REPOSITORY, null)).toEqual(dualRunAuthority(REPOSITORY));
    expect(parseDispatchAuthorityText(REPOSITORY, "{}")).toEqual(dualRunAuthority(REPOSITORY));
    expect(listDispatchAuthority("/nonexistent-root")).toEqual([]);
  });
});

describe("TC-HAND-004 declared authority fixtures", () => {
  test("the valid authoritative and dual-run fixtures parse, and the malformed one defaults to dual-run", async () => {
    const { readFileSync } = await import("node:fs");
    const fixture = (name: string) =>
      readFileSync(join(process.cwd(), "tests/fixtures/dispatch/authority", name), "utf8");
    const authoritative = parseDispatchAuthorityText(REPOSITORY, fixture("authoritative.json"));
    expect(authoritative.authority).toBe("authoritative");
    expect(authoritative.reversalAvailable).toBe(true);
    const dualRun = parseDispatchAuthorityText(REPOSITORY, fixture("dual-run.json"));
    expect(dualRun.authority).toBe("dual-run");
    const malformed = parseDispatchAuthorityText(REPOSITORY, fixture("malformed.json"));
    expect(malformed).toEqual(dualRunAuthority(REPOSITORY));
  });
});
