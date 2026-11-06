/**
 * Production composition coverage — the shipped default dependency set wires
 * the mode fact and the state-backed audit seam, and its clock is epoch-ms UTC.
 * These assertions were invisible to the injected-dependency TCs.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createProductionDependencies } from "../../packages/cli/src/edge";
import { runCli } from "../../packages/cli/src/index";
import {
  invocationPayloadsOf,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  reservationPayloadsOf,
} from "../fixtures/state/harness";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";
import { IDENTITY_VARIABLE, programFor } from "./audit-run-support";

const EPOCH_FLOOR = 1_600_000_000_000;

describe("production dependency composition", () => {
  test("shipped deps wire the mode fact and a functional audit consumer", async () => {
    const root = makeTempRoot("gh223-production");
    try {
      const stateDirectory = join(root, "state");
      const deps = createProductionDependencies({
        brand: SYNTHETIC_BRAND,
        program: programFor("success"),
        environment: { HOME: root, [IDENTITY_VARIABLE]: "pm-lane-7" },
        stateDirectory,
        workspaceId: "workspace-a",
        fenceNamespace: "fence-a",
        isTTY: false,
      });
      expect(deps.mode).toBe("scripted");
      expect(deps.audit).toBeDefined();
      expect(deps.audit?.scope).toBe("workspace-a");
      expect(deps.audit?.identity).toEqual({ kind: "claimed", value: "pm-lane-7" });

      const stdout = bufferSink();
      const stderr = bufferSink();
      const exitCode = await runCli(["--json", "status"], { stdout, stderr }, deps);
      expect(exitCode).toBe(0);
      expect(stderr.value).toBe("");

      const { store } = openStore(
        makeIdentity(stateDirectory, {
          workspaceId: "workspace-a",
          fenceNamespace: "fence-a",
        }),
      );
      const invocations = invocationPayloadsOf(store);
      const reservations = reservationPayloadsOf(store);
      expect(invocations).toHaveLength(1);
      expect(reservations).toHaveLength(1);
      const invocation = invocations[0];
      expect(invocation?.runId).toBeDefined();
      expect(invocation?.auditSeq).toBe(1);
      expect(reservations[0]?.auditSeq).toBe(invocation?.auditSeq);
      expect(invocation?.startedAt).toBeGreaterThan(EPOCH_FLOOR);
      expect(Number.isInteger(invocation?.startedAt)).toBe(true);
      expect(invocation?.timing).toEqual({ totalMs: expect.any(Number) });
      const timing = (invocation?.timing ?? {}) as { totalMs?: number };
      expect(timing.totalMs).toBeGreaterThanOrEqual(0);
      expect(invocation?.agentIdentity).toEqual({ kind: "claimed", value: "pm-lane-7" });
      expect(invocation?.resultSchemaVersion).toBe("delivery.result.v1");
    } finally {
      removeRoot(root);
    }
  });

  test("the default clock is integer epoch milliseconds UTC", () => {
    const root = makeTempRoot("gh223-production-clock");
    try {
      const deps = createProductionDependencies({
        brand: SYNTHETIC_BRAND,
        program: programFor("success"),
        environment: { HOME: root },
        stateDirectory: join(root, "state"),
      });
      const first = deps.clock.now();
      const second = deps.clock.now();
      expect(Number.isInteger(first)).toBe(true);
      expect(first).toBeGreaterThan(EPOCH_FLOOR);
      expect(second).toBeGreaterThanOrEqual(first);
      expect(second - first).toBeLessThan(60_000);
    } finally {
      removeRoot(root);
    }
  });

  test("the state directory defaults to <home>/<stateDirectoryName>", async () => {
    const root = makeTempRoot("gh223-production-home");
    try {
      const deps = createProductionDependencies({
        brand: SYNTHETIC_BRAND,
        program: programFor("success"),
        environment: { HOME: root },
        workspaceId: "workspace-b",
        fenceNamespace: "fence-b",
        isTTY: false,
      });
      expect(deps.audit).toBeDefined();
      expect(deps.audit?.scope).toBe("workspace-b");
      const exitCode = await runCli(
        ["--json", "status"],
        { stdout: bufferSink(), stderr: bufferSink() },
        deps,
      );
      expect(exitCode).toBe(0);

      const stateDirectory = join(root, SYNTHETIC_BRAND.stateDirectoryName);
      const { store } = openStore(
        makeIdentity(stateDirectory, {
          workspaceId: "workspace-b",
          fenceNamespace: "fence-b",
        }),
      );
      expect(invocationPayloadsOf(store)).toHaveLength(1);
    } finally {
      removeRoot(root);
    }
  });

  test("mode is interactive only from an injected interactive stream fact", () => {
    const depsFor = (isTTY: boolean | undefined) =>
      createProductionDependencies({
        brand: SYNTHETIC_BRAND,
        program: programFor("success"),
        environment: {},
        stateDirectory: join(process.cwd(), "tmp", "tmpdir", `gh223-unused-${String(isTTY)}`),
        ...(isTTY === undefined ? {} : { isTTY }),
      });
    expect(depsFor(true).mode).toBe("interactive");
    expect(depsFor(false).mode).toBe("scripted");
    expect(depsFor(undefined).mode).toBe("scripted");
  });

  test("an audit-write failure never changes the command outcome", async () => {
    const root = makeTempRoot("gh223-production-degraded");
    try {
      const blocked = join(root, "blocked");
      writeFileSync(blocked, "not a directory");
      const deps = createProductionDependencies({
        brand: SYNTHETIC_BRAND,
        program: programFor("success"),
        environment: { HOME: root },
        stateDirectory: join(blocked, "state"),
        isTTY: false,
      });
      const stdout = bufferSink();
      const stderr = bufferSink();
      const exitCode = await runCli(["--json", "status"], { stdout, stderr }, deps);
      expect(exitCode).toBe(0);
      const envelope = JSON.parse(stdout.value) as { data: unknown };
      expect(envelope.data).toEqual({ message: "all good", count: 2 });
      expect(stderr.value).toContain("state.write.failed");
    } finally {
      removeRoot(root);
    }
  });

  test("the edge source has no process-relative clock", () => {
    const source = readFileSync(join(process.cwd(), "packages/cli/src/edge.ts"), "utf8");
    expect(source).not.toContain("performance.now");
    expect(source).toContain("Date.now()");
  });
});
