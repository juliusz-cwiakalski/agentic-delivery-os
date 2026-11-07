/**
 * TC-ECON-080 — identical facts replay to identical verdicts and economics.
 * Liveness envelopes and economics decisions run twice against structurally
 * identical stores; only run id, timing, and temp roots are normalized. The
 * normalizer never replaces a code, reason, ordinal, or signal value.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSourcedWatchdogSignalSource } from "../../packages/core/src/domain/index";
import { normalizeEnvelopeText, runWatchdogCli } from "../fixtures/watchdog/harness";
import { createWatchdogRepository, type WatchdogTempRepository } from "../fixtures/watchdog/temp-git";
import {
  createEconomicsRuntime,
  runtimeEvidence,
  seedRestarts,
  type EconomicsRuntime,
} from "../fixtures/economics/harness";

const ROOT = process.cwd();
const repos: WatchdogTempRepository[] = [];
const runtimes: EconomicsRuntime[] = [];
afterEach(() => {
  for (const repo of repos.splice(0)) repo.remove();
  for (const created of runtimes.splice(0)) created.close();
});

const repo = (): WatchdogTempRepository => {
  const created = createWatchdogRepository();
  repos.push(created);
  return created;
};

const runtime = (label: string): EconomicsRuntime => {
  const created = createEconomicsRuntime({ bound: 3, label });
  runtimes.push(created);
  return created;
};

const input = () => ({
  workItemRef: "GH-235",
  runId: "run-determinism",
  reason: "session-interrupted" as const,
  evidence: runtimeEvidence(),
});

const facts = () => ({
  readings: [{ kind: "session-traffic" as const, status: "sourced" as const, value: 9, observedAt: "t" }],
  sourcedSignals: [
    { kind: "heartbeat-age" as const, status: "sourced" as const, value: 1_500, observedAt: "t" },
    { kind: "token-delta" as const, status: "sourced" as const, value: 42, observedAt: "t" },
  ],
});

const runLiveness = async (target: WatchdogTempRepository) =>
  runWatchdogCli(["watchdog", "liveness", "lane-1", "--json"], {
    repo: target,
    signalSources: [createSourcedWatchdogSignalSource(() => facts())],
  });

const economicsRun = (label: string): string => {
  const created = runtime(label);
  seedRestarts(created.store, 2);
  const decisions = [created.supervised.attempt(input()), created.supervised.attempt(input())];
  return JSON.stringify({ decisions, view: created.view("GH-235") })
    .split("run-determinism")
    .join("<run-id>")
    .split("run-seed")
    .join("<run-id>");
};

describe("TC-ECON-080 identical facts replay to identical verdicts and economics", () => {
  test("liveness envelopes replay byte-identically against the same repo", async () => {
    const target = repo();
    const first = await runLiveness(target);
    const second = await runLiveness(target);
    expect(normalizeEnvelopeText(first, target.directory)).toEqual(
      normalizeEnvelopeText(second, target.directory),
    );
    const raw = first.stdout;
    for (const token of ["heartbeatAgeMs", "tokenDelta", "traffic", "progressing"]) {
      expect(raw).toContain(token);
    }
  }, 30_000);

  test("a second structurally identical repo yields the same normalized verdict", async () => {
    const firstRepo = repo();
    const secondRepo = repo();
    const first = await runLiveness(firstRepo);
    const second = await runLiveness(secondRepo);
    expect(normalizeEnvelopeText(first, firstRepo.directory)).toEqual(
      normalizeEnvelopeText(second, secondRepo.directory),
    );
  }, 30_000);

  test("two structurally identical stores derive byte-identical decisions and views", () => {
    const left = economicsRun("determinism-left");
    const right = economicsRun("determinism-right");
    expect(left).toBe(right);
    expect(left).toContain('"restarts":3');
    expect(left).toContain("session-interrupted");
    expect(left).toContain('"resumeAmplification"');
    expect(left).toContain('"amplificationFlag"');
  });

  test("the normalizer replaces only volatile fields and never semantic tokens", async () => {
    const target = repo();
    const run = await runLiveness(target);
    const normalized = JSON.stringify(normalizeEnvelopeText(run, target.directory));
    expect(normalized).toContain('"runId":"<run-id>"');
    expect(normalized).toContain('"totalMs":0');
    expect(normalized).toContain("progressing");
    expect(normalized).toContain("heartbeatAgeMs");
    expect(normalized).not.toContain(target.directory);
    expect(normalized).not.toContain("run-determinism");
    expect(normalized).not.toContain("run-watchdog-fixture");
  }, 30_000);

  test("no fixture reads wall-clock time, randomness, locale, or ordering-dependent state", () => {
    for (const file of [
      "packages/core/src/domain/economics-budget.ts",
      "packages/core/src/domain/economics-resume.ts",
      "packages/core/src/domain/economics-view.ts",
      "packages/core/src/domain/economics-evidence.ts",
    ]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const token of [
        "Date.now",
        "Math.random",
        "performance.now",
        "localeCompare",
        "process.env",
      ]) {
        expect(text, file).not.toContain(token);
      }
    }
  });
});
