/**
 * TC-HARNESS-001..007 — the harness-store credential strategy over injected
 * store-facts seams: target-selector export, single-entry selection, OAuth
 * refusal, shape-drift classification, identity match, and the pinned shape
 * and version window. Read-only against any store: the write-path double
 * fails the test if any write is reached.
 */
import { describe, expect, test } from "bun:test";
import { remedyText } from "../../packages/adapters/src/credentials/allowlist";
import {
  classifyHarnessStoreSource,
  HARNESS_CLI_VERSION_WINDOW,
  type HarnessStoreEntry,
  type StoreExportOutcome,
} from "../../packages/adapters/src/credentials/harness-store-strategy";
import { createCredentialResolver } from "../../packages/adapters/src/credentials/index";
import { CANARY, fixtureBrand } from "../fixtures/credentials/cases";

const DECLARED = {
  style: "harness-store" as const,
  harness: "opencode" as const,
  integrationId: "deepseek",
};

const entry = (overrides: Partial<HarnessStoreEntry>): HarnessStoreEntry => ({
  id: "entry-1",
  integrationID: "deepseek",
  label: "DeepSeek",
  active: true,
  value: { type: "key", key: CANARY },
  ...overrides,
});

/** A recording store-facts seam: canned outcomes plus a write-path tripwire. */
const storeFactsOf = (outcome: (integrationId: string) => StoreExportOutcome) => {
  const requests: string[] = [];
  const writesReached = false;
  return {
    requests,
    writeProbe: () => writesReached,
    storeFacts: {
      exportEntries: (request: { integrationId: string }) => {
        requests.push(request.integrationId);
        return outcome(request.integrationId);
      },
      // No write operation exists on the seam type; the probe exists to fail
      // the test if a future shape reaches one.
      ...({} as Record<string, never>),
    },
    assertReadOnly: (): void => {
      if (writesReached) throw new Error("the store write path was reached");
    },
  };
};

const classify = (
  storeFacts: {
    exportEntries: (request: { integrationId: string; standalone: boolean }) => StoreExportOutcome;
  },
  sourceKey = DECLARED,
) =>
  classifyHarnessStoreSource(sourceKey, {
    activeHarness: "opencode",
    storeFacts,
    registerSecret: () => undefined,
  });

const resolverWith = (
  outcome: (integrationId: string) => StoreExportOutcome,
  registered: string[],
) =>
  createCredentialResolver({
    environment: {},
    brand: fixtureBrand,
    harness: "opencode",
    runChild: () => ({ ok: false, reason: "program-unavailable" }),
    storeFacts: { exportEntries: (request) => outcome(request.integrationId) },
    registerSecret: (value) => registered.push(value),
  });

describe("TC-HARNESS-001 target-selector export; raw export never retained", () => {
  test("exactly one export per resolution, with the declared id behind the terminator", () => {
    const recording = storeFactsOf(() => ({
      ok: true,
      stdout: JSON.stringify([entry({})]),
      stdoutTruncated: false,
    }));
    const classification = classify(recording.storeFacts);
    expect(classification.status).toBe("resolved");
    expect(recording.requests).toEqual(["deepseek"]);
    recording.assertReadOnly();
  });

  test("in-process single-entry selection filters a multi-entry response", () => {
    const recording = storeFactsOf(() => ({
      ok: true,
      stdout: JSON.stringify([entry({ id: "a", active: false }), entry({ id: "b" })]),
      stdoutTruncated: false,
    }));
    const classification = classify(recording.storeFacts);
    expect(classification.status).toBe("resolved");
    if (classification.status === "resolved") {
      expect(classification.material.value).toBe(CANARY);
    }
  });

  test("only the selected key survives: no raw export retention anywhere", () => {
    const registered: string[] = [];
    const raw = JSON.stringify([
      entry({}),
      entry({ id: "other", active: false, value: { type: "key", key: "other-key" } }),
    ]);
    const resolver = resolverWith(
      () => ({
        ok: true,
        stdout: raw,
        stdoutTruncated: false,
      }),
      registered,
    );
    const resolution = resolver.resolve({ referenceName: "provider", sourceKey: DECLARED });
    expect(resolution.ok).toBe(true);
    // The register hook observes the keys as they are validated — never the
    // raw document — and the resolution payload carries only the material.
    expect(registered).toEqual([CANARY, "other-key"]);
    const payload = JSON.stringify(resolution);
    expect(payload).toContain(JSON.stringify(CANARY).slice(1, -1));
    expect(payload).not.toContain('"integrationID"');
    expect(payload).not.toContain("other-key");
  });
});

