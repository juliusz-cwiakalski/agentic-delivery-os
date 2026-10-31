/**
 * TC-STATUS-023 — the exhaustive AC-F9-1 negative-control matrix plus the
 * anonymous/credential-less composition control and restored controls.
 */
import { describe, expect, test } from "bun:test";
import { createEnvironmentCredentialPort } from "../../packages/adapters/src/credentials/index";
import type { RepositoryIo } from "../../packages/adapters/src/repo/index";
import { createStatusCommandRuntime, type StatusComposition } from "../../packages/cli/src/edge";
import { aggregateStatus } from "../../packages/core/src/domain/index";
import { fixtureBrand } from "../fixtures/credentials/cases";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import {
  anonymousInstance,
  baseFacts,
  failedDeliveryRequestRead,
  failedPipelineRunRead,
  failedWorkItemRead,
  missingLocalContext,
  NOW_ISO,
  NOW_MS,
  parkView,
  providerConfig,
  providerConfigRead,
  providers,
  repository,
  runStatusCli,
  sectionById,
  statusInstance,
  unavailableBinding,
} from "../fixtures/status/harness";
import { createFixtureTransport } from "./providers/support";

const section = (facts: Parameters<typeof aggregateStatus>[0], id: string) =>
  sectionById(aggregateStatus(facts).sections, id);

const noChain = () =>
  providerConfigRead(providerConfig({ defaultChain: undefined, chains: {}, entries: {} }));

const reportReason = (facts: Parameters<typeof aggregateStatus>[0], id: string): string[] => {
  const entry = section(facts, id);
  return entry.evidence.reasons;
};

describe("TC-STATUS-023 exhaustive negative controls", () => {
  const controls: Array<{
    readonly name: string;
    readonly facts: Parameters<typeof aggregateStatus>[0];
    readonly sectionId: string;
    readonly state: string;
    readonly reason: string;
  }> = [
    {
      name: "failed issues read",
      facts: baseFacts({ tracker: failedWorkItemRead("read-failed") }),
      sectionId: "tracker",
      state: "unknown",
      reason: "read-failed",
    },
    {
      name: "failed PR read",
      facts: baseFacts({ changes: failedDeliveryRequestRead() }),
      sectionId: "changes-and-prs",
      state: "degraded",
      reason: "partial-evidence",
    },
    {
      name: "failed check-runs read",
      facts: baseFacts({ ci: failedPipelineRunRead("read-failed") }),
      sectionId: "ci",
      state: "unknown",
      reason: "read-failed",
    },
    {
      name: "missing credential",
      facts: baseFacts({
        tracker: failedWorkItemRead("credential-unavailable"),
        changes: failedDeliveryRequestRead("credential-unavailable"),
        ci: failedPipelineRunRead("credential-unavailable"),
      }),
      sectionId: "tracker",
      state: "unknown",
      reason: "credential-unavailable",
    },
    {
      name: "unresolved SHA",
      facts: baseFacts({ repository: repository({ head: { detached: true } }) }),
      sectionId: "ci",
      state: "unknown",
      reason: "commit-unresolved",
    },
    {
      name: "unresolved repository binding",
      facts: baseFacts({ repository: repository({ binding: unavailableBinding() }) }),
      sectionId: "tracker",
      state: "unavailable",
      reason: "addressing-unresolved",
    },
    {
      name: "torn park store",
      facts: baseFacts({
        providers: providers({
          parks: { ok: false, reason: "state-unreadable", failureCode: "state.store.torn" },
        }),
      }),
      sectionId: "providers",
      state: "degraded",
      reason: "state-unreadable",
    },
    {
      name: "missing provider chain",
      facts: baseFacts({ providers: providers({ config: noChain() }) }),
      sectionId: "providers",
      state: "unavailable",
      reason: "provider-chain-not-declared",
    },
    {
      name: "missing PM context",
      facts: baseFacts({ localContext: missingLocalContext() }),
      sectionId: "parked-work",
      state: "unavailable",
      reason: "local-context-missing",
    },
  ];

  for (const control of controls) {
    test(control.name, () => {
      const digest = aggregateStatus(control.facts);
      expect(digest.sections).toHaveLength(6);
      expect(section(control.facts, "lanes-or-queue").state).toBe("not-delivered");
      const entry = section(control.facts, control.sectionId);
      expect(entry.state).toBe(control.state);
      expect(entry.state).not.toBe("observed");
      expect(reportReason(control.facts, control.sectionId)).toContain(control.reason);
      expect(JSON.stringify(entry)).not.toContain("nothing to do");
      expect(JSON.stringify(entry)).not.toContain("green");
    });
  }

  test("an active provider park is parked, never available", () => {
    const facts = baseFacts({
      providers: providers({
        config: providerConfigRead(providerConfig()),
        parks: { ok: true, parks: [parkView()] },
      }),
    });
    const entry = section(facts, "providers");
    expect(entry.state).toBe("observed");
    expect(entry.entries?.[0]?.availability).toBe("parked");
    for (const item of entry.entries ?? []) expect(item.availability).not.toBe("available");
  });

  test("a restored control reaches the expected state (non-vacuous)", () => {
    expect(section(baseFacts(), "tracker").state).toBe("observed");
    expect(section(baseFacts(), "ci").state).toBe("observed");
    expect(
      section(baseFacts({ providers: providers({ config: noChain() }) }), "providers").state,
    ).toBe("unavailable");
    expect(
      section(
        baseFacts({
          providers: providers({
            config: providerConfigRead(providerConfig()),
            parks: { ok: true, parks: [] },
          }),
        }),
        "providers",
      ).state,
    ).toBe("observed");
  });

  test("every reason is in the closed set and no provider.chain.invalid identity appears", () => {
    const closed = new Set([
      "observed",
      "observed-empty",
      "read-failed",
      "source-unavailable",
      "signal-unavailable",
      "addressing-unresolved",
      "remote-unsupported",
      "credential-unavailable",
      "config-invalid",
      "state-unreadable",
      "commit-unresolved",
      "provider-chain-not-declared",
      "provider-chain-unresolved",
      "local-context-missing",
      "local-context-malformed",
      "local-state-untracked",
      "engine-not-delivered",
      "source-truncated",
      "item-signal-absent",
      "partial-evidence",
    ]);
    for (const control of controls) {
      const text = JSON.stringify(aggregateStatus(control.facts));
      expect(text).not.toContain("provider.chain.invalid");
      const digest = JSON.parse(text) as { sections: { evidence: { reasons: string[] } }[] };
      for (const entry of digest.sections) {
        for (const reason of entry.evidence.reasons) expect(closed.has(reason)).toBe(true);
      }
    }
  });

  test("the named matrix has all nine matrix controls plus the separate active-park control", () => {
    const names = new Set(controls.map((control) => control.name));
    for (const required of [
      "failed issues read",
      "failed PR read",
      "failed check-runs read",
      "missing credential",
      "unresolved SHA",
      "unresolved repository binding",
      "torn park store",
      "missing provider chain",
      "missing PM context",
    ]) {
      expect(names.has(required)).toBe(true);
    }
    expect(controls.length).toBe(9);
  });
});

