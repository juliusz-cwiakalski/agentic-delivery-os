/**
 * TC-MCP-016 — prompt-injection inertness: content grants no authority.
 *
 * A unique canary is planted only in fields the engines render within their
 * declared bounds. The positive control proves the content reaches the payload;
 * the tool list, read log, and behaviour stay unchanged. The negative control
 * removes the canary and proves the absence assertion is not vacuous.
 */
import { describe, expect, test } from "bun:test";
import {
  nodePmNotesFileSystemFacts,
  readPmNotesText,
} from "../../packages/adapters/src/file/index";
import { readChangeTransitionsTolerant } from "../../packages/core/src/state/index";
import { createToolset } from "../../packages/mcp/src/index";
import {
  createVerifyHarness,
  createVerifyRecorder,
  createVerifyState,
  guardStore,
  readFixture,
} from "../behaviour/verify-support";
import {
  CANARY,
  customTarget,
  HOSTILE_TEXT,
  removeTarget,
} from "../fixtures/mcp/injection/fixtures";
import { handlerRecursionViolations, handlerUnsafeViolations } from "../fixtures/mcp/mutants/scan";
import { canonicalJson } from "../fixtures/mcp/parity/canonical";
import {
  baseFacts,
  createStatusRecorder,
  makeWorkItem,
  statusRuntime,
  workItemRead,
} from "../fixtures/status/harness";
import {
  clone,
  EXPECTED_JOBS,
  baseFacts as gatesBaseFacts,
  run,
} from "../fixtures/verify-gates/cases/facts";
import { gatesRuntime } from "../fixtures/verify-gates/cases/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();

const statusFactsWithCanary = () =>
  baseFacts({
    tracker: workItemRead([
      makeWorkItem({ entityId: "GH-9001", title: HOSTILE_TEXT, updatedAt: "2026-10-30T00:00:00Z" }),
    ]),
  });

const statusFactsClean = () =>
  baseFacts({
    tracker: workItemRead([
      makeWorkItem({ entityId: "GH-9001", title: "Clean item", updatedAt: "2026-10-30T00:00:00Z" }),
    ]),
  });

const gateFactsWithCanary = () => {
  const names = [CANARY, ...EXPECTED_JOBS.slice(1)];
  const facts = clone(gatesBaseFacts());
  facts.workflow = { outcome: "read", names };
  facts.checkRuns = {
    ok: true,
    value: {
      items: names.slice(1).map((name) => run(name, "succeeded")),
      pageItemCount: names.length,
    },
  };
  facts.workItem = {
    ok: true,
    value: {
      item: {
        ...clone(gatesBaseFacts()).workItem.value.item,
        title: "clean-title",
      },
    },
  };
  return facts;
};

const gateFactsClean = () => clone(gatesBaseFacts());

const containsCanary = (value: unknown): boolean => JSON.stringify(value).includes(CANARY);