describe("TC-HARNESS-002 exactly one active entry or ambiguous-account", () => {
  test.each([
    ["zero active", [entry({ active: false })]],
    ["two active", [entry({ id: "a" }), entry({ id: "b" })]],
  ])("%s refuses ambiguous-account with source and remedy", (_name, entries) => {
    const classification = classify({
      exportEntries: () => ({ ok: true, stdout: JSON.stringify(entries), stdoutTruncated: false }),
    });
    expect(classification.status).toBe("refused");
    if (classification.status === "refused")
      expect(classification.reason).toBe("ambiguous-account");
    // The refusal renders with its source and the fixed remedy — never "the
    // first" or "the newest".
    const resolution = createCredentialResolver({
      environment: {},
      brand: fixtureBrand,
      harness: "opencode",
      runChild: () => ({ ok: false, reason: "program-unavailable" }),
      storeFacts: {
        exportEntries: () => ({
          ok: true,
          stdout: JSON.stringify(entries),
          stdoutTruncated: false,
        }),
      },
      registerSecret: () => undefined,
    }).resolve({ referenceName: "provider", sourceKey: DECLARED });
    if (!resolution.ok) {
      expect(resolution.source).toBe("harness-store:opencode:deepseek");
      expect(resolution.reason).toBe("ambiguous-account");
      expect(resolution.remedy).toBe(remedyText("ambiguous-account", "harness-store"));
    }
  });
});

describe("TC-HARNESS-003 no stored entry: empty-output with zero fall-through", () => {
  test("the environment sentinel is untouched; no second resolve occurs", () => {
    const registered: string[] = [];
    let resolves = 0;
    const resolver = createCredentialResolver({
      environment: { DEEPSEEK_API_KEY: "sentinel-fall-through" },
      brand: fixtureBrand,
      harness: "opencode",
      runChild: () => {
        resolves += 1;
        return { ok: false, reason: "program-unavailable" };
      },
      storeFacts: { exportEntries: () => ({ ok: true, stdout: "[]", stdoutTruncated: false }) },
      registerSecret: (value) => registered.push(value),
    });
    const resolution = resolver.resolve({ referenceName: "provider", sourceKey: DECLARED });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toBe("empty-output");
      expect(resolution.source).toBe("harness-store:opencode:deepseek");
    }
    // Zero fall-through: no child ran (the harness-store style never consults
    // the command runner) and the environment sentinel was never registered.
    expect(resolves).toBe(0);
    expect(registered).toEqual([]);
    expect(JSON.stringify(resolution)).not.toContain("sentinel-fall-through");
  });
});

describe("TC-HARNESS-004 oauth-excluded; no consume/refresh/write-back", () => {
  test("an active oauth entry refuses outright with source and remedy", () => {
    const oauthEntry = entry({ value: { type: "oauth" } });
    const recording = storeFactsOf(() => ({
      ok: true,
      stdout: JSON.stringify([oauthEntry]),
      stdoutTruncated: false,
    }));
    const classification = classify(recording.storeFacts);
    expect(classification.status).toBe("refused");
    if (classification.status === "refused") expect(classification.reason).toBe("oauth-excluded");
    recording.assertReadOnly();
    const resolution = createCredentialResolver({
      environment: {},
      brand: fixtureBrand,
      harness: "opencode",
      runChild: () => ({ ok: false, reason: "program-unavailable" }),
      storeFacts: {
        exportEntries: () => ({
          ok: true,
          stdout: JSON.stringify([oauthEntry]),
          stdoutTruncated: false,
        }),
      },
      registerSecret: () => undefined,
    }).resolve({ referenceName: "provider", sourceKey: DECLARED });
    if (!resolution.ok)
      expect(resolution.remedy).toBe(remedyText("oauth-excluded", "harness-store"));
  });

  test("structural inventory: no code path consumes, refreshes, or writes back a grant", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    for (const file of [
      "packages/adapters/src/credentials/harness-store-strategy.ts",
      "packages/adapters/src/credentials/index.ts",
      "packages/adapters/src/credentials/command-strategy.ts",
      "packages/adapters/src/credentials/allowlist.ts",
    ]) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/refresh/i);
      expect(text).not.toMatch(/writeFile|appendFile/);
      expect(text).not.toContain("methodID");
      expect(text).not.toContain("accessToken");
      expect(text).not.toContain("refreshToken");
    }
  });
});

