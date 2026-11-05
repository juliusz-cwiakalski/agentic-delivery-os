/**
 * TC-WATCHDOG-050..053 — exactly one valid exclusive envelope per invocation,
 * text/JSON evidence parity, existing identities for grammar failures, and the
 * unknown-lane handler identity.
 */
import { describe, expect, test } from "bun:test";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { dataOf, errorOf, parseEnvelope, runWatchdogCli } from "../fixtures/watchdog/harness";
import { disposeMatrix, runReachableMatrix } from "../fixtures/watchdog/matrix";
import {
  createWatchdogRepository,
  makeClean,
  makeDirty,
  makeSuccessResidue,
} from "../fixtures/watchdog/temp-git";
import { isSingleJsonDocument, SYNTHETIC_BRAND } from "../golden/helpers";

const MANDATORY = ["schemaVersion", "runId", "exitCode", "timing"] as const;
const ERROR_KEYS = ["code", "category", "retryable", "consequence", "remediationHint"] as const;

describe("TC-WATCHDOG-050 every invocation emits exactly one valid exclusive envelope", () => {
  test("the reachable matrix satisfies the shared envelope contract", async () => {
    const entries = await runReachableMatrix();
    try {
      for (const entry of entries) {
        const envelope = parseEnvelope(entry.run);
        expect(isSingleJsonDocument(entry.run.stdout), entry.id).toBe(true);
        expect(assertEnvelopeContract(envelope), entry.id).toEqual([]);
        for (const key of MANDATORY) {
          expect(envelope, entry.id).toHaveProperty(key);
        }
        const hasData = Object.hasOwn(envelope, "data");
        const hasError = Object.hasOwn(envelope, "error");
        expect(hasData, entry.id).not.toBe(hasError);
        expect(envelope.exitCode, entry.id).toBe(entry.run.exitCode);
        expect(entry.run.stderr, entry.id).not.toContain("schemaVersion");
        if (hasError) {
          const error = errorOf(envelope);
          for (const key of ERROR_KEYS) {
            expect(error, entry.id).toHaveProperty(key);
          }
          expect(String(error.summary).length, entry.id).toBeGreaterThan(0);
          expect(envelope, entry.id).not.toHaveProperty("data");
        } else {
          expect(Object.hasOwn(envelope, "data"), entry.id).toBe(true);
          expect(typeof dataOf(envelope)).toBe("object");
        }
      }
    } finally {
      disposeMatrix(entries);
    }
  }, 30_000);
});

describe("TC-WATCHDOG-051 text lines carry the same evidence as --json", () => {
  test("a clean admission renders a verdict line with the same evidence and no envelope", async () => {
    const repo = createWatchdogRepository();
    try {
      makeClean(repo);
      const json = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], { repo });
      const text = await runWatchdogCli(["watchdog", "preflight", "lane-1"], { repo });
      const evidence = String(dataOf(parseEnvelope(json)).evidence);
      expect(text.exitCode).toBe(0);
      expect(text.stderr).toBe("");
      expect(text.stdout).toContain("preflight");
      expect(text.stdout).toContain("ok");
      expect(text.stdout).toContain(evidence);
      expect(text.stdout).not.toContain("schemaVersion");
      expect(text.stdout).toContain(SYNTHETIC_BRAND.binaryName);
    } finally {
      repo.remove();
    }
  });

  test("a refusal puts the same evidence on stderr and never emits an envelope in text mode", async () => {
    const repo = createWatchdogRepository();
    try {
      makeDirty(repo);
      const json = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], { repo });
      const summary = String(errorOf(parseEnvelope(json)).summary);
      const text = await runWatchdogCli(["watchdog", "preflight", "lane-1"], { repo });
      expect(text.exitCode).toBe(1);
      expect(text.stdout).toBe("");
      expect(text.stderr).toContain(summary);
      expect(text.stderr).toContain(SYNTHETIC_BRAND.binaryName);
      expect(text.stderr).not.toContain("schemaVersion");
    } finally {
      repo.remove();
    }
  });

  test("teardown text lines name each action and memory entry with its evidence", async () => {
    const repo = createWatchdogRepository();
    try {
      makeSuccessResidue(repo);
      const text = await runWatchdogCli(["watchdog", "teardown", "lane-1"], { repo });
      expect(text.exitCode).toBe(0);
      expect(text.stderr).toBe("");
      expect(text.stdout).toContain("teardown");
      expect(text.stdout).toContain("action remove-residue");
      expect(text.stdout).toContain("work/residue.txt");
      expect(text.stdout).not.toContain("schemaVersion");
    } finally {
      repo.remove();
    }
  });

  test("signals-absent text states the answer is unknown and carries no verdict", async () => {
    const repo = createWatchdogRepository();
    try {
      const json = await runWatchdogCli(["watchdog", "liveness", "lane-1", "--json"], { repo });
      const summary = String(errorOf(parseEnvelope(json)).summary);
      const text = await runWatchdogCli(["watchdog", "liveness", "lane-1"], { repo });
      expect(text.exitCode).toBe(2);
      expect(text.stdout).toBe("");
      expect(text.stderr).toContain(summary);
      expect(text.stderr).toContain("unknown");
      expect(text.stderr).not.toContain('"verdict"');
    } finally {
      repo.remove();
    }
  });
});

