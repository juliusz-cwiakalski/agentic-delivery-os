/**
 * The metrics fixture harness (GH-299 test plan §4.1, §6).
 *
 * Every case composes the real metrics command over the real production
 * runtime: a per-test temp state store seeded through the delivered append
 * paths, an in-memory project-committed document tree (the baseline log, the
 * configuration document, and the committed corpus fixtures), the injected
 * clock, the injected run id, and the synthetic brand. Every document read and
 * every store read is recorded so a refusal can be proven to precede the read
 * pass, and a byte snapshot proves the read-only posture.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMetricsCommandDefinition } from "../../../packages/cli/src/commands/metrics";
import { createMetricsCommandRuntime } from "../../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";
import type {
  MetricsCommandRuntime,
  StateStorePort,
} from "../../../packages/core/src/contracts/index";
import { bufferSink, type CliStreams, SYNTHETIC_BRAND } from "../../golden/helpers";
import { makeIdentity, openStore } from "../state/harness";

export { SYNTHETIC_BRAND };

/** The fixed injected clock (2026-11-17T09:00:00Z). */
export const METRICS_NOW_MS = Date.UTC(2026, 10, 17, 9, 0, 0);
export const METRICS_NOW_ISO = "2026-11-17T09:00:00.000Z";
export const DAY_MS = 86_400_000;

/** The evaluated ref and an unrelated control ref. */
export const METRICS_REF = "GH-299";
export const OTHER_REF = "GH-1000";

/** The project-committed configuration document path (relative). */
export const CONFIG_RELATIVE = ".example-product/config.yaml";
/** The committed baseline log path (relative). */
export const BASELINE_RELATIVE = "doc/planning/oss-tooling/measurement-baseline.yaml";

/** The read records one invocation leaves behind. */
export type MetricsReadLog = {
  readonly storeReads: string[];
  readonly documentReads: string[];
  readonly documentProbes: string[];
};

/** The in-memory project tree: existence, content, and directory listing. */
export type MemoryProjectFs = {
  readonly files: Map<string, string>;
  readonly exists: (path: string) => boolean;
  readonly readText: (path: string) => string;
  readonly list: (path: string) => readonly string[];
  set(relative: string, text: string): void;
  remove(relative: string): void;
};

export const makeMemoryProjectFs = (root: string): MemoryProjectFs => {
  const files = new Map<string, string>();
  const absolute = (relative: string): string => `${root}/${relative.replace(/^\/+/u, "")}`;
  return {
    files,
    exists: (path) => files.has(path),
    readText: (path) => {
      const text = files.get(path);
      if (text === undefined) throw new Error(`missing fixture document ${path}`);
      return text;
    },
    list: (path) => {
      const prefix = `${path.replace(/\/+$/u, "")}/`;
      const names = new Set<string>();
      for (const key of files.keys()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const [head] = rest.split("/");
        if (head !== undefined && head.length > 0) names.add(head);
      }
      return [...names].sort((left, right) => (left < right ? -1 : 1));
    },
    set: (relative, text) => files.set(absolute(relative), text),
    remove: (relative) => files.delete(absolute(relative)),
  };
};

/** The recorded read seam over the delivered state port. */
const recordingStore = (store: StateStorePort, log: string[]): StateStorePort => ({
  ...store,
  read: (request) => {
    log.push("read");
    return store.read(request);
  },
  readRecords: () => {
    log.push("readRecords");
    return store.readRecords();
  },
  acquireFence: (token) => {
    log.push("acquireFence");
    return store.acquireFence(token);
  },
  append: (handle, request) => {
    log.push("append");
    return store.append(handle, request);
  },
  releaseFence: (handle) => {
    log.push("releaseFence");
    return store.releaseFence(handle);
  },
  salvage: (handle) => {
    log.push("salvage");
    return store.salvage(handle);
  },
});

