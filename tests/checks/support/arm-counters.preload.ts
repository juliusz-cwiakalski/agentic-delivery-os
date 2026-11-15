/**
 * GH-320 TC-BIN-084 half (b) — the arm-counters preload module.
 *
 * Loaded with `bun --preload` ahead of the guarded suites. It counts the four
 * acquisition classes the hermeticity guard asserts (network, network-capable
 * spawn, secret-shaped environment reads, real sleeps) and writes outside the
 * allowed temp roots, then reports to the file named by
 * `GH320_HERMETIC_REPORT` and marks the run non-zero.
 *
 * Network primitives are blocked, never performed: a guarded suite that tries to
 * reach the network is counted and refused, so the guard proves absence without
 * making the attempt real.
 */
import { writeFileSync } from "node:fs";

const REPORT = process.env.GH320_HERMETIC_REPORT;
const ALLOWED_ROOTS = (process.env.GH320_HERMETIC_ALLOWED_ROOTS ?? "")
  .split(":")
  .filter((root) => root !== "");
const SECRET_SHAPED = /(?:TOKEN|SECRET|PASSWORD|API_KEY|CREDENTIAL)/iu;
const NETWORK_COMMANDS = new Set(["curl", "wget"]);

type Tallies = Record<string, string[]>;

const tallies: Tallies = {
  network: [],
  networkCommand: [],
  secretRead: [],
  sleep: [],
  write: [],
};

const flush = (): void => {
  if (REPORT === undefined || REPORT === "") return;
  const payload = JSON.stringify(tallies, null, 2);
  try {
    writeFileSync(REPORT, payload);
  } catch {
    // A guard that cannot report is not a pass; the exit code below still fails.
  }
};

const record = (klass: keyof Tallies, detail: string): void => {
  tallies[klass].push(detail);
  process.exitCode = 1;
  flush();
};

// 1. Network: wrap `fetch` and refuse the call.
const originalFetch = globalThis.fetch;
globalThis.fetch = ((input: unknown, _init?: unknown) => {
  record("network", `fetch ${String(input).slice(0, 120)}`);
  return Promise.reject(new Error("network access is forbidden in a guarded suite"));
}) as typeof globalThis.fetch;

// 2. Network-capable spawn: `curl`, `wget`, and the fetch-shaped git verbs.
const spawnLooksNetworked = (command: readonly unknown[]): string | undefined => {
  const [file, args] = command;
  const name = typeof file === "string" ? (file.split("/").pop() ?? "") : "";
  if (NETWORK_COMMANDS.has(name)) return name;
  if (name === "git" && Array.isArray(args)) {
    const verb = args.find((arg): arg is string => typeof arg === "string");
    if (verb === "fetch" || verb === "pull" || verb === "clone") return `git ${verb}`;
  }
  return undefined;
};

const originalSpawnSync = Bun.spawnSync;
// biome-ignore lint: the signature is deliberately pass-through.
Bun.spawnSync = ((command: unknown, ...rest: unknown[]) => {
  const networked = spawnLooksNetworked(command as readonly unknown[]);
  if (networked !== undefined) record("networkCommand", networked);
  // biome-ignore lint: pass-through to the delivered runtime.
  return (originalSpawnSync as unknown as (...args: unknown[]) => unknown)(command, ...rest);
}) as typeof Bun.spawnSync;

// 3. Secret-shaped environment reads.
const secretReadProxy = new Proxy(process.env, {
  get(target, property, receiver) {
    if (typeof property === "string" && SECRET_SHAPED.test(property)) {
      record("secretRead", property);
    }
    return Reflect.get(target, property, receiver);
  },
});
process.env = secretReadProxy;

// 4. Real sleeps.
const originalSleep = Bun.sleep;
Bun.sleep = ((delay?: number) => {
  if (typeof delay === "number" && delay > 0) record("sleep", `${String(delay)}ms`);
  return originalSleep(delay ?? 0);
}) as typeof Bun.sleep;
const originalSleepSync = Bun.sleepSync;
Bun.sleepSync = ((delay?: number) => {
  if (typeof delay === "number" && delay > 0) record("sleep", `${String(delay)}ms (sync)`);
  return originalSleepSync(delay ?? 0);
}) as typeof Bun.sleepSync;

// 5. Writes outside the allowed temp roots.
const originalWrite = Bun.write;
Bun.write = ((destination: unknown, data: unknown) => {
  const path = typeof destination === "string" ? destination : String(destination);
  const allowed = ALLOWED_ROOTS.some((root) => path.startsWith(root));
  if (!allowed) record("write", path.slice(0, 160));
  return originalWrite(destination as never, data as never);
}) as typeof Bun.write;

const originalFetchRef = originalFetch;
void originalFetchRef;
flush();
