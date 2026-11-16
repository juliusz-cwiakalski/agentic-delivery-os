/**
 * TC-STEER-001/002/003 — bare filing draws every default and derives the origin
 * block, an unbound checkout records the declared bare null, and explicit flags
 * override every default with an `expiresAt` derived from the stored record.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { SteerMessageRecord } from "../../packages/core/src/contracts/index";
import { readSteeringQueue } from "../../packages/core/src/state/index";
import {
  createProductionProjectsHarness,
  makeBaseDirectory,
  removeDirectoryTree,
} from "../fixtures/projects/production";
import { createRepository } from "../fixtures/projects/temp-repos";
import { CREATED, TTL_24H } from "../fixtures/steer/cases";
import {
  BOUND_ORIGIN,
  createSteerHarness,
  FIXED_NOW_ISO,
  FIXED_NOW_MS,
  UNBOUND_ORIGIN,
} from "../fixtures/steer/harness";

const RECORD_KEYS = [
  "created",
  "from",
  "id",
  "kind",
  "origin",
  "priority",
  "ref",
  "scope",
  "subject",
  "to",
  "ttl",
] as const;

type SendData = {
  readonly schemaVersion: string;
  readonly record: Record<string, unknown>;
  readonly lifecycle: string;
};

const sendData = (data: Record<string, unknown> | undefined): SendData =>
  data as unknown as SendData;

const storedMessage = (harness: ReturnType<typeof createSteerHarness>): SteerMessageRecord => {
  const messages = harness.read().messages;
  expect(messages).toHaveLength(1);
  const message = messages[0];
  if (message === undefined) throw new Error("no message was appended");
  return message;
};

describe("TC-STEER-001 bare filing draws every default and derives the origin", () => {
  test("one complete record with the drawn defaults, the derived origin, and a queued projection", async () => {
    const harness = createSteerHarness();
    try {
      const run = await harness.run(["send", "prefer smaller diffs; split the refactor"]);
      expect(run.exitCode).toBe(0);
      expect(run.envelope?.schemaVersion).toBe("delivery.result.v1");
      expect(run.envelope?.exitCode).toBe(0);
      const data = sendData(run.data);
      expect(data.schemaVersion).toBe("delivery.steer.v1");
      expect(data.lifecycle).toBe("queued");
      expect(data.record.expiresAt).toBe("2026-11-17T12:00:00.000Z");
      expect(data.record.age).toBe(0);

      const message = storedMessage(harness);
      expect(Object.keys(message).sort()).toEqual([...RECORD_KEYS].sort());
      expect(message).toMatchObject({
        from: "owner",
        to: "delivery",
        scope: "repo",
        kind: "request",
        priority: "normal",
        ref: null,
        subject: "prefer smaller diffs; split the refactor",
        created: FIXED_NOW_ISO,
        ttl: TTL_24H,
      });
      expect(message.origin).toEqual(BOUND_ORIGIN);
      expect(message.id.startsWith("msg-")).toBe(true);
      expect(harness.read().outcomes).toEqual([]);
      expect(harness.read().completions).toEqual([]);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-002 an unbound checkout records the bare null origin change", () => {
  test("the derived absence is recorded as `null`, never a reason field, and the bound twin derives", async () => {
    const unbound = createSteerHarness({ origin: UNBOUND_ORIGIN });
    try {
      const run = await unbound.run(["send", "note from outside a bound change"]);
      expect(run.exitCode).toBe(0);
      expect(sendData(run.data).lifecycle).toBe("queued");
      const message = storedMessage(unbound);
      expect(message.origin.change).toBeNull();
      expect(message.origin.repo).toBe("example/product");
      expect(message.origin.agent).toBe("owner");
      expect(Object.hasOwn(message.origin, "change")).toBe(true);
      expect(Object.hasOwn(message.origin, "changeUnknownReason")).toBe(false);
    } finally {
      unbound.cleanup();
    }

    const bound = createSteerHarness({ origin: BOUND_ORIGIN });
    try {
      await bound.run(["send", "note from a bound change"]);
      expect(storedMessage(bound).origin.change).toBe("GH-298");
    } finally {
      bound.cleanup();
    }
  });
});

describe("TC-STEER-003 explicit flags override the drawn defaults", () => {
  test("--kind and --priority land verbatim while the omitted fields still draw", async () => {
    const harness = createSteerHarness();
    try {
      const run = await harness.run([
        "send",
        "escalated note",
        "--kind",
        "escalate",
        "--priority",
        "urgent",
      ]);
      expect(run.exitCode).toBe(0);
      const message = storedMessage(harness);
      expect(message.kind).toBe("escalate");
      expect(message.priority).toBe("urgent");
      expect(message.ttl).toBe(TTL_24H);
      expect(message.ref).toBeNull();
    } finally {
      harness.cleanup();
    }
  });

  test("every declared ttl unit lands and expiresAt is derived from created + ttl", async () => {
    const cells = [
      ["90s", 90_000],
      ["90m", 5_400_000],
      ["24h", 86_400_000],
      ["14d", 1_209_600_000],
    ] as const;
    for (const [spelling, ms] of cells) {
      const harness = createSteerHarness();
      try {
        const run = await harness.run(["send", "ttl cell", "--ttl", spelling]);
        expect(run.exitCode, spelling).toBe(0);
        const message = storedMessage(harness);
        expect(message.ttl, spelling).toBe(ms);
        expect(dataOf(run).record.expiresAt).toBe(new Date(Date.parse(CREATED) + ms).toISOString());
        // Advancing the harness clock after filing never moves the stored answer
        // relation: expiresAt is derived from the stored record, not re-read.
        harness.now.ms += 3_600_000;
        harness.now.iso = new Date(harness.now.ms).toISOString();
        const listed = await harness.run(["list"]);
        const queued = listed.data?.queued;
        if (!Array.isArray(queued)) throw new Error("the list answer carries no queued group");
        const row = queued[0] as Record<string, unknown> | undefined;
        expect(row?.expiresAt).toBe(new Date(Date.parse(CREATED) + ms).toISOString());
      } finally {
        harness.cleanup();
      }
    }
  });

  test("the 30d maximum and a 160-character ref land verbatim", async () => {
    const harness = createSteerHarness();
    try {
      const run = await harness.run([
        "send",
        "bounded note",
        "--ttl",
        "30d",
        "--ref",
        "x".repeat(160),
      ]);
      expect(run.exitCode).toBe(0);
      const message = storedMessage(harness);
      expect(message.ttl).toBe(2_592_000_000);
      expect(message.ref).toBe("x".repeat(160));
    } finally {
      harness.cleanup();
    }
  });

  test("all four flags together keep the derived identity fields unchanged", async () => {
    const harness = createSteerHarness();
    try {
      const run = await harness.run([
        "send",
        "all flags",
        "--kind",
        "escalate",
        "--priority",
        "urgent",
        "--ttl",
        "720h",
        "--ref",
        "doc/proof.md",
      ]);
      expect(run.exitCode).toBe(0);
      const message = storedMessage(harness);
      expect(message).toMatchObject({
        from: "owner",
        to: "delivery",
        scope: "repo",
        kind: "escalate",
        priority: "urgent",
        ref: "doc/proof.md",
        ttl: 2_592_000_000,
      });
      expect(message.origin).toEqual(BOUND_ORIGIN);
    } finally {
      harness.cleanup();
    }
  });

  test("the age is measured from the injected clock", async () => {
    const harness = createSteerHarness();
    try {
      harness.now.ms = FIXED_NOW_MS + 90_000;
      harness.now.iso = new Date(harness.now.ms).toISOString();
      const run = await harness.run(["send", "aged note"]);
      expect(dataOf(run).record.age).toBe(0);
      const listed = await harness.run(["list"]);
      const queued = listed.data?.queued;
      if (!Array.isArray(queued)) throw new Error("the list answer carries no queued group");
      const row = queued[0] as Record<string, unknown> | undefined;
      expect(row?.age).toBe(0);
    } finally {
      harness.cleanup();
    }
  });
});

const dataOf = (run: { readonly data?: Record<string, unknown> }): SendData =>
  run.data as unknown as SendData;

const writePmContext = (checkout: string, workItemRef: string): void => {
  mkdirSync(join(checkout, ".ai/local"), { recursive: true });
  writeFileSync(
    join(checkout, ".ai/local/pm-context.yaml"),
    `active_change:\n  workItemRef: ${workItemRef}\n  branch: feat/${workItemRef}/steer\n  change_folder: doc/changes/x\nparked_changes: []\n`,
  );
};

describe("TC-STEER-001/002 origin derivation over a real checkout", () => {
  test("a bound checkout records the bound ref, the checkout-derived repo key, and owner", async () => {
    const base = makeBaseDirectory("steer-origin");
    const checkout = createRepository(base, "bound-checkout");
    writePmContext(checkout, "GH-298");
    const harness = createProductionProjectsHarness({
      label: "steer-origin-bound",
      workingDirectory: checkout,
    });
    try {
      const run = await harness.run(["steer", "send", "derived origin note", "--json"]);
      expect(run.exitCode).toBe(0);
      const read = readSteeringQueue(harness.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const message = read.value.messages[0];
      expect(message?.origin.change).toBe("GH-298");
      expect(message?.origin.repo).toBe(basename(checkout).toLowerCase());
      expect(message?.origin.agent).toBe("owner");
    } finally {
      harness.dispose();
      removeDirectoryTree(base);
    }
  });

  test("an unbound checkout records the bare null change and still files", async () => {
    const base = makeBaseDirectory("steer-origin");
    const checkout = createRepository(base, "unbound-checkout");
    const harness = createProductionProjectsHarness({
      label: "steer-origin-unbound",
      workingDirectory: checkout,
    });
    try {
      const run = await harness.run(["steer", "send", "unbound origin note", "--json"]);
      expect(run.exitCode).toBe(0);
      const read = readSteeringQueue(harness.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const message = read.value.messages[0];
      expect(message?.origin.change).toBeNull();
      expect(message?.origin.repo).toBe("unbound-checkout");
      expect(message?.origin.agent).toBe("owner");
    } finally {
      harness.dispose();
      removeDirectoryTree(base);
    }
  });

  test("the production composition answers steer list over the fixture store", async () => {
    const base = makeBaseDirectory("steer-origin");
    const checkout = createRepository(base, "list-checkout");
    writePmContext(checkout, "GH-298");
    const harness = createProductionProjectsHarness({
      label: "steer-origin-list",
      workingDirectory: checkout,
    });
    try {
      const list = await harness.run(["steer", "list", "--json"]);
      expect(list.exitCode).toBe(0);
      const data = list.envelope?.data as Record<string, unknown> | undefined;
      expect(data?.schemaVersion).toBe("delivery.steer.v1");
      expect(Array.isArray(data?.queued)).toBe(true);
    } finally {
      harness.dispose();
      removeDirectoryTree(base);
    }
  });
});
