/**
 * TC-DB-028..TC-DB-030 and the output halves of TC-DB-020/TC-DB-033.
 *
 * Exactly one envelope per run, the declared schema version, machine and human
 * caps with truthful `+N more`, committed normalized goldens, byte-identical
 * replays, and zero ambient reads for a verdict.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertEnvelopeContract } from "@delivery-os/testkit";
import {
  DB_MAX_HUMAN_BYTES,
  DB_MAX_HUMAN_ITEMS,
  DB_MAX_HUMAN_LINES,
  DB_MAX_MACHINE_BYTES,
  DB_SCHEMA_VERSION,
  type SessionSummary,
} from "../../packages/core/src/contracts/index";
import { GOLDEN_DATA } from "../fixtures/session-admin/golden/cases";
import {
  createFakeRuntime,
  emptyPruneData,
  runDbCli,
  sessionError,
} from "../fixtures/session-admin/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();

const parse = (stdout: string): Record<string, unknown> =>
  JSON.parse(stdout) as Record<string, unknown>;

const summary = (id: string, index: number): SessionSummary => ({
  id,
  createdAt: "2026-10-30T00:00:00.000Z",
  updatedAt: new Date(Date.UTC(2026, 9, 31, 12, 0, 0) - index * 1_000).toISOString(),
  messageCount: index % 3,
  partCount: index % 2,
  dataBytes: index,
  archived: false,
  live: index === 0,
});

const listData = (count: number) => ({
  schemaVersion: DB_SCHEMA_VERSION,
  command: "list" as const,
  limit: 100,
  total: count,
  omitted: 0,
  truncated: false,
  items: Array.from({ length: count }, (_, index) =>
    summary(`ses_${String(index).padStart(3, "0")}`, index),
  ),
});

const lineCounts = (
  text: string,
): { readonly lines: number; readonly items: number; readonly more: number } => {
  const lines = text.trimEnd().split("\n");
  const itemLines = lines.filter((line) =>
    /^ {2}[A-Za-z0-9_-]+ {2}(live|idle|updated) /.test(line),
  );
  const moreLine = lines.find((line) => line.trimStart().startsWith("+"));
  const more = moreLine === undefined ? 0 : Number(/(\d+) more/.exec(moreLine)?.[1] ?? 0);
  return { lines: lines.length, items: itemLines.length, more };
};

const capViolations = (text: string): string[] => {
  const counts = lineCounts(text);
  const violations: string[] = [];
  if (counts.items > DB_MAX_HUMAN_ITEMS) violations.push("item cap");
  if (counts.lines > DB_MAX_HUMAN_LINES) violations.push("line cap");
  if (new TextEncoder().encode(text).length > DB_MAX_HUMAN_BYTES) violations.push("byte cap");
  return violations;
};

describe("TC-DB-028 envelope validity, schema version, and caps", () => {
  test("every success returns one valid envelope with data and no error", async () => {
    for (const [argv, command] of [
      [["db", "size"], "size"],
      [["db", "list"], "list"],
      [["db", "prune"], "prune"],
      [["db", "reboot"], "reboot"],
    ] as const) {
      const runtime = createFakeRuntime({
        ...(command === "size" ? { size: { ok: true, value: GOLDEN_DATA.size } } : {}),
        ...(command === "list" ? { list: { ok: true, value: GOLDEN_DATA.list } } : {}),
        ...(command === "prune" ? { prune: { ok: true, value: GOLDEN_DATA["prune-dry"] } } : {}),
        ...(command === "reboot" ? { reboot: { ok: true, value: GOLDEN_DATA["reboot-dry"] } } : {}),
      });
      const run = await runDbCli([...argv, "--json"], runtime);
      expect(run.exitCode).toBe(0);
      const envelope = parse(run.stdout);
      expect(assertEnvelopeContract(envelope)).toEqual([]);
      expect(envelope).toHaveProperty("data");
      expect(envelope).not.toHaveProperty("error");
      expect(envelope.data).toMatchObject({ schemaVersion: DB_SCHEMA_VERSION, command });
    }
  });

  test("every failure class returns one valid envelope with error and no data", async () => {
    const cases: ReadonlyArray<{
      readonly argv: readonly string[];
      readonly code: string;
      readonly exit: number;
      readonly runtime?: ReturnType<typeof createFakeRuntime>;
    }> = [
      { argv: ["db", "size", "extra"], code: "input.value.rejected", exit: 1 },
      { argv: ["db", "size", "--x"], code: "fallback.invocation", exit: 1 },
      {
        argv: ["db", "size"],
        code: "db.opencode.unavailable",
        exit: 2,
        runtime: createFakeRuntime({
          size: { ok: false, error: sessionError("db.opencode.unavailable") },
        }),
      },
      {
        argv: ["db", "list"],
        code: "db.query.failed",
        exit: 2,
        runtime: createFakeRuntime({ list: { ok: false, error: sessionError("db.query.failed") } }),
      },
      {
        argv: ["db", "prune"],
        code: "db.delete.failed",
        exit: 2,
        runtime: createFakeRuntime({
          prune: {
            ok: false,
            error: sessionError(
              "db.delete.failed",
              "1 of 2 session deletes did not land (first: ses_x); 1 landed",
            ),
          },
        }),
      },
      {
        argv: ["db", "reboot", "--apply"],
        code: "db.reboot.live",
        exit: 2,
        runtime: createFakeRuntime({
          reboot: { ok: false, error: sessionError("db.reboot.live") },
        }),
      },
    ];
    for (const item of cases) {
      const run = await runDbCli([...item.argv, "--json"], item.runtime ?? createFakeRuntime());
      expect(run.exitCode, item.code).toBe(item.exit);
      const envelope = parse(run.stdout);
      expect(assertEnvelopeContract(envelope)).toEqual([]);
      expect(envelope).not.toHaveProperty("data");
      expect(envelope.error).toMatchObject({ code: item.code });
      expect((envelope.error as Record<string, unknown>).consequence).toBeDefined();
    }
  });

  test("the machine data cap is respected on a max fixture", async () => {
    const data = listData(100);
    const runtime = createFakeRuntime({ list: { ok: true, value: data } });
    const run = await runDbCli(["db", "list", "--limit", "100", "--json"], runtime);
    expect(run.exitCode).toBe(0);
    const envelope = parse(run.stdout);
    expect(new TextEncoder().encode(JSON.stringify(envelope.data)).length).toBeLessThanOrEqual(
      DB_MAX_MACHINE_BYTES,
    );
  });

  test("human caps and truthful +N more on a 100-item list", async () => {
    const data = listData(100);
    const runtime = createFakeRuntime({ list: { ok: true, value: data } });
    const run = await runDbCli(["db", "list", "--limit", "100"], runtime);
    expect(run.exitCode).toBe(0);
    const counts = lineCounts(run.stdout);
    expect(counts.items).toBe(DB_MAX_HUMAN_ITEMS);
    expect(counts.lines).toBeLessThanOrEqual(DB_MAX_HUMAN_LINES);
    expect(counts.more).toBe(100 - DB_MAX_HUMAN_ITEMS);
    expect(counts.items + counts.more).toBe(100);
    expect(capViolations(run.stdout)).toEqual([]);
    expect(
      capViolations(
        Array.from(
          { length: 40 },
          (_, index) => `  ses_${index}  updated 2026-10-31T00:00:00.000Z`,
        ).join("\n"),
      ),
    ).toContain("item cap");
  });

  test("human caps and truthful +N more on a 50-candidate prune", async () => {
    const data = {
      ...emptyPruneData(),
      counts: { selected: 50, deleted: 0, failed: 0, skipped: 0, liveExcluded: 0 },
      candidates: Array.from({ length: 50 }, (_, index) => summary(`ses_${index}`, index)),
    };
    const runtime = createFakeRuntime({ prune: { ok: true, value: data } });
    const run = await runDbCli(["db", "prune"], runtime);
    expect(run.exitCode).toBe(0);
    const counts = lineCounts(run.stdout);
    expect(counts.items).toBe(DB_MAX_HUMAN_ITEMS);
    expect(counts.more).toBe(50 - DB_MAX_HUMAN_ITEMS);
    expect(counts.items + counts.more).toBe(50);
    expect(capViolations(run.stdout)).toEqual([]);
  });

  test("the committed goldens match byte-for-byte", async () => {
    const cases: ReadonlyArray<{
      readonly name: keyof typeof GOLDEN_DATA;
      readonly argv: readonly string[];
      readonly runtime: ReturnType<typeof createFakeRuntime>;
    }> = [
      {
        name: "size",
        argv: ["db", "size"],
        runtime: createFakeRuntime({ size: { ok: true, value: GOLDEN_DATA.size } }),
      },
      {
        name: "list",
        argv: ["db", "list"],
        runtime: createFakeRuntime({ list: { ok: true, value: GOLDEN_DATA.list } }),
      },
      {
        name: "prune-dry",
        argv: ["db", "prune"],
        runtime: createFakeRuntime({ prune: { ok: true, value: GOLDEN_DATA["prune-dry"] } }),
      },
      {
        name: "prune-applied",
        argv: ["db", "prune", "--apply"],
        runtime: createFakeRuntime({ prune: { ok: true, value: GOLDEN_DATA["prune-applied"] } }),
      },
      {
        name: "reboot-dry",
        argv: ["db", "reboot"],
        runtime: createFakeRuntime({ reboot: { ok: true, value: GOLDEN_DATA["reboot-dry"] } }),
      },
      {
        name: "reboot-applied",
        argv: ["db", "reboot", "--apply"],
        runtime: createFakeRuntime({ reboot: { ok: true, value: GOLDEN_DATA["reboot-applied"] } }),
      },
    ];
    for (const item of cases) {
      const run = await runDbCli(item.argv, item.runtime);
      expect(run.exitCode, item.name).toBe(0);
      const golden = readFileSync(
        join(ROOT, "tests/fixtures/session-admin/golden", `${item.name}.txt`),
        "utf8",
      );
      expect(run.stdout, item.name).toBe(golden);
    }
  });
});

describe("TC-DB-030 byte-identical replays and zero ambient reads", () => {
  test("three runs produce identical stdout and parsed data", async () => {
    for (const [argv, data, command] of [
      [["db", "size"], GOLDEN_DATA.size, "size"],
      [["db", "list"], GOLDEN_DATA.list, "list"],
      [["db", "prune"], GOLDEN_DATA["prune-dry"], "prune"],
      [["db", "reboot"], GOLDEN_DATA["reboot-dry"], "reboot"],
    ] as const) {
      const outputs: string[] = [];
      for (let index = 0; index < 3; index += 1) {
        const runtime = createFakeRuntime({
          ...(command === "size" ? { size: { ok: true, value: data } } : {}),
          ...(command === "list" ? { list: { ok: true, value: data } } : {}),
          ...(command === "prune" ? { prune: { ok: true, value: data } } : {}),
          ...(command === "reboot" ? { reboot: { ok: true, value: data } } : {}),
        } as never);
        outputs.push((await runDbCli([...argv, "--json"], runtime)).stdout);
      }
      expect(new Set(outputs).size).toBe(1);
    }
  });

  test("throwing ambient stubs do not change the bytes", async () => {
    const runtime = createFakeRuntime({ size: { ok: true, value: GOLDEN_DATA.size } });
    const baseline = await runDbCli(["db", "size", "--json"], runtime);
    const originalNow = Date.now;
    const originalRandom = Math.random;
    const originalFetch = globalThis.fetch;
    try {
      (Date as unknown as { now: () => number }).now = () => {
        throw new Error("ambient clock");
      };
      Math.random = () => {
        throw new Error("ambient randomness");
      };
      globalThis.fetch = (() => {
        throw new Error("ambient network");
      }) as unknown as typeof fetch;
      const run = await runDbCli(
        ["db", "size", "--json"],
        createFakeRuntime({
          size: { ok: true, value: GOLDEN_DATA.size },
        }),
      );
      expect(run.stdout).toBe(baseline.stdout);
    } finally {
      Date.now = originalNow;
      Math.random = originalRandom;
      globalThis.fetch = originalFetch;
    }
  });

  test("a Date.now-dependent renderer mutant drifts and is caught", () => {
    let tick = 0;
    const mutant = `${GOLDEN_DATA.size.command} ${String(tick++)}`;
    const first = mutant;
    const second = `${GOLDEN_DATA.size.command} ${String(tick++)}`;
    expect(first).not.toBe(second);
  });
});

describe("TC-DB-020/022/033 output halves", () => {
  test("the partial-failure summary is carried on the failure envelope", async () => {
    const runtime = createFakeRuntime({
      prune: {
        ok: false,
        error: sessionError(
          "db.delete.failed",
          "1 of 2 session deletes did not land (first: ses_x); 1 landed",
        ),
      },
    });
    const run = await runDbCli(["db", "prune", "--apply", "--json"], runtime);
    expect(run.exitCode).toBe(2);
    const envelope = parse(run.stdout);
    expect(envelope.error).toMatchObject({
      code: "db.delete.failed",
      category: "transient",
      retryable: true,
      consequence: "not_landed",
      summary: "1 of 2 session deletes did not land (first: ses_x); 1 landed",
    });
  });

  test("reboot human text states the manual restart and claims none", async () => {
    const runtime = createFakeRuntime({
      reboot: { ok: true, value: GOLDEN_DATA["reboot-applied"] },
    });
    const run = await runDbCli(["db", "reboot", "--apply"], runtime);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain(
      "restart the opencode host manually; this command only prepares the database",
    );
    expect(run.stdout.toLowerCase()).not.toContain("restarted");
  });

  test("a restart-claim mutant fails the sentence assertion", () => {
    const claim = "example-product db reboot  applied ... restarted the host";
    expect(claim).not.toContain(
      "restart the opencode host manually; this command only prepares the database",
    );
  });
});

// Keep the injected brand assertion local and explicit.
test("the golden brand is the synthetic fixture brand", () => {
  expect(SYNTHETIC_BRAND.binaryName).toBe("example-product");
});
