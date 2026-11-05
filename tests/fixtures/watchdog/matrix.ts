/**
 * The reachable M1-S1 watchdog matrix used by the envelope and exit suites.
 * Every row runs the wired CLI against a real temporary repository; the caller
 * disposes each row in a `finally` block.
 */
import { runWatchdogCli, type WatchdogRun } from "./harness";
import {
  createWatchdogRepository,
  makeClean,
  makeDirty,
  makeOffBase,
  makeSuccessResidue,
  type WatchdogTempRepository,
} from "./temp-git";

export type MatrixEntry = {
  readonly id: string;
  readonly run: WatchdogRun;
  readonly dispose: () => void;
};

export const runReachableMatrix = async (): Promise<readonly MatrixEntry[]> => {
  const entries: MatrixEntry[] = [];

  const make = async (
    id: string,
    repo: WatchdogTempRepository,
    argv: readonly string[],
    options: Omit<Parameters<typeof runWatchdogCli>[1], "repo"> = {},
  ): Promise<void> => {
    const run = await runWatchdogCli(argv, { repo, ...options });
    entries.push({ id, run, dispose: () => repo.remove() });
  };

  const clean = createWatchdogRepository();
  makeClean(clean);
  await make("admission-clean", clean, ["watchdog", "preflight", "lane-1", "--json"]);

  const dirty = createWatchdogRepository();
  makeDirty(dirty);
  await make("refusal-dirty", dirty, ["watchdog", "preflight", "lane-1", "--json"]);

  const offbase = createWatchdogRepository();
  makeOffBase(offbase);
  await make("refusal-non-base", offbase, ["watchdog", "preflight", "lane-1", "--json"]);

  const restored = createWatchdogRepository();
  makeSuccessResidue(restored);
  await make("teardown-success", restored, ["watchdog", "teardown", "lane-1", "--json"]);

  const failed = createWatchdogRepository();
  makeSuccessResidue(failed);
  await make("teardown-failure", failed, ["watchdog", "teardown", "lane-1", "--json"], {
    git: { restoreCheckout: async () => ({ ok: false, detail: "injected restore failure" }) },
  });

  const absent = createWatchdogRepository();
  await make("signals-absent", absent, ["watchdog", "liveness", "lane-1", "--json"]);

  const grammar = createWatchdogRepository();
  await make("grammar-failure", grammar, ["watchdog", "--json"]);

  const unknown = createWatchdogRepository();
  await make("unknown-lane", unknown, ["watchdog", "preflight", "lane-1", "--json"], {
    laneRead: { ok: false, reason: "missing" },
  });

  return entries;
};

export const disposeMatrix = (entries: readonly MatrixEntry[]): void => {
  for (const entry of entries) entry.dispose();
};
