/**
 * TC-STATUS-001 / TC-STATUS-002 — command surface, one success envelope for
 * non-observed sections, and the composition-level credential-reference guard
 * (the anonymous/restored-control half of TC-STATUS-021/023).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createEnvironmentCredentialPort } from "../../packages/adapters/src/credentials/index";
import type { RepositoryIo } from "../../packages/adapters/src/repo/index";
import { createStatusCommandDefinition } from "../../packages/cli/src/commands/status";
import { createStatusCommandRuntime, type StatusComposition } from "../../packages/cli/src/edge";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { fixtureBrand } from "../fixtures/credentials/cases";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import {
  activeChange,
  anonymousInstance,
  baseFacts,
  deliveryRequestRead,
  failedDeliveryRequestRead,
  failedPipelineRunRead,
  failedWorkItemRead,
  localContext,
  missingLocalContext,
  NOW_ISO,
  NOW_MS,
  providerConfig,
  REVIEWS_UNAVAILABLE,
  runStatusCli,
  statusInstance,
  statusRuntime,
} from "../fixtures/status/harness";
import { createFixtureTransport } from "./providers/support";

const PARSE = (text: string): unknown => JSON.parse(text) as unknown;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const section = (value: unknown, id: string): Record<string, unknown> => {
  if (!isRecord(value) || !Array.isArray(value.sections)) throw new Error("digest has no sections");
  const found = value.sections.find((entry) => isRecord(entry) && entry.id === id);
  if (!isRecord(found)) throw new Error(`section ${id} is missing`);
  return found;
};

const repoIo = (): RepositoryIo => {
  const files = new Map<string, string>([
    [
      "/repo/.git/config",
      '[remote "origin"]\n\turl = git@github.com:owner-placeholder/project-placeholder.git\n',
    ],
    ["/repo/.git/HEAD", "ref: refs/heads/feat/GH-175/status-v1\n"],
    ["/repo/.git/refs/heads/feat/GH-175/status-v1", "1111111111111111111111111111111111111111\n"],
  ]);
  return {
    exists: (path) => path === "/repo/.git" || files.has(path),
    isFile: (path) => files.has(path),
    readText: (path) => files.get(path) ?? "",
  };
};

const pmFs = (text: string | undefined) => ({
  exists: (path: string) => text !== undefined && path === "/pm-context.yaml",
  readText: (path: string) => {
    if (text === undefined || path !== "/pm-context.yaml") throw new Error("missing");
    return text;
  },
});

const noChainResolver = () => ({
  ok: true as const,
  config: providerConfig({ defaultChain: undefined, chains: {}, entries: {} }),
});

const issueUrl =
  "https://api.github.com/repos/owner-placeholder/project-placeholder/issues?state=open&per_page=100&sort=updated&direction=desc";
const pullUrl =
  "https://api.github.com/repos/owner-placeholder/project-placeholder/pulls?state=open&per_page=100&sort=updated&direction=desc";
const checksUrl =
  "https://api.github.com/repos/owner-placeholder/project-placeholder/commits/1111111111111111111111111111111111111111/check-runs?per_page=20";

const composition = (overrides: {
  readonly instance: ReturnType<typeof statusInstance>;
  readonly transport: ReturnType<typeof createFixtureTransport>;
  readonly pm: string | undefined;
  readonly store: StatusComposition["store"];
}): StatusComposition => ({
  store: overrides.store,
  credentials: createEnvironmentCredentialPort({
    environment: { GITHUB_TOKEN: "canary-github-token" },
    brand: fixtureBrand,
  }),
  transport: overrides.transport,
  repository: { cwd: "/repo", io: repoIo() },
  localContext: { path: "/pm-context.yaml", fs: pmFs(overrides.pm) },
  clock: { nowMs: () => NOW_MS, nowIso: () => NOW_ISO },
  github: { instance: overrides.instance },
});

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const openTempStore = () => {
  const root = makeTempRoot("gh175-status-command");
  roots.push(root);
  return openStore(makeIdentity(root)).store;
};

const PM = `active_change:\n  workItemRef: GH-175\n  branch: feat/GH-175/status-v1\n  change_folder: doc/changes/x\nparked_changes: []\n`;

describe("TC-STATUS-001 status command surface", () => {
  test("status and status --json produce the same digest", async () => {
    const facts = baseFacts();
    const human = await runStatusCli(["status"], statusRuntime(facts));
    expect(human.exitCode).toBe(0);
    expect(human.stdout.split("\n").filter((line) => line.length > 0)).toHaveLength(7);
    const json = await runStatusCli(["--json", "status"], statusRuntime(facts));
    expect(json.exitCode).toBe(0);
    const envelope = PARSE(json.stdout);
    expect(assertEnvelopeContract(envelope)).toEqual([]);
    if (isRecord(envelope)) {
      const data = envelope.data;
      expect(section(data, "tracker").state).toBe("observed");
      expect(section(data, "lanes-or-queue").state).toBe("not-delivered");
    }
  });

  test("extra positionals and unknown flags are parser failures with zero reads", async () => {
    for (const argv of [
      ["status", "extra"],
      ["status", "--limit", "5"],
      ["--json", "status", "--limit", "5"],
    ]) {
      const recorder = { calls: [] as string[] };
      const run = await runStatusCli(argv, statusRuntime(baseFacts(), recorder));
      expect(run.exitCode).toBe(1);
      expect(recorder.calls).toEqual([]);
      expect(run.recorder.calls).toEqual([]);
      if (argv.includes("--json")) {
        const envelope = PARSE(run.stdout);
        if (isRecord(envelope) && isRecord(envelope.error)) {
          expect(envelope.error.code).toBe("fallback.invocation");
        }
        expect(JSON.stringify(envelope)).not.toContain('"data"');
      } else {
        expect(run.stderr.length).toBeGreaterThan(0);
      }
    }
    const restored = await runStatusCli(["status"], statusRuntime(baseFacts()));
    expect(restored.exitCode).toBe(0);
  });

  test("the definition declares no command flags and no positionals", async () => {
    const definition = createStatusCommandDefinition(statusRuntime(baseFacts()));
    expect(definition.flags).toEqual([]);
    expect(definition.positionals).toEqual({ max: 0 });
    const run = await runStatusCli(["--json", "status"], statusRuntime(baseFacts()));
    expect(run.exitCode).toBe(0);
    // The parser accepts no positionals: a second positional is rejected above.
  });

  test("a throwing handler is contained as fallback.internal with exit 2", async () => {
    const runtime = {
      ...statusRuntime(baseFacts()),
      readRepository: (): never => {
        throw new Error("planted-status-handler-canary");
      },
    };
    const run = await runStatusCli(["--json", "status"], runtime);
    expect(run.exitCode).toBe(2);
    const envelope = PARSE(run.stdout);
    if (isRecord(envelope) && isRecord(envelope.error)) {
      expect(envelope.error.code).toBe("fallback.internal");
    } else {
      throw new Error("containment envelope has no error object");
    }
    expect(run.stdout).not.toContain("planted-status-handler-canary");
    expect(run.stderr).not.toContain("planted-status-handler-canary");
  });
});

describe("TC-STATUS-002 non-observed sections still succeed", () => {
  test("a reachable non-observed digest keeps six sections and exit 0", async () => {
    const facts = baseFacts({
      tracker: failedWorkItemRead("read-failed"),
      changes: deliveryRequestRead([], REVIEWS_UNAVAILABLE),
      ci: failedPipelineRunRead("read-failed"),
      localContext: missingLocalContext(),
      providers: {
        config: noChainResolver(),
        parks: { ok: true, parks: [] },
      },
    });
    const run = await runStatusCli(["--json", "status"], statusRuntime(facts));
    expect(run.exitCode).toBe(0);
    const envelope = PARSE(run.stdout);
    expect(assertEnvelopeContract(envelope)).toEqual([]);
    if (!isRecord(envelope)) throw new Error("envelope is not an object");
    expect(envelope).not.toHaveProperty("error");
    const data = envelope.data;
    if (!isRecord(data) || !isRecord(data.summary)) throw new Error("data summary missing");
    expect(data.summary).toEqual({
      sections: 6,
      observed: 0,
      degraded: 1,
      unknown: 2,
      unavailable: 2,
      notDelivered: 1,
      actionable: 0,
    });
    expect(section(data, "tracker").state).toBe("unknown");
    expect(section(data, "ci").state).toBe("unknown");
    expect(section(data, "changes-and-prs").state).toBe("degraded");
    expect(section(data, "providers").state).toBe("unavailable");
    expect(section(data, "parked-work").state).toBe("unavailable");
    expect(section(data, "lanes-or-queue").state).toBe("not-delivered");
  });

  test("the fully observed control reaches observed sections", async () => {
    const run = await runStatusCli(["--json", "status"], statusRuntime(baseFacts()));
    const envelope = PARSE(run.stdout);
    if (!isRecord(envelope) || !isRecord(envelope.data)) throw new Error("data missing");
    expect(section(envelope.data, "tracker").state).toBe("observed");
    expect(section(envelope.data, "ci").state).toBe("observed");
  });

  test("a failed PR read never prints PRs 0 or an observed review state", async () => {
    const facts = baseFacts({
      changes: failedDeliveryRequestRead(),
      localContext: localContext({ activeChange: activeChange() }),
    });
    const run = await runStatusCli(["status"], statusRuntime(facts));
    expect(run.exitCode).toBe(0);
    const changesLine = run.stdout.split("\n").find((line) => line.startsWith("changes"));
    if (changesLine === undefined) throw new Error("missing changes line");
    expect(changesLine).toContain("active GH-175");
    expect(changesLine).toContain("PRs ?");
    expect(changesLine).toContain("review state unknown");
    expect(changesLine).not.toContain("PRs 0");
    expect(changesLine).not.toContain("review state observed");

    const restored = await runStatusCli(
      ["status"],
      statusRuntime(
        baseFacts({
          changes: deliveryRequestRead([], REVIEWS_UNAVAILABLE),
          localContext: localContext({ activeChange: activeChange() }),
        }),
      ),
    );
    const restoredLine = restored.stdout.split("\n").find((line) => line.startsWith("changes"));
    if (restoredLine === undefined) throw new Error("missing restored changes line");
    expect(restoredLine).toContain("PRs 0");
    expect(restoredLine).toContain("review state unavailable");
  });
});

describe("TC-STATUS-021/023 anonymous composition guard and restored control", () => {
  test("an anonymous instance is refused before any read", async () => {
    const transport = createFixtureTransport([
      { url: issueUrl, body: [] },
      { url: pullUrl, body: [] },
      { url: checksUrl, body: { check_runs: [] } },
    ]);
    const runtime = createStatusCommandRuntime(
      composition({
        instance: anonymousInstance(),
        transport,
        pm: PM,
        store: openTempStore(),
      }),
      noChainResolver,
    );
    const run = await runStatusCli(["--json", "status"], runtime);
    expect(run.exitCode).toBe(0);
    expect(transport.requests).toHaveLength(0);
    const envelope = PARSE(run.stdout);
    if (!isRecord(envelope) || !isRecord(envelope.data)) throw new Error("data missing");
    const data = envelope.data;
    expect(section(data, "tracker").state).toBe("unknown");
    expect(section(data, "ci").state).toBe("unknown");
    expect(section(data, "changes-and-prs").state).toBe("degraded");
    expect(section(data, "tracker").evidence).toMatchObject({
      reasons: expect.arrayContaining(["credential-unavailable"]),
    });
    for (const id of ["tracker", "changes-and-prs", "ci"]) {
      expect(section(data, id).state).not.toBe("observed");
    }
  });

  test("the guard withholds only GitHub reads when the active change is unusable", async () => {
    const transport = createFixtureTransport([]);
    const runtime = createStatusCommandRuntime(
      composition({
        instance: anonymousInstance(),
        transport,
        pm: undefined,
        store: openTempStore(),
      }),
      noChainResolver,
    );
    const run = await runStatusCli(["--json", "status"], runtime);
    const envelope = PARSE(run.stdout);
    if (!isRecord(envelope) || !isRecord(envelope.data)) throw new Error("data missing");
    expect(section(envelope.data, "changes-and-prs").state).toBe("unknown");
    expect(transport.requests).toHaveLength(0);
  });

  test("the credential-reference restored control returns the GitHub-slice states", async () => {
    const transport = createFixtureTransport([
      { url: issueUrl, body: [] },
      { url: pullUrl, body: [] },
      { url: checksUrl, body: { check_runs: [] } },
    ]);
    const runtime = createStatusCommandRuntime(
      composition({
        instance: statusInstance(),
        transport,
        pm: PM,
        store: openTempStore(),
      }),
      noChainResolver,
    );
    const run = await runStatusCli(["--json", "status"], runtime);
    expect(run.exitCode).toBe(0);
    expect(transport.requests).toHaveLength(3);
    const envelope = PARSE(run.stdout);
    if (!isRecord(envelope) || !isRecord(envelope.data)) throw new Error("data missing");
    const data = envelope.data;
    expect(section(data, "tracker").state).toBe("degraded");
    expect(section(data, "ci").state).toBe("observed");
    expect(section(data, "changes-and-prs").state).toBe("degraded");
  });
});
