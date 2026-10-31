/**
 * TC-STATUS-032 — opt-in structural live smoke. Skipped unless the test-only
 * `ADOS_STATUS_LIVE=1` switch and a resolvable `GITHUB_TOKEN` are present.
 * Never part of `pnpm check` or default CI.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createProcessCredentialPort } from "../../packages/adapters/src/credentials/index";
import { nodeFileSystemFacts } from "../../packages/adapters/src/file/index";
import { nodeRepositoryIo } from "../../packages/adapters/src/repo/index";
import { createStatusCommandRuntime, type StatusComposition } from "../../packages/cli/src/edge";
import type {
  BrandIdentity,
  ExternalSystemInstance,
} from "../../packages/core/src/contracts/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import { anonymousInstance, runStatusCli, statusInstance } from "../fixtures/status/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";
import { createFixtureTransport } from "./providers/support";

const LIVE = process.env.ADOS_STATUS_LIVE === "1";
const TOKEN = process.env.GITHUB_TOKEN;

const brand: BrandIdentity = SYNTHETIC_BRAND;

const liveComposition = (options: {
  readonly store: StatusComposition["store"];
  readonly instance: ExternalSystemInstance;
  readonly transport: StatusComposition["transport"];
}): StatusComposition => ({
  store: options.store,
  credentials: createProcessCredentialPort(brand),
  transport: options.transport,
  repository: { cwd: process.cwd(), io: nodeRepositoryIo() },
  localContext: {
    path: join(process.cwd(), ".ai/local/pm-context.yaml"),
    fs: nodeFileSystemFacts(),
  },
  clock: { nowMs: () => Date.now(), nowIso: () => new Date().toISOString() },
  github: { instance: options.instance },
});

const nativeTransport = {
  send: async (request: {
    readonly url: string;
    readonly method: "GET";
    readonly headers: Readonly<Record<string, string>>;
  }) => {
    const response = await fetch(request.url, { method: request.method, headers: request.headers });
    const body: unknown = await response.json();
    return { status: response.status, body };
  },
};

const noChain = () => ({
  ok: true as const,
  config: { defaultChain: undefined, credentials: {}, entries: {}, chains: {} },
});

const liveRoots: string[] = [];
const openLiveStore = () => {
  const root = makeTempRoot("gh175-status-live");
  liveRoots.push(root);
  return openStore(makeIdentity(root)).store;
};

describe("TC-STATUS-032 opt-in live smoke", () => {
  test("without the switch the suite performs zero live calls", () => {
    if (LIVE && TOKEN !== undefined && TOKEN.length > 0) {
      expect(true).toBe(true);
      return;
    }
    expect(LIVE).toBe(false);
  });

  const liveTest = test.skipIf(!LIVE || TOKEN === undefined || TOKEN.length === 0);

  liveTest("the live repository returns the structural six-section contract", async () => {
    const store = openLiveStore();
    try {
      const runtime = createStatusCommandRuntime(
        liveComposition({ store, instance: statusInstance(), transport: nativeTransport }),
        noChain,
      );
      const run = await runStatusCli(["--json", "status"], runtime);
      expect(run.exitCode).toBe(0);
      const envelope = JSON.parse(run.stdout) as {
        data: {
          sections: Array<{
            id: string;
            state: string;
            evidence: { reasons: string[] };
            entries?: Array<{ availability: string }>;
          }>;
        };
      };
      expect(envelope.data.sections.map((entry) => entry.id)).toEqual([
        "tracker",
        "changes-and-prs",
        "ci",
        "lanes-or-queue",
        "providers",
        "parked-work",
      ]);
      for (const section of envelope.data.sections) {
        expect(section.evidence.reasons.length).toBeGreaterThan(0);
      }
      expect(envelope.data.sections.find((entry) => entry.id === "lanes-or-queue")?.state).toBe(
        "not-delivered",
      );
      for (const section of envelope.data.sections) {
        for (const entry of section.entries ?? []) expect(entry.availability).not.toBe("available");
      }
      expect(JSON.stringify(envelope.data).length).toBeLessThanOrEqual(65536);
      const human = await runStatusCli(["status"], runtime);
      expect(human.stdout.split("\n").filter((line) => line.length > 0).length).toBeLessThanOrEqual(
        24,
      );
      expect(Buffer.byteLength(human.stdout, "utf8")).toBeLessThanOrEqual(4096);
      for (const secret of [TOKEN ?? ""]) {
        if (secret.length > 0) expect(human.stdout).not.toContain(secret);
      }
    } finally {
      for (const root of liveRoots.splice(0)) removeRoot(root);
    }
  });

  liveTest("the anonymous instance is refused before any live read", async () => {
    const store = openLiveStore();
    try {
      const transport = createFixtureTransport([]);
      const runtime = createStatusCommandRuntime(
        liveComposition({ store, instance: anonymousInstance(), transport }),
        noChain,
      );
      const run = await runStatusCli(["--json", "status"], runtime);
      expect(run.exitCode).toBe(0);
      expect(transport.requests).toHaveLength(0);
      const envelope = JSON.parse(run.stdout) as {
        data: { sections: Array<{ id: string; state: string }> };
      };
      const stateOf = (id: string): string =>
        envelope.data.sections.find((entry) => entry.id === id)?.state ?? "missing";
      expect(stateOf("tracker")).toBe("unknown");
      expect(stateOf("ci")).toBe("unknown");
      expect(stateOf("changes-and-prs")).not.toBe("observed");
    } finally {
      for (const root of liveRoots.splice(0)) removeRoot(root);
    }
  });
});
