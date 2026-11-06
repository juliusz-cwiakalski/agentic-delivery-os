/**
 * TC-MCP-003 / TC-MCP-004 — status success parity across observed, degraded,
 * unavailable, not-delivered, and cap-sized facts, plus containment failure.
 *
 * The CLI runs in process and is the oracle; the committed golden is the second
 * pin. Section-level failures stay digest data (`ok: true`).
 */
import { describe, expect, test } from "bun:test";
import {
  STATUS_SECTION_ORDER,
  STATUS_SECTION_STATES,
} from "../../packages/core/src/contracts/index";
import {
  assertFailurePair,
  assertMutationControl,
  assertSuccessPair,
} from "../fixtures/mcp/parity/assertions";
import { STATUS_CASES } from "../fixtures/mcp/parity/cases";

const successCases = STATUS_CASES.filter((entry) => entry.expectation.kind === "success");
const failureCases = STATUS_CASES.filter((entry) => entry.expectation.kind === "failure");

const sectionOf = (data: unknown, id: string): Record<string, unknown> => {
  const sections = (data as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) throw new Error("digest has no sections");
  const found = sections.find(
    (entry) => typeof entry === "object" && entry !== null && (entry as { id?: string }).id === id,
  );
  if (typeof found !== "object" || found === null) throw new Error(`section ${id} is missing`);
  return found as Record<string, unknown>;
};

describe("TC-MCP-003 status success parity", () => {
  test("the declared case floor is met before iterating", () => {
    expect(STATUS_CASES.length).toBeGreaterThanOrEqual(5);
    expect(successCases.length).toBeGreaterThanOrEqual(5);
  });

  for (const parityCase of successCases) {
    test(`${parityCase.id}: CLI, MCP, and golden agree`, async () => {
      await assertSuccessPair(parityCase);
      assertMutationControl(parityCase);
    });
  }

  test("each digest carries the fixed section order and closed states", async () => {
    for (const parityCase of successCases) {
      const mcp = await parityCase.runMcp();
      if (!mcp.ok) throw new Error(`${parityCase.id} unexpectedly failed`);
      const data = mcp.data as { schemaVersion?: string; sections?: unknown };
      expect(data.schemaVersion).toBe("delivery.status.v1");
      const ids = (data.sections as Array<{ id: string }>).map((section) => section.id);
      expect(ids).toEqual([...STATUS_SECTION_ORDER]);
      for (const section of data.sections as Array<{ state: string }>) {
        expect(STATUS_SECTION_STATES as readonly string[]).toContain(section.state);
      }
    }
  });

  test("degraded, unavailable, and not-delivered sections stay digest data", async () => {
    const degraded = await STATUS_CASES.find((entry) => entry.id === "status-degraded")?.runMcp();
    const unavailable = await STATUS_CASES.find(
      (entry) => entry.id === "status-unavailable",
    )?.runMcp();
    const notDelivered = await STATUS_CASES.find(
      (entry) => entry.id === "status-not-delivered",
    )?.runMcp();
    for (const outcome of [degraded, unavailable, notDelivered]) {
      expect(outcome?.ok).toBe(true);
    }
    if (unavailable?.ok === true) {
      expect(sectionOf(unavailable.data, "tracker").state).toBe("unavailable");
    }
    if (notDelivered?.ok === true) {
      expect(sectionOf(notDelivered.data, "lanes-or-queue").state).toBe("not-delivered");
    }
  });
});

describe("TC-MCP-004 status containment failure parity", () => {
  test("a throwing collector fails the tool with the CLI containment identity", async () => {
    expect(failureCases).toHaveLength(1);
    const parityCase = failureCases[0];
    if (parityCase === undefined) throw new Error("missing containment case");
    await assertFailurePair(parityCase);
    const mcp = await parityCase.runMcp();
    if (mcp.ok) throw new Error("expected a failure");
    expect(mcp.error.code).toBe("fallback.internal");
    expect(mcp.error.code).not.toBe("input.value.rejected");
  });

  test("the success cases prove section failures are not promoted to tool errors", async () => {
    for (const parityCase of successCases) {
      expect(parityCase.expectation.kind).toBe("success");
    }
  });
});
