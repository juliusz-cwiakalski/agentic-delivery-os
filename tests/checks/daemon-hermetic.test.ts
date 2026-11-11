/**
 * TC-HERMETIC-001 (wire half) — the protocol suites perform no network access,
 * read no credential, and use no unbounded sleep.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decodeControlLine,
  encodeControlFrame,
} from "../../packages/core/src/domain/control-codec";
import { createControlSession } from "../../packages/core/src/domain/control-session";
import {
  CONTROL_PROTOCOL_CURRENT,
  LOCAL_CALLER_PRINCIPAL,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const PROTOCOL_FILES = [
  "packages/core/src/domain/control-codec.ts",
  "packages/core/src/domain/control-session.ts",
  "packages/core/src/app/control-server.ts",
];

const clock = () => ({
  nowMs: () => 0,
  nowIso: () => new Date(0).toISOString(),
  sleep: async () => undefined,
});

describe("GH-238 protocol hermeticity", () => {
  test("an armed fetch guard observes zero calls", () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      throw new Error("network forbidden");
    }) as typeof fetch;
    try {
      const line = encodeControlFrame({
        v: CONTROL_PROTOCOL_CURRENT,
        kind: "request",
        type: "poke",
        id: "a",
        payload: { cursor: 0 },
        callerPrincipal: LOCAL_CALLER_PRINCIPAL,
      });
      const decoded = decodeControlLine(line.slice(0, -1));
      expect(decoded.ok).toBe(true);
      const session = createControlSession({
        connectionId: "c1",
        clock: clock(),
        subscriptionBuffer: 2,
        responseTimeoutMs: 10,
      });
      if (decoded.ok) session.receive(decoded.frame);
      expect(calls).toBe(0);
    } finally {
      globalThis.fetch = original;
    }
  });

  test("the protocol modules import no socket, filesystem, process, or network API", () => {
    for (const file of PROTOCOL_FILES) {
      const source = readFileSync(join(ROOT, file), "utf8");
      for (const marker of [
        "node:net",
        "node:fs",
        "node:http",
        "node:child_process",
        "fetch(",
        "process.env",
      ]) {
        expect(source.includes(marker), `${file}: ${marker}`).toBe(false);
      }
      expect(/setTimeout\(/.test(source)).toBe(false);
      expect(/setInterval\(/.test(source)).toBe(false);
    }
  });
});

/**
 * GH-286 additive half — the composition and the degradation resolver stay
 * hermetic: the production composer reads no ambient environment beyond the
 * injected record, and the resolver performs no socket connect, no process
 * probe, and no sleep.
 */
describe("GH-286 composition and resolver hermeticity", () => {
  const COMPOSITION_FILES = [
    "packages/cli/src/production.ts",
    "packages/cli/src/daemon-compose.ts",
  ];

  test("the composition reads no ambient environment and opens no socket of its own accord", () => {
    for (const file of COMPOSITION_FILES) {
      const source = readFileSync(join(ROOT, file), "utf8");
      // The composer never reads `process.env`: every value arrives as a fact.
      // A usable read is `process.env.NAME` or `process.env[`; the phrase in a
      // comment is documentation, not a read.
      expect(/process\.env[.[]/u.test(source), `${file}: process.env read`).toBe(false);
      // No network module is reached from the daemon mount path (the delivered
      // GitHub client transport is unchanged and out of scope here).
      expect(source.includes("node:http"), `${file}: node:http`).toBe(false);
      expect(source.includes("node:https"), `${file}: node:https`).toBe(false);
    }
  });

  test("the degradation resolver connects nothing, probes nothing, and never sleeps", () => {
    const source = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    const start = source.indexOf("const daemonReachability");
    const end = source.indexOf("const queueComposition");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const resolver = source.slice(start, end);
    for (const marker of ["connect(", "isAlive", "sleep(", "transport."]) {
      expect(resolver.includes(marker), `resolver: ${marker}`).toBe(false);
    }
    // It reads exactly the two durable facts the rule names.
    expect(resolver.includes("readDaemonInstance")).toBe(true);
    expect(resolver.includes("readDaemonHeartbeat")).toBe(true);
  });
});
