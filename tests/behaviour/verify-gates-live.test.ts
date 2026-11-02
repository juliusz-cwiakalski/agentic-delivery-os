/**
 * TC-VGATES-059 — opt-in structural live smoke (never in pnpm check or default CI).
 *
 * Run with `VERIFY_GATES_LIVE=1 GITHUB_TOKEN=…`. The suite composes the real
 * runtime-aware edge, reads the real change artifacts and CI workflow, and uses
 * the process credential port plus a fetch-backed transport. It asserts only
 * structural invariants (five ordered gates, citation bounds, exit semantics,
 * secret-free output), never volatile counts. Without the flag it is skipped.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { createEnvironmentCredentialPort } from "../../packages/adapters/src/credentials/index";
import { nodeFileSystemFacts } from "../../packages/adapters/src/file/index";
import { nodeRepositoryIo } from "../../packages/adapters/src/repo/index";
import { createVerifyGatesCommandRuntime, type StatusTransport } from "../../packages/cli/src/edge";
import type { ExternalSystemInstance } from "../../packages/core/src/contracts/index";
import { fixtureBrand } from "../fixtures/credentials/cases";
import { runVerify } from "../fixtures/verify-gates/cases/harness";
import { createVerifyState } from "./verify-support";

const live = process.env.VERIFY_GATES_LIVE === "1";
const describeLive = live ? describe : describe.skip;

const TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
const ROOT = process.cwd();
const GATE_ORDER = [
  "lifecycle-finalization",
  "ci-green",
  "push-parity",
  "owner-gate",
  "squash-preflight",
] as const;

const liveFs = () => ({
  ...nodeFileSystemFacts(),
  listDirectory: (path: string): readonly string[] => {
    try {
      return readdirSync(path);
    } catch {
      return [];
    }
  },
});

const fetchTransport: StatusTransport = {
  send: async ({ url, method, headers }) => {
    const response = await globalThis.fetch(url, { method, headers });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    return { status: response.status, body };
  },
};

const githubInstance = (): ExternalSystemInstance => ({
  instanceName: "vcs-github",
  systemKind: "vcs",
  baseUrl: "https://api.github.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "read",
      sourceKey: { style: "literal", name: "GITHUB_TOKEN" },
    },
  },
});

const liveRuntime = () => {
  const state = createVerifyState({ workspaceId: "live-smoke" });
  const gates = createVerifyGatesCommandRuntime({
    store: state.store,
    changesDirectory: join(ROOT, "doc/changes"),
    fs: liveFs(),
    repository: { cwd: ROOT, io: nodeRepositoryIo() },
    workflow: { baseDirectory: ROOT, fs: nodeFileSystemFacts() },
    github: {
      instance: githubInstance(),
      credentials: createEnvironmentCredentialPort({
        environment: { ...process.env, GITHUB_TOKEN: TOKEN },
        brand: fixtureBrand,
      }),
      transport: fetchTransport,
    },
  });
  return {
    runtime: {
      readPmNotes: () => ({ ok: false as const, reason: "missing" as const }),
      readRegistry: () => ({
        ok: true as const,
        present: false,
        verifiedEmpty: true,
        transitions: [],
        recordCount: 0,
      }),
      gates,
    },
    cleanup: () => state.cleanup(),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const arrayField = (record: Record<string, unknown>, key: string): readonly unknown[] => {
  const value = record[key];
  return Array.isArray(value) ? value : [];
};

describeLive("TC-VGATES-059 opt-in live structural smoke", () => {
  test("the real edge composes five ordered gates with bounded, secret-free output", async () => {
    if (TOKEN === undefined || TOKEN.length === 0) {
      throw new Error("VERIFY_GATES_LIVE=1 requires GITHUB_TOKEN or GH_TOKEN");
    }
    const live = liveRuntime();
    try {
      const result = await runVerify(live.runtime, ["gates", "GH-178"], { secrets: [TOKEN] });
      expect([0, 1, 2]).toContain(result.exitCode);
      expect(result.stdout).not.toContain(TOKEN);
      expect(result.stderr).not.toContain(TOKEN);

      if (result.exitCode === 0) {
        const data = result.envelope?.data;
        expect(isRecord(data)).toBe(true);
        if (!isRecord(data)) throw new Error("expected success data");
        expect(data.overall).toBe("pass");
        const gates = arrayField(data, "gates");
        expect(gates).toHaveLength(5);
        for (const [index, gate] of gates.entries()) {
          expect(isRecord(gate)).toBe(true);
          if (!isRecord(gate)) throw new Error("expected a gate record");
          expect(gate.id).toBe(GATE_ORDER[index]);
          const citation = gate.citation;
          expect(isRecord(citation)).toBe(true);
          if (!isRecord(citation)) throw new Error("expected a citation");
          expect(arrayField(citation, "sources").length).toBeGreaterThan(0);
          expect(arrayField(citation, "sources").length).toBeLessThanOrEqual(3);
          expect(arrayField(citation, "reasons").length).toBeGreaterThan(0);
          expect(arrayField(citation, "reasons").length).toBeLessThanOrEqual(4);
          expect(arrayField(citation, "counts").length).toBeLessThanOrEqual(8);
          expect(arrayField(citation, "names").length).toBeLessThanOrEqual(3);
        }
        return;
      }

      const error = result.envelope?.error;
      const summary = isRecord(error) && typeof error.summary === "string" ? error.summary : "";
      const lines = summary.split("\n");
      expect(lines[0]).toMatch(
        /^result=(fail|unknown); gates=\d\/5 passed, \d failed, \d unknown$/,
      );
      for (const gateId of GATE_ORDER) {
        expect(lines.some((line) => line.startsWith(`${gateId} `))).toBe(true);
      }
    } finally {
      live.cleanup();
    }
  });
});
