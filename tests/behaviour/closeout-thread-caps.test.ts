/** TC-CAP-030 — thread and residue caps with explicit truncation. */
import { describe, expect, test } from "bun:test";
import { evaluateThreadPolicy } from "../../packages/core/src/domain/closeout-thread-policy";
import {
  CAPSULE_MAX_HUMAN_THREADS,
  CAPSULE_MAX_RESIDUE_ITEMS,
  type CloseoutThreadAuthorFact,
} from "../../packages/core/src/contracts/index";

const human = (index: number): CloseoutThreadAuthorFact => ({
  threadId: `thread-${index}`,
  authorPrincipal: `@human-${index}`,
  authorKind: "human",
});

describe("TC-CAP-030 thread caps", () => {
  test("human threads beyond the residue cap are truncated with an omitted count", () => {
    const threads = Array.from({ length: CAPSULE_MAX_RESIDUE_ITEMS + 5 }, (_, index) =>
      human(index),
    );
    const result = evaluateThreadPolicy({ threads });
    expect(result.residue.length).toBe(CAPSULE_MAX_RESIDUE_ITEMS);
    expect(result.omitted).toBe(5);
  });

  test("threads beyond the read cap are counted, never resolved", () => {
    const threads = Array.from({ length: CAPSULE_MAX_HUMAN_THREADS + 3 }, (_, index) =>
      human(index),
    );
    const result = evaluateThreadPolicy({ threads });
    expect(result.resolved).toEqual([]);
    expect(result.residue.length).toBe(CAPSULE_MAX_RESIDUE_ITEMS);
    expect(result.omitted).toBe(CAPSULE_MAX_HUMAN_THREADS + 3 - CAPSULE_MAX_RESIDUE_ITEMS);
  });

  test("no thread surface yields no fabricated residue", () => {
    expect(evaluateThreadPolicy({})).toEqual({ resolved: [], residue: [], omitted: 0 });
  });
});
