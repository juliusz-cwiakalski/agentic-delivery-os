/**
 * TC-WATCHDOG-070 — identical checkout/lane facts replay to identical verdict,
 * evidence, action order, and exit. The normalizer replaces the temp root and the
 * volatile run fields only; branch names, refs, and evidence text survive.
 */
import { describe, expect, test } from "bun:test";
import {
  dataOf,
  normalizeEnvelopeText,
  normalizeText,
  parseEnvelope,
  runWatchdogCli,
} from "../fixtures/watchdog/harness";
import {
  createWatchdogRepository,
  makeClean,
  makeSuccessResidue,
  type WatchdogTempRepository,
} from "../fixtures/watchdog/temp-git";

const normalizedRun = async (
  setup: (repo: WatchdogTempRepository) => void,
  argv: readonly string[],
): Promise<{
  readonly envelope: Record<string, unknown>;
  readonly text: string;
  readonly exitCode: number;
}> => {
  const repo = createWatchdogRepository();
  try {
    setup(repo);
    const run = await runWatchdogCli(argv, { repo });
    return {
      envelope: normalizeEnvelopeText(run, repo.directory),
      text: normalizeText(`${run.stdout}${run.stderr}`, repo.directory),
      exitCode: run.exitCode,
    };
  } finally {
    repo.remove();
  }
};

describe("TC-WATCHDOG-070 identical facts replay to identical verdict, evidence, and exit", () => {
  test("preflight clean replay is identical across runs and structurally identical roots", async () => {
    const first = await normalizedRun(makeClean, ["watchdog", "preflight", "lane-1", "--json"]);
    const second = await normalizedRun(makeClean, ["watchdog", "preflight", "lane-1", "--json"]);
    const third = await normalizedRun(makeClean, ["watchdog", "preflight", "lane-1", "--json"]);
    expect(first.exitCode).toBe(0);
    expect(JSON.stringify(first.envelope)).toBe(JSON.stringify(second.envelope));
    expect(JSON.stringify(first.envelope)).toBe(JSON.stringify(third.envelope));
    expect(first.text).toBe(second.text);
    const evidence = String(dataOf(first.envelope).evidence);
    expect(evidence).toContain("main");
    expect(evidence.length).toBeGreaterThan(0);
  }, 30_000);

  test("preflight refusal replay preserves the semantic branch names", async () => {
    const dirty = async (): Promise<string> => {
      const repo = createWatchdogRepository();
      try {
        repo.write("README.md", "modified\n");
        repo.write("notes.local", "note\n");
        const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], { repo });
        return JSON.stringify(normalizeEnvelopeText(run, repo.directory).error);
      } finally {
        repo.remove();
      }
    };
    const first = await dirty();
    const second = await dirty();
    expect(first).toBe(second);
    expect(first).toContain("main");
    expect(first).toContain("README.md");
  }, 30_000);

  test("teardown success replay keeps the action order and evidence", async () => {
    const first = await normalizedRun(makeSuccessResidue, [
      "watchdog",
      "teardown",
      "lane-1",
      "--json",
    ]);
    const second = await normalizedRun(makeSuccessResidue, [
      "watchdog",
      "teardown",
      "lane-1",
      "--json",
    ]);
    expect(first.exitCode).toBe(0);
    const firstData = dataOf(first.envelope);
    const secondData = dataOf(second.envelope);
    expect(firstData.verdict).toBe("ok");
    expect(JSON.stringify(firstData.actions)).toBe(JSON.stringify(secondData.actions));
    expect(JSON.stringify(first.envelope)).toBe(JSON.stringify(second.envelope));
  }, 30_000);

  test("signals-absent replay is identical and never yields a verdict", async () => {
    const run = async (): Promise<Record<string, unknown>> => {
      const repo = createWatchdogRepository();
      try {
        const result = await runWatchdogCli(["watchdog", "liveness", "lane-1", "--json"], { repo });
        return normalizeEnvelopeText(result, repo.directory);
      } finally {
        repo.remove();
      }
    };
    const first = await run();
    const second = await run();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).not.toHaveProperty("data");
    expect(JSON.stringify(first)).not.toContain('"verdict"');
  }, 30_000);

  test("raw evidence still contains the semantic refs the normalizer must not erase", async () => {
    const repo = createWatchdogRepository();
    try {
      makeClean(repo);
      const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], { repo });
      const raw = parseEnvelope(run);
      expect(String(dataOf(raw).evidence)).toContain("main");
      expect(String(dataOf(raw).evidence)).not.toContain(repo.directory);
    } finally {
      repo.remove();
    }
  });
});
