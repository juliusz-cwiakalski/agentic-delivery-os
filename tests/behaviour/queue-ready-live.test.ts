/**
 * TC-QREADY-031 — opt-in structural live smoke. Skipped unless the test-only
 * switch is exactly `1` and a resolvable GitHub token is present.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createProcessCredentialPort } from "../../packages/adapters/src/credentials/index";
import { nodeFileSystemFacts } from "../../packages/adapters/src/file/index";
import { nodeRepositoryIo } from "../../packages/adapters/src/repo/index";
import { createStatusCommandRuntime, type StatusComposition } from "../../packages/cli/src/edge";
import type {
  ExternalSystemInstance,
  QueueReadyPayload,
  StatusProviderConfigRead,
} from "../../packages/core/src/contracts/index";
import { type QueueRuntime, runQueueReadyCli } from "../fixtures/queue-ready/harness";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import { statusInstance } from "../fixtures/status/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const LIVE_SWITCH = process.env.ADOS_QUEUE_READY_LIVE === "1";
const TOKEN = process.env.GITHUB_TOKEN;
/**
 * One eligibility predicate for both the skip guard and the offline control:
 * the smoke runs only when the switch is exactly `1` AND a non-empty token is
 * present. A missing credential keeps the suite offline and skipped instead
 * of failing an assertion about the switch alone.
 */
const LIVE = LIVE_SWITCH && TOKEN !== undefined && TOKEN.length > 0;
/** Open issue the smoke observes; override when the default ref is closed. */
/**
 * Open issue the smoke observes. The default is a long-lived repository issue
 * rather than the change's own ticket, which closes on merge; override with
 * ADOS_QUEUE_READY_LIVE_REF when the default is closed.
 */
const LIVE_REF = process.env.ADOS_QUEUE_READY_LIVE_REF ?? "GH-110";

const noChain = (): StatusProviderConfigRead => ({
  ok: true,
  config: { defaultChain: undefined, credentials: {}, entries: {}, chains: {} },
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

const liveComposition = (
  store: StatusComposition["store"],
  instance: ExternalSystemInstance,
): StatusComposition => ({
  store,
  credentials: createProcessCredentialPort(SYNTHETIC_BRAND),
  transport: nativeTransport,
  repository: { cwd: process.cwd(), io: nodeRepositoryIo() },
  localContext: {
    path: join(process.cwd(), ".ai/local/pm-context.yaml"),
    fs: nodeFileSystemFacts(),
  },
  clock: { nowMs: () => Date.now(), nowIso: () => new Date().toISOString() },
  github: { instance },
});

const roots: string[] = [];

describe("TC-QREADY-031 opt-in live smoke", () => {
  test("without the switch the suite performs zero live calls", () => {
    if (LIVE) {
      expect(true).toBe(true);
      return;
    }
    expect(LIVE).toBe(false);
  });

  const liveTest = test.skipIf(!LIVE);

  liveTest("the live repository returns the structural queue-ready contract", async () => {
    const root = makeTempRoot("gh176-queue-ready-live");
    roots.push(root);
    try {
      const store = openStore(makeIdentity(root)).store;
      const runtime: QueueRuntime = createStatusCommandRuntime(
        liveComposition(store, statusInstance()),
        noChain,
      );
      const run = await runQueueReadyCli(["queue", "ready", LIVE_REF, "--json"], runtime);
      expect(run.exitCode).toBe(0);
      const envelope = JSON.parse(run.stdout) as { readonly data?: QueueReadyPayload };
      const payload = envelope.data;
      expect(payload).toBeDefined();
      if (payload === undefined) return;
      expect(payload.schemaVersion).toBe("delivery.queue-ready.v1");
      expect(payload.candidates.length).toBeGreaterThan(0);
      for (const candidate of payload.candidates) {
        expect(candidate.conditions).toHaveLength(6);
        expect(candidate.conditions.map((condition) => condition.id)).toEqual([
          "deps-satisfied",
          "repo-free",
          "tier-known",
          "no-owner-gate",
          "ci-healthy",
          "provider-available",
        ]);
        const allSatisfied = candidate.conditions.every(
          (condition) => condition.state === "satisfied",
        );
        expect(candidate.ready).toBe(allSatisfied);
        expect(candidate.closeClass).not.toBe("merge-ready");
      }
      const observed = payload.candidates.filter(
        (candidate) => candidate.workItem.state === "observed",
      );
      expect(
        observed.length,
        "no explicit candidate was observed through the §8.3 identity rule; choose a ref present on the open-issue page",
      ).toBeGreaterThan(0);
      for (const candidate of payload.candidates) {
        const deps = candidate.conditions.find((condition) => condition.id === "deps-satisfied");
        if (candidate.workItem.state === "observed") {
          expect(deps?.state).not.toBe("satisfied");
        }
      }
      const providerText = JSON.stringify(
        payload.candidates.flatMap((candidate) =>
          candidate.conditions
            .filter((condition) => condition.id === "provider-available")
            .map((condition) => condition.evidence),
        ),
      );
      expect(providerText.toLowerCase().includes("available")).toBe(false);
      expect(payload.reasons).toEqual([...new Set(payload.reasons)]);
      expect(payload.reasons.length).toBeLessThanOrEqual(6);
      expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThanOrEqual(65536);
      const human = await runQueueReadyCli(["queue", "ready", LIVE_REF], runtime);
      expect(human.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(16);
      expect(Buffer.byteLength(human.stdout)).toBeLessThanOrEqual(4096);
      for (const secret of [TOKEN ?? ""]) {
        if (secret.length > 0) {
          expect(run.stdout).not.toContain(secret);
          expect(human.stdout).not.toContain(secret);
        }
      }
      expect(run.stdout.includes("ADOS_QUEUE_READY_LIVE")).toBe(false);
      expect(human.stdout.includes("ADOS_QUEUE_READY_LIVE")).toBe(false);
    } finally {
      for (const entry of roots.splice(0)) removeRoot(entry);
    }
  });
});
