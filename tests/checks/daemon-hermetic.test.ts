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