export type MetricsFixture = {
  readonly root: string;
  readonly store: StateStorePort;
  readonly runtime: MetricsCommandRuntime;
  readonly project: MemoryProjectFs;
  readonly reads: MetricsReadLog;
  readonly nowMs: number;
  setNow(nowMs: number): void;
  setActiveRef(ref: string | null): void;
  setConfig(text: string): void;
  removeConfig(): void;
  setBaseline(text: string): void;
  removeBaseline(): void;
  setCorpusDocument(relative: string, text: string): void;
  snapshot(): string;
  dispose(): void;
};

export type MetricsFixtureOptions = {
  readonly label?: string;
  readonly nowMs?: number;
  readonly activeRef?: string | null;
  readonly configurationDirectoryName?: string;
};

/** Create one fixture: a temp store, an empty project tree, and the clock. */
export const makeMetricsFixture = (options: MetricsFixtureOptions = {}): MetricsFixture => {
  const root = mkdtempSync(join(tmpdir(), `metrics-${options.label ?? "case"}-`));
  const identity = makeIdentity(root);
  const opened = openStore(identity);
  const storeReads: string[] = [];
  const reads: MetricsReadLog = { storeReads, documentReads: [], documentProbes: [] };
  const project = makeMemoryProjectFs(root);
  let nowMs = options.nowMs ?? METRICS_NOW_MS;
  const localContextPath = `${root}/.ai/local/pm-context.yaml`;
  const configurationDirectoryName = options.configurationDirectoryName ?? ".example-product";

  const setActiveRef = (ref: string | null): void => {
    const text =
      ref === null
        ? "parked_changes: []\n"
        : `active_change:\n  workItemRef: ${ref}\n  branch: feat/${ref}/delivery\n  change_folder: doc/changes/x\nparked_changes: []\n`;
    project.files.set(localContextPath, text);
  };
  setActiveRef(options.activeRef === undefined ? METRICS_REF : options.activeRef);

  const countedFs = {
    exists: (path: string) => {
      if (path.startsWith(root)) reads.documentProbes.push(path.slice(root.length + 1));
      return project.exists(path);
    },
    readText: (path: string) => {
      if (path.startsWith(root)) reads.documentReads.push(path.slice(root.length + 1));
      return project.readText(path);
    },
    list: (path: string) => project.list(path),
  };

  const runtime = createMetricsCommandRuntime({
    store: recordingStore(opened.store, storeReads),
    localContext: {
      path: localContextPath,
      fs: { exists: (path) => project.files.has(path), readText: (path) => project.readText(path) },
    },
    projectRoot: root,
    configurationDirectoryName,
    fs: countedFs,
    clock: { nowMs: () => nowMs },
    platform: "linux",
    homeDirectory: `${root}/home`,
    environment: {},
  });

  const snapshot = (): string =>
    createHash("sha256")
      .update(
        JSON.stringify({
          files: [...project.files.entries()].sort(([left], [right]) =>
            left < right ? -1 : left > right ? 1 : 0,
          ),
        }),
      )
      .digest("hex");

  return {
    root,
    store: opened.store,
    runtime,
    project,
    reads,
    get nowMs() {
      return nowMs;
    },
    setNow: (value: number) => {
      nowMs = value;
    },
    setActiveRef,
    setConfig: (text: string) => project.set(CONFIG_RELATIVE, text),
    removeConfig: () => project.remove(CONFIG_RELATIVE),
    setBaseline: (text: string) => project.set(BASELINE_RELATIVE, text),
    removeBaseline: () => project.remove(BASELINE_RELATIVE),
    setCorpusDocument: (relative: string, text: string) =>
      project.set(`doc/changes/${relative}`, text),
    snapshot,
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
};

export type MetricsRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope:
    | {
        readonly schemaVersion: string;
        readonly runId: string;
        readonly exitCode: number;
        readonly timing: { readonly totalMs: number };
        readonly data?: Record<string, unknown>;
        readonly error?: Record<string, unknown>;
      }
    | undefined;
  readonly human: string;
};

