/** TC-VGATES-032..034, 048..052, 061 — owner gate and read-only composition. */
import { describe, expect, test } from "bun:test";
import { evaluateVerifyGates } from "../../packages/core/src/domain/index";
import { createVerifyGatesCommandRuntime } from "../../packages/cli/src/edge";
import type {
  ExternalSystemInstance,
  StateStorePort,
} from "../../packages/core/src/contracts/index";
import { fixtureBrand } from "../fixtures/credentials/cases";
import { createEnvironmentCredentialPort } from "../../packages/adapters/src/credentials/index";
import { baseFacts, clone, lifecycle, workItem } from "../fixtures/verify-gates/cases/facts";

const owner = (facts: ReturnType<typeof baseFacts>) => evaluateVerifyGates(facts).gates[3];

const countOf = (record: ReturnType<typeof owner>, name: string): number | undefined =>
  record.citation.counts.find((entry) => entry.name === name)?.value;

const ownerNames = (record: ReturnType<typeof owner>): readonly string[] =>
  record.citation.names.find((entry) => entry.kind === "owner-labels")?.values ?? [];

describe("TC-VGATES-032/033 owner-gate scan", () => {
  test("no owner label passes with label counts", () => {
    const record = owner(baseFacts());
    expect(record.verdict).toBe("pass");
    expect(record.reason).toBe("owner-gate-absent");
    expect(countOf(record, "labels")).toBe(3);
    expect(countOf(record, "ownerLabels")).toBe(0);
    expect(ownerNames(record)).toEqual([]);
  });

  test("owner labels fail in contract order, case-insensitively", () => {
    const facts = clone(baseFacts());
    facts.workItem = {
      ok: true,
      value: { item: workItem(["human-input-needed", "other", "HAND-BACK"]) },
    };
    const record = owner(facts);
    expect(record.verdict).toBe("fail");
    expect(record.reason).toBe("owner-gate-present");
    expect(ownerNames(record)).toEqual(["hand-back", "human-input-needed"]);
    expect(countOf(record, "ownerLabels")).toBe(2);
  });
});

describe("TC-VGATES-034/061 owner unresolved, absent, and unknown", () => {
  test("a malformed identity is unresolved, never read-failed", () => {
    const facts = clone(baseFacts());
    facts.workItem = { ok: false, reason: "unresolved" };
    const record = owner(facts);
    expect(record.verdict).toBe("fail");
    expect(record.reason).toBe("ticket-unresolved");
    expect(record.citation.sources[0]?.outcome).toBe("unresolved");
  });

  test("a work-item 404 is absent with provider.not-found", () => {
    const facts = clone(baseFacts());
    facts.workItem = { ok: false, reason: "not-found" };
    const record = owner(facts);
    expect(record.verdict).toBe("fail");
    expect(record.reason).toBe("ticket-unresolved");
    expect(record.citation.sources[0]).toMatchObject({
      outcome: "absent",
      failureClass: "provider.not-found",
    });
  });

  test("transport, credential, and binding failures are unknown", () => {
    for (const reason of ["read-failed", "credential-unavailable", "address-unresolved"] as const) {
      const facts = clone(baseFacts());
      facts.workItem = {
        ok: false,
        reason,
        ...(reason === "credential-unavailable"
          ? { failureCode: "config.credential.missing" }
          : {}),
        ...(reason === "read-failed" ? { failureClass: "provider.payload.invalid" as const } : {}),
      };
      const record = owner(facts);
      expect(record.verdict).toBe("unknown");
      expect(record.reason).toBe(reason);
    }
  });
});

const repositoryIo = (cwd: string, config: string | undefined) => ({
  exists: (path: string) => path === `${cwd}/.git` || path === `${cwd}/.git/config`,
  isFile: (path: string) => path === `${cwd}/.git/config`,
  readText: (path: string) => (path === `${cwd}/.git/config` ? (config ?? "") : ""),
});

const store = (): StateStorePort =>
  ({
    identity: { stateDirectory: "/tmp/none", workspaceId: "unit" },
    read: () => ({
      ok: true,
      value: {
        evidence: { verifiedEmpty: true, recordCount: 0, verification: "verified" },
        values: {},
      },
    }),
  }) as unknown as StateStorePort;

const quietTransport = {
  send: async () => ({ status: 200, body: {} }),
};

const github = (mechanism: "anonymous" | "credential-reference"): ExternalSystemInstance => ({
  instanceName: "vcs-github",
  systemKind: "vcs",
  baseUrl: "https://api.github.example.com",
  authMethod:
    mechanism === "anonymous"
      ? { mechanism: "anonymous" }
      : {
          mechanism: "credential-reference",
          reference: { referenceName: "read", sourceKey: { style: "literal", name: "TOKEN" } },
        },
});

describe("TC-VGATES-048/050 credential guard and unresolved binding", () => {
  test("an anonymous instance withholds GitHub reads", async () => {
    const runtime = createVerifyGatesCommandRuntime({
      store: store(),
      changesDirectory: "/absent",
      fs: { exists: () => false, readText: () => "", listDirectory: () => [] },
      repository: {
        cwd: "/repo",
        io: repositoryIo("/repo", '[remote "origin"]\nurl = https://github.com/owner/repo.git\n'),
      },
      workflow: {
        baseDirectory: "/repo",
        fs: { exists: () => false, readText: () => "" },
      },
      github: {
        instance: github("anonymous"),
        credentials: createEnvironmentCredentialPort({ environment: {}, brand: fixtureBrand }),
        transport: quietTransport,
      },
    });
    expect(runtime.readRepository().binding).toBe("resolved");
    const list = await runtime.readOpenPullRequests(100);
    expect(list).toMatchObject({
      ok: false,
      reason: "credential-unavailable",
      failureCode: "config.credential.missing",
    });
    const item = await runtime.readWorkItem("GH-178");
    expect(item).toMatchObject({ ok: false, reason: "credential-unavailable" });
  });

  test("an unresolved binding makes every provider gate unknown", () => {
    const facts = clone(baseFacts());
    facts.repository.binding = "address-unresolved";
    facts.openPullRequests = { ok: false, reason: "address-unresolved" };
    facts.deliveryRequestDetail = { ok: false, reason: "address-unresolved" };
    facts.checkRuns = { ok: false, reason: "address-unresolved" };
    facts.workItem = { ok: false, reason: "address-unresolved" };
    const evaluated = evaluateVerifyGates(facts);
    for (const record of evaluated.gates.slice(1)) {
      expect(record.verdict).toBe("unknown");
      expect(record.reason).toBe("address-unresolved");
    }
    expect(evaluated.gates[0]?.verdict).toBe("pass");
  });

  test("the lifecycle gate still runs when every provider read is refused", () => {
    const facts = clone(baseFacts());
    facts.repository.binding = "address-unresolved";
    facts.lifecycle.evaluation = lifecycle({ variant: "lite" });
    expect(evaluateVerifyGates(facts).gates[0]?.verdict).toBe("pass");
  });
});

describe("TC-VGATES-051/052 read-only and deterministic", () => {
  test("identical facts evaluate byte-identically and no write occurs in the pure path", () => {
    const first = JSON.stringify(evaluateVerifyGates(baseFacts()));
    const second = JSON.stringify(evaluateVerifyGates(baseFacts()));
    expect(second).toBe(first);
    expect(first).not.toContain("planted-payload-verify-gates-canary");
  });
});