describe("TC-WATCHDOG-052 parser and grammar failures reuse existing identities", () => {
  test("every grammar failure resolves to an existing identity and performs no lane read", async () => {
    const cases: readonly { readonly argv: readonly string[]; readonly identity: string }[] = [
      { argv: ["watchdog", "--json"], identity: "input.value.rejected" },
      { argv: ["watchdog", "bogus", "--json"], identity: "input.value.rejected" },
      { argv: ["watchdog", "preflight", "--json"], identity: "input.value.rejected" },
      {
        argv: ["watchdog", "preflight", "lane-1", "extra", "--json"],
        identity: "fallback.invocation",
      },
      {
        argv: ["watchdog", "preflight", "--bogus", "lane-1", "--json"],
        identity: "fallback.invocation",
      },
      { argv: ["nope", "--json"], identity: "fallback.invocation" },
    ];
    const repo = createWatchdogRepository();
    try {
      for (const grammarCase of cases) {
        const run = await runWatchdogCli(grammarCase.argv, { repo });
        const envelope = parseEnvelope(run);
        expect(run.exitCode, grammarCase.argv.join(" ")).toBe(1);
        expect(errorOf(envelope).code, grammarCase.argv.join(" ")).toBe(grammarCase.identity);
        expect(errorOf(envelope).code).not.toBe("fallback.internal");
        expect(run.runtimeCalls, grammarCase.argv.join(" ")).toEqual([]);
      }
    } finally {
      repo.remove();
    }
  }, 20_000);
});

describe("TC-WATCHDOG-053 an unknown or unresolvable lane reuses the handler identity", () => {
  test("all three probes classify input.value.rejected with no mutation", async () => {
    const repo = createWatchdogRepository();
    try {
      for (const probe of ["preflight", "teardown", "liveness"]) {
        for (const lane of ["missing-lane", ""]) {
          const run = await runWatchdogCli(["watchdog", probe, lane, "--json"], {
            repo,
            laneRead: { ok: false, reason: "missing" },
          });
          const envelope = parseEnvelope(run);
          const error = errorOf(envelope);
          expect(run.exitCode, `${probe}:${lane}`).toBe(1);
          expect(error.code, `${probe}:${lane}`).toBe("input.value.rejected");
          expect(String(error.summary), `${probe}:${lane}`).toContain("lane");
          expect(envelope).not.toHaveProperty("data");
          expect(run.runtimeCalls).toEqual(lane === "" ? [] : [`readLane:${lane}`]);
        }
      }
    } finally {
      repo.remove();
    }
  }, 20_000);
});