describe("TC-MCP-016 positive controls plant the canary in the payload", () => {
  test("status renders the tracker title canary as inert data", async () => {
    const recorder = createStatusRecorder();
    const result = await createToolset({
      brand: SYNTHETIC_BRAND,
      status: statusRuntime(statusFactsWithCanary(), recorder),
    }).callTool("status");
    expect(result.ok).toBe(true);
    if (result.ok) expect(containsCanary(result.data)).toBe(true);
  });

  test("gate-report renders a workflow job-name canary as cited evidence", async () => {
    const result = await createToolset({
      brand: SYNTHETIC_BRAND,
      gates: gatesRuntime({ facts: gateFactsWithCanary() }),
    }).callTool("gate-report", { ref: "GH-178" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(containsCanary(result.error)).toBe(true);
  });

  test("verify-artifact echoes a valid canary ref as data", async () => {
    const document = readFixture("full/base-complete.yaml").replaceAll("GH-177", CANARY);
    const target = customTarget(CANARY, document);
    const harness = createVerifyHarness({ changesDirectory: target.changesDirectory });
    try {
      const result = await createToolset({
        brand: SYNTHETIC_BRAND,
        verify: harness.runtime,
      }).callTool("verify-artifact", { ref: CANARY });
      expect(result.ok).toBe(true);
      if (result.ok) expect(containsCanary(result.data)).toBe(true);
    } finally {
      harness.cleanup();
      removeTarget(target);
    }
  });
});

describe("TC-MCP-016 the canary grants no authority", () => {
  test("tools/list is byte-identical before and after the hostile call and has no canary", async () => {
    const toolset = createToolset({
      brand: SYNTHETIC_BRAND,
      status: statusRuntime(statusFactsWithCanary()),
    });
    const before = canonicalJson(toolset.listTools());
    await toolset.callTool("status");
    const after = canonicalJson(toolset.listTools());
    expect(after).toBe(before);
    expect(after).not.toContain(CANARY);
  });

  test("the hostile content triggers no extra read", async () => {
    const hostileRecorder = createStatusRecorder();
    await createToolset({
      brand: SYNTHETIC_BRAND,
      status: statusRuntime(statusFactsWithCanary(), hostileRecorder),
    }).callTool("status");
    const cleanRecorder = createStatusRecorder();
    await createToolset({
      brand: SYNTHETIC_BRAND,
      status: statusRuntime(statusFactsClean(), cleanRecorder),
    }).callTool("status");
    expect(hostileRecorder.calls).toEqual(cleanRecorder.calls);
  });

  test("a subsequent normal call still returns its normal payload", async () => {
    const toolset = createToolset({
      brand: SYNTHETIC_BRAND,
      status: statusRuntime(statusFactsWithCanary()),
      gates: gatesRuntime({ facts: gateFactsClean() }),
    });
    const hostile = await toolset.callTool("status");
    expect(hostile.ok).toBe(true);
    const normal = await toolset.callTool("gate-report", { ref: "GH-178" });
    expect(normal.ok).toBe(true);
    if (normal.ok) expect(containsCanary(normal.data)).toBe(false);
  });

  test("handlers contain no tool recursion, eval, spawn, or dynamic import", () => {
    const recursion = handlerRecursionViolations(ROOT);
    const unsafe = handlerUnsafeViolations(ROOT);
    expect(recursion.files.length).toBeGreaterThan(0);
    expect(recursion.violations).toEqual([]);
    expect(unsafe.violations).toEqual([]);
  });

  test("the negative control removes the canary and the assertion fails", async () => {
    const result = await createToolset({
      brand: SYNTHETIC_BRAND,
      status: statusRuntime(statusFactsClean()),
    }).callTool("status");
    expect(result.ok).toBe(true);
    if (result.ok) expect(containsCanary(result.data)).toBe(false);
  });

  test("the guarded store records no mutation during the hostile verify call", async () => {
    const state = createVerifyState();
    const recorder = createVerifyRecorder();
    const guarded = guardStore(state.store, recorder, { throwOnMutation: true });
    const document = readFixture("full/base-complete.yaml").replaceAll("GH-177", CANARY);
    const target = customTarget(CANARY, document);
    try {
      const result = await createToolset({
        brand: SYNTHETIC_BRAND,
        verify: {
          readPmNotes: (ref) =>
            readPmNotesText({
              changeRef: ref,
              changesDirectory: target.changesDirectory,
              fs: nodePmNotesFileSystemFacts(),
            }),
          readRegistry: (ref) => {
            const read = readChangeTransitionsTolerant(guarded.store, ref);
            return read.ok
              ? {
                  ok: true,
                  present: read.value.present,
                  verifiedEmpty: read.value.verifiedEmpty,
                  transitions: read.value.transitions,
                  recordCount: read.value.evidence.recordCount,
                }
              : { ok: false, error: read.error };
          },
        },
      }).callTool("verify-artifact", { ref: CANARY });
      expect(result.ok).toBe(true);
      const mutations = recorder.calls.filter((call) =>
        [
          "append",
          "replaceDocument",
          "acquireFence",
          "releaseFence",
          "recoverFence",
          "repairTornTail",
          "salvage",
        ].includes(call),
      );
      expect(mutations).toEqual([]);
    } finally {
      state.cleanup();
      removeTarget(target);
    }
  });
});