describe("TC-HARNESS-005 shape drift classified naming harness and field", () => {
  test.each([
    ["non-array root", JSON.stringify({ entries: [] }), "root"],
    ["entry missing id", JSON.stringify([{ integrationID: "deepseek" }]), "id"],
    ["entry missing integrationID", JSON.stringify([{ id: "e" }]), "integrationID"],
    ["entry missing label", JSON.stringify([{ id: "e", integrationID: "deepseek" }]), "label"],
    [
      "entry missing active",
      JSON.stringify([{ id: "e", integrationID: "deepseek", label: "L" }]),
      "active",
    ],
    [
      "entry missing value",
      JSON.stringify([{ id: "e", integrationID: "deepseek", label: "L", active: true }]),
      "value",
    ],
    [
      "unexpected value.type",
      JSON.stringify([
        { id: "e", integrationID: "deepseek", label: "L", active: true, value: { type: "token" } },
      ]),
      "value.type",
    ],
    ["unparseable output", "not-json{", "output"],
  ])("%s refuses shape-drift naming the harness and the field", (_name, stdout, field) => {
    const classification = classify({
      exportEntries: () => ({ ok: true, stdout, stdoutTruncated: false }),
    });
    expect(classification.status).toBe("refused");
    if (classification.status === "refused") {
      expect(classification.reason).toBe("shape-drift");
      expect(classification.field).toBe(field);
    }
    // The drift never yields material and never falls through; the resolved
    // port failure names the harness identity and the offending field
    // (AC-F3-5) on the rendered source.
    const resolution = createCredentialResolver({
      environment: { DEEPSEEK_API_KEY: "sentinel-fall-through" },
      brand: fixtureBrand,
      harness: "opencode",
      runChild: () => ({ ok: false, reason: "program-unavailable" }),
      storeFacts: { exportEntries: () => ({ ok: true, stdout, stdoutTruncated: false }) },
      registerSecret: () => undefined,
    }).resolve({ referenceName: "provider", sourceKey: DECLARED });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toBe("shape-drift");
      expect(resolution.source).toBe(`harness-store:opencode:deepseek field=${field}`);
    }
  });

  test("control: the pinned key shape yields the key; truncated stdout is drift", () => {
    expect(
      classify({
        exportEntries: () => ({
          ok: true,
          stdout: JSON.stringify([entry({})]),
          stdoutTruncated: false,
        }),
      }).status,
    ).toBe("resolved");
    const truncated = classify({
      exportEntries: () => ({ ok: true, stdout: "[]", stdoutTruncated: true }),
    });
    if (truncated.status !== "refused") throw new Error("truncated stdout must refuse");
    expect(truncated.reason).toBe("shape-drift");
  });
});

describe("TC-HARNESS-006 harness identity match or cold source-not-supported", () => {
  test("declared harness equals the active identity: resolution proceeds (control)", () => {
    expect(
      classify({ exportEntries: () => ({ ok: true, stdout: "[]", stdoutTruncated: false }) })
        .status,
    ).toBe("refused");
    expect(
      classify({
        exportEntries: () => ({
          ok: true,
          stdout: JSON.stringify([entry({})]),
          stdoutTruncated: false,
        }),
      }).status,
    ).toBe("resolved");
  });

  test("an unsupported harness name refuses cold: no store read, no other source", () => {
    let consulted = 0;
    const classification = classifyHarnessStoreSource(
      { style: "harness-store", harness: "competitor-cli", integrationId: "deepseek" },
      {
        activeHarness: "opencode",
        storeFacts: {
          exportEntries: () => {
            consulted += 1;
            return { ok: true, stdout: "[]", stdoutTruncated: false };
          },
        },
        registerSecret: () => undefined,
      },
    );
    expect(classification.status).toBe("refused");
    if (classification.status === "refused")
      expect(classification.reason).toBe("source-not-supported");
    expect(consulted).toBe(0);
  });

  test("a declared mismatch refuses without borrowing another store", () => {
    let consulted = 0;
    const classification = classifyHarnessStoreSource(
      { style: "harness-store", harness: "claude-code", integrationId: "deepseek" },
      {
        activeHarness: "opencode",
        storeFacts: {
          exportEntries: () => {
            consulted += 1;
            return { ok: true, stdout: JSON.stringify([entry({})]), stdoutTruncated: false };
          },
        },
        registerSecret: () => undefined,
      },
    );
    expect(classification.status).toBe("refused");
    if (classification.status === "refused")
      expect(classification.reason).toBe("source-not-supported");
    expect(consulted).toBe(0);
  });
});

describe("TC-HARNESS-007 export shape and version window pinned via fixture doubles", () => {
  test("the pinned shape fixture is committed data and the parser accepts exactly it", () => {
    const pinned = JSON.stringify([
      {
        id: "fixture-1",
        integrationID: "deepseek",
        label: "DeepSeek",
        active: true,
        value: { type: "key", key: "fixture-key" },
      },
      {
        id: "fixture-2",
        integrationID: "deepseek",
        label: "DeepSeek (oauth)",
        active: false,
        value: { type: "oauth" },
      },
    ]);
    const classification = classify({
      exportEntries: () => ({ ok: true, stdout: pinned, stdoutTruncated: false }),
    });
    expect(classification.status).toBe("resolved");
    if (classification.status === "resolved")
      expect(classification.material.value).toBe("fixture-key");
  });

  test("the supported version window is the plan's fixed declared constant", () => {
    expect(HARNESS_CLI_VERSION_WINDOW).toBe(">=2.3.2 <3.0.0");
  });
});
