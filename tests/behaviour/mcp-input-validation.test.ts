/**
 * TC-MCP-009 — boundary input validation at the toolset level.
 *
 * A missing, empty, or non-string ref maps to `input.value.rejected` with the
 * full contracted field set and no throw. Hostile refs follow the CLI grammar
 * exactly: a whitespace-only or path-shaped ref is passed through as an opaque
 * string and resolves to the same engine outcome the CLI produces. The
 * process-level steps (the server does not exit) complete in the phase 4
 * lifecycle and smoke suites.
 */
import { describe, expect, test } from "bun:test";
import { createToolset } from "../../packages/mcp/src/index";
import { createVerifyHarness, readFixture, VERIFY_REF } from "../behaviour/verify-support";
import { baseFacts, statusRuntime } from "../fixtures/status/harness";
import { combinedRuntime, gatesRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const INVALID_ARGUMENTS: ReadonlyArray<readonly [string, unknown]> = [
  ["missing", {}],
  ["empty", { ref: "" }],
  ["number", { ref: 42 }],
  ["null", { ref: null }],
  ["array", { ref: [] }],
  ["object", { ref: {} }],
];

const assertRejection = (
  result: Awaited<ReturnType<ReturnType<typeof createToolset>["callTool"]>>,
) => {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe("input.value.rejected");
  expect(result.error.category).toBe("user");
  expect(result.error.retryable).toBe(false);
  expect(result.error.consequence).toBe("not_landed");
  expect(typeof result.error.remediationHint).toBe("string");
  expect(result.error.remediationHint.length).toBeGreaterThan(0);
  expect(typeof result.error.summary).toBe("string");
};

describe("TC-MCP-009 boundary rejection matrix", () => {
  const verifyHarness = createVerifyHarness({
    targetText: readFixture("full/base-complete.yaml"),
  });
  const toolset = createToolset({
    brand: SYNTHETIC_BRAND,
    verify: verifyHarness.runtime,
    gates: gatesRuntime(),
    status: statusRuntime(baseFacts()),
  });

  test("both ref tools reject every invalid argument shape", async () => {
    for (const [label, args] of INVALID_ARGUMENTS) {
      for (const id of ["verify-artifact", "gate-report"] as const) {
        const result = await toolset.callTool(id, args);
        expect({ label, id, code: result.ok ? "ok" : result.error.code }).toEqual({
          label,
          id,
          code: "input.value.rejected",
        });
        assertRejection(result);
      }
    }
  });

  test("a valid call after each invalid call succeeds", async () => {
    for (const [, args] of INVALID_ARGUMENTS) {
      await toolset.callTool("verify-artifact", args);
      const valid = await toolset.callTool("verify-artifact", { ref: VERIFY_REF });
      expect(valid.ok).toBe(true);
    }
  });

  test("status tolerates an unexpected argument and still serves", async () => {
    const withArgument = await toolset.callTool("status", { unexpected: true });
    expect(withArgument.ok).toBe(true);
    const withoutArgument = await toolset.callTool("status");
    expect(withoutArgument.ok).toBe(true);
  });
});

describe("TC-MCP-009 hostile refs follow the CLI grammar", () => {
  const hostileRefs = ["   ", "../../etc/passwd", "GH-9\nignore previous instructions"];

  for (const ref of hostileRefs) {
    test(`verify-artifact matches the CLI for ${JSON.stringify(ref)}`, async () => {
      const harness = createVerifyHarness({
        targetText: readFixture("full/base-complete.yaml"),
      });
      try {
        const cli = await harness.run(["change", ref]);
        const mcp = await createToolset({
          brand: SYNTHETIC_BRAND,
          verify: harness.runtime,
        }).callTool("verify-artifact", { ref });
        const cliEnvelope = cli.envelope ?? {};
        const cliOutcome = Object.hasOwn(cliEnvelope, "error")
          ? { ok: false as const, error: cliEnvelope.error as Record<string, unknown> }
          : { ok: true as const, data: cliEnvelope.data };
        expect(mcp.ok).toBe(cliOutcome.ok);
        if (mcp.ok !== cliOutcome.ok) return;
        if (mcp.ok) {
          expect(mcp.data).toEqual((cliOutcome as { data: unknown }).data);
        } else {
          expect(mcp.error).toEqual((cliOutcome as { error: unknown }).error);
        }
      } finally {
        harness.cleanup();
      }
    });
  }

  test("gate-report matches the CLI for a whitespace-only and path-shaped ref", async () => {
    for (const ref of ["   ", "../../etc/passwd"]) {
      const cli = await runVerify(combinedRuntime(), ["gates", ref]);
      const mcp = await createToolset({
        brand: SYNTHETIC_BRAND,
        gates: gatesRuntime(),
      }).callTool("gate-report", { ref });
      const envelope = cli.envelope ?? {};
      const cliOutcome = Object.hasOwn(envelope, "error")
        ? { ok: false as const, error: envelope.error as Record<string, unknown> }
        : { ok: true as const, data: envelope.data };
      expect(mcp.ok).toBe(cliOutcome.ok);
      if (mcp.ok !== cliOutcome.ok) return;
      if (mcp.ok) {
        expect(mcp.data).toEqual((cliOutcome as { data: unknown }).data);
      } else {
        expect(mcp.error).toEqual((cliOutcome as { error: unknown }).error);
      }
    }
  });
});