/** Run the real metrics command through the in-process CLI surface. */
export const runMetrics = async (
  fixture: MetricsFixture,
  argv: readonly string[],
  options: {
    readonly secrets?: readonly string[];
    readonly runId?: string;
    readonly brand?: typeof SYNTHETIC_BRAND;
  } = {},
): Promise<MetricsRun> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const ticks = [100, 110] as const;
  let tick = 0;
  const deps: CliDependencies = {
    brand: options.brand ?? SYNTHETIC_BRAND,
    clock: {
      now: () => {
        const value = ticks[Math.min(tick, 1)] as number;
        tick += 1;
        return value;
      },
    },
    newRunId: () => options.runId ?? "run-metrics-fixture",
    secrets: options.secrets ?? [],
    program: {
      commands: { metrics: createMetricsCommandDefinition(fixture.runtime) },
    },
  };
  const exitCode = await runCli(argv, { stdout, stderr } as CliStreams, deps);
  const text = stdout.value;
  let envelope: MetricsRun["envelope"];
  if (argv.includes("--json") && text.trim().length > 0) {
    envelope = JSON.parse(text) as MetricsRun["envelope"];
  }
  return { exitCode, stdout: text, stderr: stderr.value, envelope, human: text };
};

/** Read one project document from the fixture tree (the in-memory project). */
export const documentText = (fixture: MetricsFixture, relative: string): string => {
  const text = fixture.project.files.get(`${fixture.root}/${relative.replace(/^\/+/u, "")}`);
  if (text === undefined) throw new Error(`missing fixture document ${relative}`);
  return text;
};

/** The report `data` of a successful run; throws when the run failed. */
export const reportOf = (run: MetricsRun): Record<string, unknown> => {
  if (run.envelope?.data === undefined) {
    throw new Error(`expected a report, got: ${run.stdout}${run.stderr}`);
  }
  return run.envelope.data;
};

/** The error object of a refused run; throws when the run succeeded. */
export const failureOf = (run: MetricsRun): Record<string, unknown> => {
  if (run.envelope?.error === undefined) {
    throw new Error(`expected a refusal, got: ${run.stdout}`);
  }
  return run.envelope.error;
};

/** The metric entries of a report, keyed by ID. */
export const entriesById = (
  report: Record<string, unknown>,
): Readonly<Record<string, Record<string, unknown>>> => {
  const metrics = report.metrics;
  if (!Array.isArray(metrics)) return {};
  const byId: Record<string, Record<string, unknown>> = {};
  for (const entry of metrics) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const id = record.id;
    if (typeof id === "string") byId[id] = record;
  }
  return byId;
};

/** The declared drawn window for the fixture clock. */
export const drawnWindow = (nowMs = METRICS_NOW_MS): { from: string; through: string } => ({
  from: new Date(nowMs - 30 * DAY_MS).toISOString(),
  through: new Date(nowMs).toISOString(),
});

/** Run the real metrics command over one injected runtime (damage cells). */
export const runWithRuntime = async (
  runtime: MetricsCommandRuntime,
  argv: readonly string[],
): Promise<MetricsRun> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  let tick = 0;
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: {
      now: () => {
        tick += 1;
        return tick === 1 ? 100 : 110;
      },
    },
    newRunId: () => "run-metrics-injected",
    secrets: [],
    program: { commands: { metrics: createMetricsCommandDefinition(runtime) } },
  };
  const exitCode = await runCli(argv, { stdout, stderr } as CliStreams, deps);
  const text = stdout.value;
  const envelope =
    argv.includes("--json") && text.trim().length > 0
      ? (JSON.parse(text) as MetricsRun["envelope"])
      : undefined;
  return { exitCode, stdout: text, stderr: stderr.value, envelope, human: text };
};
