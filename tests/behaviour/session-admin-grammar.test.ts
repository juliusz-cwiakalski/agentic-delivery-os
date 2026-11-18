/**
 * TC-DB-023..TC-DB-025: grammar rejection before any I/O, the parser
 * containment carve-out, `--json` stripping, repeated-flag last-wins, and the
 * numeric range matrix.
 */
import { describe, expect, test } from "bun:test";
import { classifyDomainKind } from "../../packages/cli/src/classify";
import { createFakeRuntime, runDbCli, type FakeDbRuntime } from "../fixtures/session-admin/harness";

type Run = Awaited<ReturnType<typeof runDbCli>>;

const parse = (run: Run): Record<string, unknown> =>
  JSON.parse(run.stdout) as Record<string, unknown>;

const expectRejected = (run: Run, runtime: FakeDbRuntime): void => {
  expect(run.exitCode).toBe(1);
  if (run.stdout.length > 0) {
    const envelope = parse(run);
    expect(envelope).not.toHaveProperty("data");
    expect(envelope.error).toMatchObject({
      code: "input.value.rejected",
      category: "user",
      retryable: false,
      consequence: "not_landed",
    });
    expect(envelope.exitCode).toBe(1);
  }
  expect(classifyDomainKind("input", "input.value.rejected").projectionClass).toBe(
    "user-validation",
  );
  expect(runtime.calls).toEqual([]);
};

const expectContained = (run: Run, runtime: FakeDbRuntime): void => {
  expect(run.exitCode).toBe(1);
  const envelope = parse(run);
  expect(envelope).not.toHaveProperty("data");
  expect(envelope.error).toMatchObject({
    code: "fallback.invocation",
    category: "user",
    retryable: false,
    consequence: "unknown",
  });
  expect(runtime.calls).toEqual([]);
};

describe("TC-DB-023 grammar rejections before any I/O", () => {
  const rejectionCases: readonly (readonly string[])[] = [
    ["db"],
    ["db", "inspect"],
    ["db", "size", "extra"],
    ["db", "size", "--limit", "5"],
    ["db", "list", "--older-than", "7"],
    ["db", "list", "--limit"],
    ["db", "prune", "--older-than"],
    ["db", "size", "-x"],
  ];

  for (const argv of rejectionCases) {
    test(`${argv.join(" ")} is input.value.rejected in human and --json modes`, async () => {
      for (const suffix of [[], ["--json"]]) {
        const runtime = createFakeRuntime();
        const run = await runDbCli([...argv, ...suffix], runtime);
        expectRejected(run, runtime);
      }
    });
  }

  test("out-of-range and malformed numeric values are rejected", async () => {
    const cases: readonly (readonly string[])[] = [
      ["db", "list", "--limit", "0"],
      ["db", "list", "--limit", "101"],
      ["db", "prune", "--limit", "0"],
      ["db", "prune", "--limit", "501"],
      ["db", "prune", "--older-than", "0"],
      ["db", "prune", "--older-than", "3651"],
      ["db", "list", "--limit", "abc"],
      ["db", "list", "--limit", "1.5"],
      ["db", "prune", "--older-than", "-1"],
      ["db", "list", "--limit", ""],
      ["db", "prune", "--apply", "false"],
    ];
    for (const argv of cases) {
      const runtime = createFakeRuntime();
      const run = await runDbCli([...argv, "--json"], runtime);
      expectRejected(run, runtime);
    }
  });

  test("valid ranges and defaults reach the runtime exactly", async () => {
    const cases: ReadonlyArray<{
      readonly argv: readonly string[];
      readonly method: "size" | "list" | "prune" | "reboot";
      readonly input?: unknown;
    }> = [
      { argv: ["db", "size"], method: "size" },
      { argv: ["db", "list"], method: "list", input: { limit: 20 } },
      { argv: ["db", "list", "--limit", "1"], method: "list", input: { limit: 1 } },
      { argv: ["db", "list", "--limit", "100"], method: "list", input: { limit: 100 } },
      {
        argv: ["db", "prune"],
        method: "prune",
        input: { olderThanDays: 30, limit: 50, apply: false },
      },
      {
        argv: ["db", "prune", "--older-than", "1", "--limit", "500", "--apply"],
        method: "prune",
        input: { olderThanDays: 1, limit: 500, apply: true },
      },
      { argv: ["db", "reboot"], method: "reboot", input: { apply: false } },
      { argv: ["db", "reboot", "--apply"], method: "reboot", input: { apply: true } },
    ];
    for (const item of cases) {
      const runtime = createFakeRuntime();
      const run = await runDbCli([...item.argv, "--json"], runtime);
      expect(run.exitCode, item.argv.join(" ")).toBe(0);
      expect(runtime.calls[0]?.method).toBe(item.method);
      if (item.input !== undefined) expect(runtime.calls[0]?.input).toEqual(item.input);
    }
  });

  test("G-06 prune --json succeeds, proving --json is stripped", async () => {
    const runtime = createFakeRuntime();
    const run = await runDbCli(["db", "prune", "--json"], runtime);
    expect(run.exitCode).toBe(0);
    expect(runtime.calls).toEqual([
      { method: "prune", input: { olderThanDays: 30, limit: 50, apply: false } },
    ]);
    expect(parse(run)).toMatchObject({ data: { command: "prune" } });
  });

  test("G-12 repeated same-flag occurrences are last-wins at exit 0", async () => {
    const applyRuntime = createFakeRuntime();
    const applyRun = await runDbCli(["db", "prune", "--apply", "--apply", "--json"], applyRuntime);
    expect(applyRun.exitCode).toBe(0);
    expect(applyRuntime.calls[0]?.input).toMatchObject({ apply: true });

    const limitRuntime = createFakeRuntime();
    const limitRun = await runDbCli(
      ["db", "prune", "--limit", "5", "--limit", "10", "--json"],
      limitRuntime,
    );
    expect(limitRun.exitCode).toBe(0);
    expect(limitRuntime.calls[0]?.input).toMatchObject({ limit: 10 });
  });

  test("the rejection does not write human output to stdout", async () => {
    const runtime = createFakeRuntime();
    const run = await runDbCli(["db", "size", "extra"], runtime);
    expect(run.exitCode).toBe(1);
    expect(run.stdout).toBe("");
    expect(run.stderr).toContain("input.value.rejected");
  });
});

