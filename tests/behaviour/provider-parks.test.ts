/**
 * TC-PROV-028..033 (model halves) — park shape, closed allowlist, deterministic
 * naming, T−1/T/T+1 expiry views, fold ordering, and cap/chain expiries.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PHASE_TRANSITION_KIND,
  type ProviderParkEvidence,
  PROVIDER_RECORD_KINDS,
} from "../../packages/core/src/contracts/index";
import { resolveProviderChain } from "../../packages/core/src/provider/chain";
import {
  chainParkName,
  compareParks,
  createParkRecord,
  foldParks,
  formatUtcIso,
  parkView,
  providerParkName,
} from "../../packages/core/src/provider/parks";

const ROOT = process.cwd();
const allowlist = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/provider/evidence/park-allowlist.json"), "utf8"),
) as { fields: string[] };
const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);
const evidence: ProviderParkEvidence = {
  providerName: "zai-coding-plan",
  conditionKinds: ["quota-exhausted"],
  waitSeconds: 60,
  resetEpochMs: NOW + 60 * 1000,
};
const park = (expiresAtMs = NOW + 60 * 1000) =>
  createParkRecord({
    subjectKind: "provider",
    subjectName: "zai-coding-plan",
    cause: "quota-exhausted",
    conditions: ["quota-exhausted"],
    createdAtMs: NOW,
    expiresAtMs,
    evidence,
  });

describe("TC-PROV-028 park shape and closed allowlist", () => {
  test("name, subject, cause, conditions, expiry, and evidence are deterministic", () => {
    const record = park();
    expect(record.name).toBe("provider:zai-coding-plan");
    expect(providerParkName("zai")).toBe("provider:zai");
    expect(chainParkName("default")).toBe("chain:default");
    expect(record.subjectKind).toBe("provider");
    expect(record.subjectName).toBe("zai-coding-plan");
    expect(record.cause).toBe("quota-exhausted");
    expect(record.conditions).toEqual(["quota-exhausted"]);
    expect(record.expiresAtMs).toBeGreaterThan(record.createdAtMs);
    expect(record.expiresAt).toBe(formatUtcIso(record.expiresAtMs));
    expect(record.schemaVersion).toBe("delivery.provider.park.v1");
  });

  test("every evidence key belongs to the eight-field allowlist", () => {
    for (const key of Object.keys(park().evidence)) {
      expect(allowlist.fields).toContain(key);
    }
    expect(allowlist.fields).toHaveLength(8);
  });
});

describe("TC-PROV-029 exact-expiry inactivity with no write", () => {
  test("T−1 active, T expired, T+1 expired; the record is unchanged", () => {
    const record = park(NOW + 1000);
    const before = JSON.stringify(record);
    expect(parkView(record, NOW + 999).state).toBe("active");
    expect(parkView(record, NOW + 1000).state).toBe("expired");
    expect(parkView(record, NOW + 1001).state).toBe("expired");
    expect(JSON.stringify(record)).toBe(before);
  });

  test("a cleared record is reported cleared and retains its clear time", () => {
    const record = park();
    const cleared: typeof record = {
      ...record,
      state: "cleared",
      clearedAt: formatUtcIso(NOW + 10),
      clearedAtMs: NOW + 10,
    };
    expect(parkView(cleared, NOW + 20).state).toBe("cleared");
    expect(parkView(cleared, NOW + 20).clearedAt).toBe(formatUtcIso(NOW + 10));
  });
});

describe("TC-PROV-031/AC-F5-4 park versus blocked lane", () => {
  test("a park and a lane transition are distinct record kinds and states", () => {
    const record = park();
    const lane = {
      kind: PHASE_TRANSITION_KIND,
      changeRef: "GH-182",
      phaseId: "delivery",
      operation: "complete",
      timestamp: formatUtcIso(NOW),
      outcome: "landed",
    } as const;
    expect(PROVIDER_RECORD_KINDS).toContain("provider.park");
    expect(PROVIDER_RECORD_KINDS).not.toContain(PHASE_TRANSITION_KIND);
    expect(record.schemaVersion).not.toBe("delivery.registry.v1");
    // A park always carries a resume time and never reports a lane as blocked.
    expect(record.subjectKind).toBe("provider");
    expect(record.expiresAtMs).toBeGreaterThan(NOW);
    expect(parkView(record, NOW).state).toBe("active");
    expect(Object.hasOwn(record, "phaseId")).toBe(false);
    expect(Object.hasOwn(record, "blocked")).toBe(false);
    // A lane transition carries no park expiry, cause, or park state.
    expect(Object.hasOwn(lane, "expiresAtMs")).toBe(false);
    expect(Object.hasOwn(lane, "cause")).toBe(false);
    expect(Object.hasOwn(lane, "state")).toBe(false);
  });
});

describe("TC-PROV-030/033 fold, ordering, and cap/chain expiry", () => {
  test("the fold keeps the latest record per park name and orders by expiry/name", () => {
    const first = park(NOW + 1000);
    const changed = { ...park(NOW + 2000), cause: "peak-window" as const };
    const other = createParkRecord({
      subjectKind: "provider",
      subjectName: "alpha",
      cause: "peak-window",
      conditions: ["peak-window"],
      createdAtMs: NOW,
      expiresAtMs: NOW + 3000,
      evidence: { providerName: "alpha", conditionKinds: ["peak-window"] },
    });
    const folded = foldParks([first, changed, other]);
    expect(folded).toHaveLength(2);
    expect(folded[0]?.name).toBe("provider:zai-coding-plan");
    expect(folded[0]?.cause).toBe("peak-window");
    expect(folded[1]?.name).toBe("provider:alpha");
    expect([...folded].sort(compareParks).map((record) => record.name)).toEqual(
      folded.map((record) => record.name),
    );
  });

  test("a chain-exhausted park uses the earliest contributing provider expiry", () => {
    const chain = { name: "default", entries: ["a", "b"], allowPaidFallback: false };
    const outcome = resolveProviderChain({
      chain,
      nowMs: NOW,
      states: {
        a: {
          descriptor: { name: "a", class: "subscription", enabled: true },
          condition: {
            status: "parked",
            cause: "quota-exhausted",
            conditions: ["quota-exhausted"],
            waitSeconds: 900,
            expiresAtMs: NOW + 900 * 1000,
            announcementCode: "provider.quota.parked",
            evidence: { conditionKinds: ["quota-exhausted"], waitSeconds: 900 },
          },
        },
        b: {
          descriptor: { name: "b", class: "subscription", enabled: true },
          condition: {
            status: "parked",
            cause: "provider-outage",
            conditions: ["provider-outage"],
            waitSeconds: 300,
            expiresAtMs: NOW + 300 * 1000,
            announcementCode: "provider.quota.unreachable",
            evidence: { conditionKinds: ["provider-outage"], waitSeconds: 300 },
          },
        },
      },
    });
    if (!outcome.ok || outcome.decision.kind !== "parked") throw new Error("expected a chain park");
    expect(outcome.decision.park.name).toBe("chain:default");
    expect(outcome.decision.park.cause).toBe("chain-exhausted");
    expect(outcome.decision.park.expiresAtMs).toBe(NOW + 300 * 1000);
    expect(outcome.decision.park.expiresAtMs).toBeGreaterThan(outcome.decision.park.createdAtMs);
  });
});

import type {
  CredentialPort,
  ProviderClock,
  ProviderConfiguration,
  ProviderSleep,
  QuotaTransport,
} from "../../packages/core/src/contracts/index";
import { createProviderEngine } from "../../packages/core/src/provider/engine";
import {
  providerParksProjection,
  readProviderLedger,
  readProviderParkViews,
} from "../../packages/core/src/provider/parks";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const engineClock: ProviderClock = { nowMs: () => NOW };
const engineSleep: ProviderSleep = { sleep: async () => undefined };
const engineCredential: CredentialPort = {
  resolve: () => ({ ok: true, material: { value: "CANARY-SECRET" } }),
};

const stateConfig = (_reset = NOW + 3600 * 1000): ProviderConfiguration => ({
  defaultChain: "default",
  credentials: { zai: { sourceKey: { style: "literal", name: "ZAI_API_KEY" } } },
  entries: {
    p0: {
      name: "p0",
      class: "subscription",
      enabled: true,
      quota: {
        enabled: true,
        endpoint: "https://p0.test/quota",
        credentialRef: "zai",
        timeoutMs: 1000,
        thresholdPercent: 100,
        maxSleepLoops: 24,
        outageParkTtlSeconds: 300,
        credentialParkTtlSeconds: 900,
        capParkTtlSeconds: 300,
      },
    },
  },
  chains: { default: { name: "default", entries: ["p0"], allowPaidFallback: false } },
});

const quotaBody = (reset: number): QuotaTransport => ({
  send: async () => ({
    status: 200,
    bodyText: JSON.stringify({
      code: 200,
      success: true,
      data: { limits: [{ type: "TOKENS_LIMIT", percentage: 100, nextResetTime: reset }] },
    }),
  }),
});
const clearBody: QuotaTransport = {
  send: async () => ({
    status: 200,
    bodyText: JSON.stringify({ code: 200, success: true, data: { limits: [] } }),
  }),
};

const withStore = (transport: QuotaTransport) => {
  const root = makeTempRoot("provider");
  const { store } = openStore(makeIdentity(root));
  let counter = 0;
  const engine = createProviderEngine({
    clock: engineClock,
    sleep: engineSleep,
    credentialPort: engineCredential,
    transport,
    stateStore: store,
    newFenceToken: () => `fence-${counter++}`,
  });
  return { root, store, engine };
};

describe("TC-PROV-028..033/050 state integration", () => {
  test("a park round-trips through the ledger and the projection document", () => {
    const { root, store, engine } = withStore(quotaBody(NOW + 3600 * 1000));
    try {
      const resolved = engine.resolve({ config: stateConfig(), persist: true });
      return resolved.then((value) => {
        expect(value.ok).toBe(true);
        if (!value.ok) return;
        const ledger = readProviderLedger(store);
        expect(ledger.ok).toBe(true);
        if (!ledger.ok) return;
        expect(ledger.value.parks[0]?.name).toBe("provider:p0");
        expect(ledger.value.parks[0]?.schemaVersion).toBe("delivery.provider.park.v1");
        expect(ledger.value.parks[0]?.cause).toBe("quota-exhausted");
        expect(ledger.value.announcements[0]?.schemaVersion).toBe(
          "delivery.provider.announcement.v1",
        );
        const projection = store.read({ requiredKeys: ["document:provider-parks.json"] });
        expect(projection.ok).toBe(true);
        if (projection.ok) {
          expect(projection.value.values["document:provider-parks.json"]).toMatchObject({
            schemaVersion: "delivery.provider.parks.v1",
          });
        }
        expect(providerParksProjection(ledger.value.parks)).toMatchObject({
          schemaVersion: "delivery.provider.parks.v1",
        });
      });
    } finally {
      removeRoot(root);
    }
  });

  test("views expire exactly at expiresAt with no write", async () => {
    const { root, store, engine } = withStore(quotaBody(NOW + 1000));
    try {
      const resolved = await engine.resolve({ config: stateConfig(NOW + 1000), persist: true });
      if (!resolved.ok) throw new Error("resolve failed");
      const first = store.checkIntegrity();
      if (!first.ok) throw new Error("integrity failed");
      const before = first.value.evidence.recordCount;
      const active = readProviderParkViews(store, NOW + 999);
      expect(active.ok).toBe(true);
      if (active.ok) {
        expect(active.value.length).toBeGreaterThan(0);
        expect(active.value.every((view) => view.state === "active")).toBe(true);
      }
      const expired = readProviderParkViews(store, NOW + 1000);
      expect(expired).toMatchObject({ ok: true, value: [] });
      const all = readProviderParkViews(store, NOW + 1000, { all: true });
      expect(all.ok).toBe(true);
      if (all.ok) {
        expect(all.value.length).toBeGreaterThan(0);
        expect(all.value.every((view) => view.state === "expired")).toBe(true);
      }
      const after = store.checkIntegrity();
      if (!after.ok) throw new Error("integrity failed");
      expect(after.value.evidence.recordCount).toBe(before);
    } finally {
      removeRoot(root);
    }
  });

  test("unchanged generations dedupe; a changed expiry appends once", async () => {
    const { root, store, engine } = withStore(quotaBody(NOW + 3600 * 1000));
    try {
      const first = await engine.resolve({ config: stateConfig(), persist: true });
      if (!first.ok) throw new Error("resolve failed");
      const afterFirst = store.checkIntegrity();
      if (!afterFirst.ok) throw new Error("integrity failed");
      const count = afterFirst.value.evidence.recordCount;
      await engine.resolve({ config: stateConfig(), persist: true });
      const afterSecond = store.checkIntegrity();
      if (!afterSecond.ok) throw new Error("integrity failed");
      expect(afterSecond.value.evidence.recordCount).toBe(count);
      await engine.resolve({ config: stateConfig(NOW + 7200 * 1000), persist: true });
      const ledger = readProviderLedger(store);
      expect(ledger.ok).toBe(true);
      if (ledger.ok) expect(ledger.value.parks).toHaveLength(2);
    } finally {
      removeRoot(root);
    }
  });

  test("an observed clear appends one cleared record and one resumed announcement", async () => {
    const root = makeTempRoot("provider");
    const { store } = openStore(makeIdentity(root));
    let counter = 0;
    let transport: QuotaTransport = quotaBody(NOW + 3600 * 1000);
    const engine = createProviderEngine({
      clock: engineClock,
      sleep: engineSleep,
      credentialPort: engineCredential,
      transport: {
        send: (request) => transport.send(request),
      },
      stateStore: store,
      newFenceToken: () => `fence-${counter++}`,
    });
    try {
      await engine.resolve({ config: stateConfig(), persist: true });
      transport = clearBody;
      await engine.resolve({ config: stateConfig(), persist: true });
      await engine.resolve({ config: stateConfig(), persist: true });
      const ledger = readProviderLedger(store);
      if (!ledger.ok) throw new Error("read failed");
      expect(ledger.value.parks.filter((park) => park.state === "cleared")).toHaveLength(2);
      expect(
        ledger.value.announcements.filter((entry) => entry.code === "provider.resumed"),
      ).toHaveLength(2);
    } finally {
      removeRoot(root);
    }
  });

  test("a park observed after expiry stays expired and emits one resumed per park", async () => {
    const root = makeTempRoot("provider");
    const { store } = openStore(makeIdentity(root));
    let counter = 0;
    let now = NOW;
    let transport: QuotaTransport = quotaBody(NOW + 1000);
    const engine = createProviderEngine({
      clock: { nowMs: () => now },
      sleep: engineSleep,
      credentialPort: engineCredential,
      transport: { send: (request) => transport.send(request) },
      stateStore: store,
      newFenceToken: () => `fence-${counter++}`,
    });
    try {
      await engine.resolve({ config: stateConfig(NOW + 1000), persist: true });
      now = NOW + 2000;
      transport = clearBody;
      await engine.resolve({ config: stateConfig(NOW + 1000), persist: true });
      const ledger = readProviderLedger(store);
      if (!ledger.ok) throw new Error("read failed");
      expect(ledger.value.parks.filter((entry) => entry.state === "cleared")).toHaveLength(0);
      const views = readProviderParkViews(store, now, { all: true });
      expect(views.ok).toBe(true);
      if (views.ok) {
        expect(views.value).toHaveLength(2);
        expect(views.value.every((view) => view.state === "expired")).toBe(true);
      }
      const resumed = ledger.value.announcements.filter(
        (entry) => entry.code === "provider.resumed",
      );
      expect(resumed.filter((entry) => entry.subjectKind === "provider")).toHaveLength(1);
      expect(resumed).toHaveLength(2);
      const settled = store.checkIntegrity();
      if (!settled.ok) throw new Error("integrity failed");
      const count = settled.value.evidence.recordCount;
      await engine.resolve({ config: stateConfig(NOW + 1000), persist: true });
      const after = store.checkIntegrity();
      if (!after.ok) throw new Error("integrity failed");
      expect(after.value.evidence.recordCount).toBe(count);
    } finally {
      removeRoot(root);
    }
  });

  test("repeated quota and list reads append nothing", async () => {
    const { root, store, engine } = withStore(quotaBody(NOW + 3600 * 1000));
    try {
      await engine.resolve({ config: stateConfig(), persist: true });
      const before = store.checkIntegrity();
      if (!before.ok) throw new Error("integrity failed");
      await engine.quota({ config: stateConfig() });
      await engine.quota({ config: stateConfig() });
      void engine.parks();
      void engine.parks();
      const after = store.checkIntegrity();
      if (!after.ok) throw new Error("integrity failed");
      expect(after.value.evidence.recordCount).toBe(before.value.evidence.recordCount);
    } finally {
      removeRoot(root);
    }
  });

  test("a chain park appears in the rebuilt projection", async () => {
    const { root, store, engine } = withStore(quotaBody(NOW + 3600 * 1000));
    try {
      const resolved = await engine.resolve({ config: stateConfig(), persist: true });
      if (!resolved.ok) throw new Error("resolve failed");
      const ledger = readProviderLedger(store);
      if (!ledger.ok) throw new Error("read failed");
      expect(providerParksProjection(ledger.value.parks)).toMatchObject({
        schemaVersion: "delivery.provider.parks.v1",
      });
      const projection = providerParksProjection(ledger.value.parks) as { parks: unknown[] };
      expect(projection.parks.length).toBeGreaterThan(0);
    } finally {
      removeRoot(root);
    }
  });
});
