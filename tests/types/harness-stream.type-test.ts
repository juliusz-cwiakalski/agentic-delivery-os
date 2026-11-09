/**
 * TC-OCS-070 (with TC-OCS-002/AC-F7-4): the additive streaming seam type-checks
 * against the real host implementation, and the delivered session port and
 * one-shot runner are unchanged.
 *
 * Compiled by `pnpm typecheck` (`tests/types/tsconfig.json`), not run by Bun;
 * the `@ts-expect-error` comments are the assertions.
 */
import { createHostSpawnStarter } from "../../packages/adapters/src/host/index";
import type {
  HarnessSessionPort,
  HarnessSpawnRunner,
  HarnessSpawnRunnerResult,
  HarnessSpawnStarter,
  HarnessSpawnStreamOptions,
} from "../../packages/core/src/contracts/index";

const options: HarnessSpawnStreamOptions = {
  cwd: "/synthetic/work",
  env: {},
  handleTimeoutMs: 1000,
};

const hostStarter: HarnessSpawnStarter = createHostSpawnStarter();

const fakeStarter: HarnessSpawnStarter = (_file, _args, _options) => ({
  lines: (async function* () {
    yield "{}";
  })(),
  completion: Promise.resolve({ stdout: "", stderr: "", status: 0, timedOut: false }),
  acquired: () => undefined,
  kill: () => undefined,
});

// @ts-expect-error — a stream missing `kill` is rejected.
const missingKill: HarnessSpawnStarter = (_file, _args, _options) => ({
  lines: (async function* () {
    yield "{}";
  })(),
  completion: Promise.resolve({ stdout: "", stderr: "", status: 0, timedOut: false }),
  acquired: () => undefined,
});

// `sessionTimeoutMs` is optional: absent compiles.
const withoutSessionBound: HarnessSpawnStreamOptions = {
  cwd: "/synthetic/work",
  env: {},
  handleTimeoutMs: 1000,
};
// ... and present compiles.
const withSessionBound: HarnessSpawnStreamOptions = {
  cwd: "/synthetic/work",
  env: {},
  handleTimeoutMs: 1000,
  sessionTimeoutMs: 2000,
};
const stringSessionBound: HarnessSpawnStreamOptions = {
  cwd: "/synthetic/work",
  env: {},
  handleTimeoutMs: 1000,
  // @ts-expect-error — `sessionTimeoutMs` is a number, not a string.
  sessionTimeoutMs: "2000",
};
const missingOutcome = () => ({
  ok: false as const,
  error: { kind: "harness" as const, code: "harness.session.unknown" as const },
});

const port: HarnessSessionPort = {
  spawn: async () => missingOutcome(),
  deliver: async () => missingOutcome(),
  resume: async () => missingOutcome(),
  collect: async () => missingOutcome(),
  classify: () => ({ outcome: "completed", token: "finished", derivationClass: "verify" }),
  liveness: async () => ({ ok: true, value: { readings: [] } }),
  listSessions: async () => ({ ok: true, value: { handles: [] } }),
};

// @ts-expect-error — the delivered port has no kill operation.
void port.kill;

// An eighth member is not assignable to the delivered port.
const eightMember: HarnessSessionPort = {
  spawn: async () => missingOutcome(),
  deliver: async () => missingOutcome(),
  resume: async () => missingOutcome(),
  collect: async () => missingOutcome(),
  classify: () => ({ outcome: "completed", token: "finished", derivationClass: "verify" }),
  liveness: async () => ({ ok: true, value: { readings: [] } }),
  listSessions: async () => ({ ok: true, value: { handles: [] } }),
  // @ts-expect-error — an eighth member is not assignable to the delivered port.
  kill: () => undefined,
};

const runner: HarnessSpawnRunner = async () => ({
  stdout: "",
  stderr: "",
  status: 0,
  timedOut: false,
});

// @ts-expect-error — a runner result without `timedOut` is rejected.
const badRunner: HarnessSpawnRunner = async () => ({ stdout: "", stderr: "", status: 0 });

// The stream's completion is one result type, not a second shape.
const completion: Promise<HarnessSpawnRunnerResult> = fakeStarter("file", [], options).completion;

export {
  badRunner,
  completion,
  eightMember,
  fakeStarter,
  hostStarter,
  missingKill,
  options,
  port,
  runner,
  stringSessionBound,
  withoutSessionBound,
  withSessionBound,
};
