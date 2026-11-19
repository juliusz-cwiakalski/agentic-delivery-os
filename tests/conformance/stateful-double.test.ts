/**
 * TC-DOUBLE-001..007 and TC-DMUT-001..004 — the deterministic simulated
 * stateful tracker double, its declared five effects, the additive tenant
 * extension, the fail-closed refusals, and offline containment.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONFORMANCE_ADAPTERS,
  CONFORMANCE_FLOWS,
  canonicalizeState,
  createMockTenantTransport,
  createStatefulTenantTransport,
  decodeMockTenant,
  type MockTenant,
  type MockTenantState,
  STATEFUL_EFFECTS,
} from "@delivery-os/testkit";
import { createGitHubClient } from "../../packages/adapters/src/github/client";
import {
  INVALID_EFFECT_CASES,
  VALID_STATEFUL_BASELINE,
} from "../fixtures/providers/conformance/stateful/invalid-effects";
import {
  createCanaryCredentialPort,
  installChildProcessGuard,
  installThrowingFetchGuard,
} from "./support/fixtures";
import { scanTestkitSource, testkitSourceFiles } from "./support/testkit-source-scan";

const ROOT = process.cwd();
const STATEFUL = "tests/fixtures/providers/conformance/stateful";
const STATELESS = "tests/fixtures/providers/conformance";

const readJson = (path: string): unknown => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

const decodeOrThrow = (raw: unknown, label: string): MockTenant => {
  const decoded = decodeMockTenant(raw);
  if (!decoded.ok) throw new Error(`${label}: ${decoded.detail}`);
  return decoded.value;
};

const statefulTenant = (provider: string): MockTenant =>
  decodeOrThrow(readJson(`${STATEFUL}/${provider}/tenant.json`), provider);

const githubClientFor = (
  tenant: MockTenant,
  transport: ReturnType<typeof createStatefulTenantTransport>,
) => {
  if (tenant.addressing.provider !== "github") throw new Error("github addressing missing");
  return createGitHubClient({
    instance: tenant.instance,
    credentials: createCanaryCredentialPort(),
    repository: { owner: tenant.addressing.owner, name: tenant.addressing.repo },
    transport,
  });
};

const send = (
  transport: ReturnType<typeof createStatefulTenantTransport>,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: string,
): Promise<unknown> =>
  transport.send({
    method,
    url: `https://api.github.example.com/stateful/${path}`,
    headers: {},
    ...(body === undefined ? {} : { body }),
  });

describe("TC-DOUBLE-001 write-then-read is observable through the client factory", () => {
  test("a transition lands in state and the next read observes it, with the registry census unchanged", async () => {
    const tenant = statefulTenant("github");
    const transport = createStatefulTenantTransport({ tenant });
    const client = githubClientFor(tenant, transport);
    const addressing = tenant.addressing;
    if (addressing.provider !== "github") throw new Error("github addressing missing");

    const before = await client.readWorkItem(addressing.issueNumber);
    if (!before.ok) throw new Error("initial read failed");
    expect(before.value.title).toBe("Stateful initial title");

    const write = await client.transitionWorkItem({
      entityId: String(addressing.issueNumber),
      deliveryState: "done",
    });
    expect(write.ok).toBe(true);

    const after = await client.readWorkItem(addressing.issueNumber);
    if (!after.ok) throw new Error("second read failed");
    expect(after.value.status.deliveryState).toBe("done");
    expect(after.value.title).toBe("Stateful initial title");

    expect(CONFORMANCE_FLOWS).toHaveLength(3);
    expect(CONFORMANCE_FLOWS.flatMap((flow) => flow.steps)).toHaveLength(14);
    expect(CONFORMANCE_ADAPTERS).toHaveLength(3);
  });
});

describe("TC-DOUBLE-002 two replays are identical and match the committed golden", () => {
  const sequence = async (
    transport: ReturnType<typeof createStatefulTenantTransport>,
  ): Promise<void> => {
    await send(transport, "POST", "set-field");
    await send(transport, "POST", "replace-collection");
    await send(transport, "POST", "append-entry");
    await send(transport, "POST", "mark-resolved");
  };

  test("canonical state, normalized reads and request results are deep-equal", async () => {
    const first = createStatefulTenantTransport({ tenant: statefulTenant("github") });
    const second = createStatefulTenantTransport({ tenant: statefulTenant("github") });
    await sequence(first);
    await sequence(second);
    expect(second.canonicalState()).toBe(first.canonicalState());
    expect(second.requests).toEqual(first.requests);

    const golden = readJson(`${STATEFUL}/github/expected-state.json`) as {
      state: MockTenantState;
    };
    expect(first.canonicalState()).toBe(canonicalizeState(golden.state));

    const firstClient = githubClientFor(statefulTenant("github"), first);
    const secondClient = githubClientFor(statefulTenant("github"), second);
    const addressing = statefulTenant("github").addressing;
    if (addressing.provider !== "github") throw new Error("github addressing missing");
    const firstRead = await firstClient.readWorkItem(addressing.issueNumber);
    const secondRead = await secondClient.readWorkItem(addressing.issueNumber);
    expect(secondRead).toEqual(firstRead);
  });
});

describe("TC-DOUBLE-003 the three refusals fail closed by name", () => {
  test("an undeclared request fails with the delivered message", async () => {
    const transport = createStatefulTenantTransport({ tenant: statefulTenant("github") });
    await expect(
      transport.send({ method: "GET", url: "https://api.github.example.com/unknown", headers: {} }),
    ).rejects.toThrow("unfixtured provider request GET https://api.github.example.com/unknown");
  });

  test("an undeclared effect and a missing resource fail naming method, URL and effect, with state unchanged", async () => {
    const tenant = statefulTenant("github");
    const route = tenant.routes.find((candidate) => candidate.url.endsWith("/set-field"));
    if (route === undefined || route.effect === undefined) throw new Error("effect route missing");
    const before = createStatefulTenantTransport({ tenant }).canonicalState();
    (route as { effect: unknown }).effect = { kind: "explode", resource: "issue" };
    const undeclared = createStatefulTenantTransport({ tenant });
    const initial = undeclared.canonicalState();
    await expect(send(undeclared as never, "POST", "set-field")).rejects.toThrow(
      /effect explode failed for POST .*set-field/,
    );
    expect(undeclared.canonicalState()).toBe(initial);
    expect(before).toBe(initial);

    const missingTenant = statefulTenant("github");
    const missingRoute = missingTenant.routes.find((candidate) =>
      candidate.url.endsWith("/set-field"),
    );
    if (missingRoute === undefined) throw new Error("effect route missing");
    (missingRoute as { effect: unknown }).effect = {
      kind: "set-field",
      resource: "absent",
      field: "title",
      value: "x",
    };
    const missing = createStatefulTenantTransport({ tenant: missingTenant });
    const missingInitial = missing.canonicalState();
    await expect(send(missing as never, "POST", "set-field")).rejects.toThrow(
      /effect set-field failed .*state resource absent is missing/,
    );
    expect(missing.canonicalState()).toBe(missingInitial);
  });
});

describe("TC-DOUBLE-004 both guards observe zero calls and are provably armed", () => {
  test("the double-backed sequence performs no network and no child process", async () => {
    const fetchGuard = installThrowingFetchGuard();
    const childGuard = installChildProcessGuard();
    try {
      const transport = createStatefulTenantTransport({ tenant: statefulTenant("github") });
      await send(transport, "POST", "set-field");
      await send(transport, "POST", "append-entry");
      expect(fetchGuard.calls).toEqual([]);
      expect(childGuard.calls).toEqual([]);
      await expect(fetch("https://api.github.example.com/stateful/live")).rejects.toThrow(
        "must not perform live network calls",
      );
      const guarded = (await import("node:child_process")) as {
        spawnSync: (command: string, args: readonly string[]) => unknown;
      };
      expect(() => guarded.spawnSync("git", ["status"])).toThrow(
        "must not spawn a live child process",
      );
      expect(fetchGuard.calls).toHaveLength(1);
      expect(childGuard.calls).toEqual(["spawnSync"]);
    } finally {
      childGuard.restore();
      fetchGuard.restore();
    }
  });
});

describe("TC-DOUBLE-005 committed stateless tenants stay byte-identical and never mutate", () => {
  test("the three stateless tenants decode with no effect or state member", () => {
    for (const provider of ["github", "gitlab", "jira"]) {
      const raw = readJson(`${STATELESS}/${provider}/tenant.json`) as {
        routes: Array<Record<string, unknown>>;
      };
      const decoded = decodeOrThrow(raw, provider);
      expect(decoded.initialState).toBeUndefined();
      expect(decoded.identitySequences).toBeUndefined();
      expect(decoded.routes.map((route) => route.effect)).toEqual(raw.routes.map(() => undefined));
      expect(decoded.routes.map((route) => route.responseFromState)).toEqual(
        raw.routes.map(() => undefined),
      );
    }
  });

  test("a write-shaped body on an effect-less route leaves state unchanged", async () => {
    const tenant = statefulTenant("github");
    const transport = createStatefulTenantTransport({ tenant });
    const before = transport.canonicalState();
    await send(transport, "POST", "effect-less", JSON.stringify({ state: "closed", title: "x" }));
    await send(transport, "GET", "write-lookalike");
    await send(transport, "POST", "payload-lookalike", JSON.stringify({ state: "closed" }));
    expect(transport.canonicalState()).toBe(before);
  });

  test("the stateless transport returns the same declared bodies", async () => {
    const tenant = decodeOrThrow(readJson(`${STATELESS}/github/tenant.json`), "github stateless");
    const stateless = createMockTenantTransport(tenant);
    const double = createStatefulTenantTransport({ tenant });
    const request = {
      method: "GET" as const,
      url: "https://github.example.com/repos/owner-placeholder/project-placeholder/issues/601",
      headers: {},
    };
    expect(await double.send(request)).toEqual(await stateless.send(request));
  });
});

describe("TC-DOUBLE-006 the double is runtime-neutral", () => {
  test("the module imports no node/bun module and the ambient scan includes it", () => {
    const source = readFileSync(
      join(ROOT, "packages/testkit/src/conformance/stateful-double.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["']node:/);
    expect(source).not.toMatch(/from\s+["']bun:/);
    expect(testkitSourceFiles(ROOT)).toContain(
      "packages/testkit/src/conformance/stateful-double.ts",
    );
    expect(scanTestkitSource(ROOT)).toEqual([]);
  });
});

describe("TC-DOUBLE-007 each of the five effects is applied and never inferred", () => {
  test("the effect vocabulary is exactly five members", () => {
    expect([...STATEFUL_EFFECTS]).toEqual([
      "set-field",
      "reset-field",
      "replace-collection",
      "append-entry",
      "mark-resolved",
    ]);
  });

  test("each effect lands and a later read observes it", async () => {
    const tenant = statefulTenant("github");
    const transport = createStatefulTenantTransport({ tenant });
    await send(transport, "POST", "set-field");
    let state = transport.state().issue;
    expect(state?.fields.title).toBe("Set field value");
    expect(state?.fields.state).toBe("open");

    await send(transport, "POST", "reset-field");
    state = transport.state().issue;
    expect(state?.fields.title).toBe("Stateful initial title");

    await send(transport, "POST", "replace-collection");
    state = transport.state().issue;
    expect(state?.collections?.labels).toEqual([{ name: "delivered" }]);

    await send(transport, "POST", "append-entry");
    await send(transport, "POST", "append-entry");
    state = transport.state().issue;
    expect(state?.collections?.comments).toEqual([
      { body: "first", id: "comment-1001" },
      { body: "first", id: "comment-1002" },
    ]);

    await send(transport, "POST", "mark-resolved");
    state = transport.state().issue;
    expect(state?.subResources?.thread).toEqual({ resolved: true });
  });

  test("a mutating body, a write-looking GET and a state-named payload are never inferred as effects", async () => {
    const transport = createStatefulTenantTransport({ tenant: statefulTenant("github") });
    const before = transport.canonicalState();
    await send(transport, "POST", "effect-less", JSON.stringify({ state: "closed" }));
    await send(transport, "GET", "write-lookalike");
    await send(transport, "POST", "payload-lookalike", JSON.stringify({ title: "inferred" }));
    expect(transport.canonicalState()).toBe(before);
  });
});

describe("TC-DMUT-001..004 malformed declarations fail at decode with a paired valid baseline", () => {
  test("the valid baseline decodes", () => {
    expect(decodeMockTenant(VALID_STATEFUL_BASELINE).ok).toBe(true);
  });

  for (const testCase of INVALID_EFFECT_CASES) {
    test(`${testCase.id} fails naming the offending declaration`, () => {
      const decoded = decodeMockTenant(testCase.tenant);
      expect(decoded.ok).toBe(false);
      if (decoded.ok) throw new Error("expected decode failure");
      expect(decoded.detail).toContain(testCase.expected);
      expect(decoded.detail).toMatch(/route \d+/);
    });
  }
});