// --- anonymous composition control -----------------------------------------

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

const PM = `active_change:\n  workItemRef: GH-175\n  branch: feat/GH-175/status-v1\n  change_folder: doc/changes/x\nparked_changes: []\n`;

const guardComposition = (store: StatusComposition["store"]): StatusComposition => ({
  store,
  credentials: createEnvironmentCredentialPort({ environment: {}, brand: fixtureBrand }),
  transport: createFixtureTransport([]),
  repository: { cwd: "/repo", io: repoIo() },
  localContext: {
    path: "/pm-context.yaml",
    fs: {
      exists: (path) => path === "/pm-context.yaml",
      readText: (path) => {
        if (path !== "/pm-context.yaml") throw new Error("missing");
        return PM;
      },
    },
  },
  clock: { nowMs: () => NOW_MS, nowIso: () => NOW_ISO },
  github: { instance: anonymousInstance() },
});

describe("TC-STATUS-023 anonymous/credential-less composition control", () => {
  test("refuses before any read and never turns an affected section observed", async () => {
    const root = makeTempRoot("gh175-negative-guard");
    try {
      const { store } = openStore(makeIdentity(root));
      const runtime = createStatusCommandRuntime(guardComposition(store), () => ({
        ok: true,
        config: providerConfig({ defaultChain: undefined, chains: {}, entries: {} }),
      }));
      const run = await runStatusCli(["--json", "status"], runtime);
      expect(run.exitCode).toBe(0);
      const envelope = JSON.parse(run.stdout) as {
        data: { sections: { id: string; state: string }[] };
      };
      const stateOf = (id: string): string =>
        envelope.data.sections.find((entry) => entry.id === id)?.state ?? "missing";
      expect(stateOf("tracker")).toBe("unknown");
      expect(stateOf("ci")).toBe("unknown");
      expect(stateOf("changes-and-prs")).toBe("degraded");
      for (const id of ["tracker", "ci", "changes-and-prs"])
        expect(stateOf(id)).not.toBe("observed");
    } finally {
      removeRoot(root);
    }
  });

  test("a credential-reference restored control reaches the GitHub-slice states", async () => {
    const root = makeTempRoot("gh175-negative-restored");
    try {
      const { store } = openStore(makeIdentity(root));
      const composition: StatusComposition = {
        ...guardComposition(store),
        credentials: createEnvironmentCredentialPort({
          environment: { GITHUB_TOKEN: "canary-token" },
          brand: fixtureBrand,
        }),
        transport: createFixtureTransport([
          {
            url: "https://api.github.com/repos/owner-placeholder/project-placeholder/issues?state=open&per_page=100&sort=updated&direction=desc",
            body: [],
          },
          {
            url: "https://api.github.com/repos/owner-placeholder/project-placeholder/pulls?state=open&per_page=100&sort=updated&direction=desc",
            body: [],
          },
          {
            url: "https://api.github.com/repos/owner-placeholder/project-placeholder/commits/1111111111111111111111111111111111111111/check-runs?per_page=20",
            body: { check_runs: [] },
          },
        ]),
        github: { instance: statusInstance() },
      };
      const runtime = createStatusCommandRuntime(composition, () => ({
        ok: true,
        config: providerConfig({ defaultChain: undefined, chains: {}, entries: {} }),
      }));
      const run = await runStatusCli(["--json", "status"], runtime);
      const envelope = JSON.parse(run.stdout) as {
        data: { sections: { id: string; state: string }[] };
      };
      const stateOf = (id: string): string =>
        envelope.data.sections.find((entry) => entry.id === id)?.state ?? "missing";
      expect(stateOf("tracker")).toBe("degraded");
      expect(stateOf("ci")).toBe("observed");
      expect(stateOf("changes-and-prs")).toBe("degraded");
    } finally {
      removeRoot(root);
    }
  });
});