describe("TC-DB-024 parser containment carve-out at exit 1", () => {
  test("undeclared -- tokens are fallback.invocation with zero runtime calls", async () => {
    for (const argv of [
      ["db", "size", "--bogus"],
      ["db", "size", "--limit=5"],
      ["db", "reboot", "--apply=false"],
      ["db", "size", "--x"],
    ]) {
      const runtime = createFakeRuntime();
      const run = await runDbCli([...argv, "--json"], runtime);
      expectContained(run, runtime);
    }
  });

  test("the same-prefix valid control reaches the runtime", async () => {
    const runtime = createFakeRuntime();
    const run = await runDbCli(["db", "list", "--limit", "5", "--json"], runtime);
    expect(run.exitCode).toBe(0);
    expect(runtime.calls).toEqual([{ method: "list", input: { limit: 5 } }]);
  });

  test("single-dash and undeclared-double-dash are the pinned split", async () => {
    const positional = createFakeRuntime();
    const single = await runDbCli(["db", "size", "-x", "--json"], positional);
    expect(single.exitCode).toBe(1);
    expect((parse(single).error as Record<string, unknown>).code).toBe("input.value.rejected");
    const containedRuntime = createFakeRuntime();
    const doubled = await runDbCli(["db", "size", "--x", "--json"], containedRuntime);
    expect(doubled.exitCode).toBe(1);
    expect((parse(doubled).error as Record<string, unknown>).code).toBe("fallback.invocation");
    expect(positional.calls).toEqual([]);
    expect(containedRuntime.calls).toEqual([]);
  });
});

describe("TC-DB-025 numeric flag range matrix", () => {
  test("min, max, one below, one above, empty, decimal, and non-numeric", async () => {
    const matrix: ReadonlyArray<{
      readonly flag: string;
      readonly min: number;
      readonly max: number;
      readonly prefix: readonly string[];
    }> = [
      { flag: "--limit", min: 1, max: 100, prefix: ["db", "list"] },
      { flag: "--limit", min: 1, max: 500, prefix: ["db", "prune"] },
      { flag: "--older-than", min: 1, max: 3650, prefix: ["db", "prune"] },
    ];
    for (const entry of matrix) {
      for (const value of [entry.min, entry.max]) {
        const runtime = createFakeRuntime();
        const run = await runDbCli([...entry.prefix, entry.flag, String(value), "--json"], runtime);
        expect(run.exitCode, `${entry.prefix.join(" ")} ${entry.flag} ${value}`).toBe(0);
        expect(runtime.calls).toHaveLength(1);
      }
      for (const value of [entry.min - 1, entry.max + 1, 0, -1, 1.5, Number.NaN]) {
        const runtime = createFakeRuntime();
        const token = Number.isNaN(value) ? "abc" : String(value);
        const run = await runDbCli([...entry.prefix, entry.flag, token, "--json"], runtime);
        expectRejected(run, runtime);
      }
    }
  });
});
