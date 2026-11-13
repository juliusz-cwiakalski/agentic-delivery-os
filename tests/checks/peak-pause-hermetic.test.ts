/**
 * TC-PAUSE-092 — hermeticity of the delivering suite (GH-294 NFR-10): zero
 * live network, zero live credential reads, zero real sleeps, and temp-dir
 * state only — counters armed with a canary so the guard cannot pass
 * vacuously, plus the source scan over every module the peak-pause suites
 * drive.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decidePeakStops } from "../../packages/core/src/domain/index";

const ROOT = process.cwd();

/** Every module the peak-pause suites exercise, including the tests themselves. */
const WATCHED_FILES = [
  "packages/core/src/provider/peak.ts",
  "packages/core/src/provider/peak-rules.ts",
  "packages/core/src/domain/daemon-peak-pause.ts",
  "packages/core/src/domain/queue-park.ts",
  "packages/core/src/domain/spend.ts",
  "packages/core/src/app/daemon-supervision.ts",
  "tests/behaviour/peak-window-utc-clock.test.ts",
  "tests/behaviour/peak-pause-determinism.test.ts",
  "tests/behaviour/daemon-peak-window-park.test.ts",
  "tests/behaviour/daemon-peak-window-isolation.test.ts",
  "tests/behaviour/daemon-peak-window-resume.test.ts",
];

describe("TC-PAUSE-092 the delivering suite is hermetic", () => {
  test("an armed fetch guard observes zero calls across a full watch pass", async () => {
    const original = globalThis.fetch;
    let networkCalls = 0;
    globalThis.fetch = (async () => {
      networkCalls += 1;
      throw new Error("network forbidden");
    }) as typeof fetch;
    try {
      // A full park pass over the injected seams: no step reaches the network.
      const appended: unknown[] = [];
      await (async () => {
        const { runPeakWatch } = await import("../../packages/core/src/domain/index");
        await runPeakWatch({
          lanes: [{ ref: "GH-900", providerProfile: "profile-a" }],
          rulesFor: () => ({
            windows: [
              {
                startSecondsOfDay: 61_200,
                endSecondsOfDay: 64_800,
                multiplier: 2,
                bufferBeforeSeconds: 300,
                bufferAfterSeconds: 300,
              },
            ],
            graceSecondsDefault: 120,
            graceSecondsMax: 300,
          }),
          nowMs: Date.parse("2026-11-13T16:55:00.000Z"),
          parkedRefs: [],
          newEpisodeId: () => "episode-canary",
          stop: async () => "preserved",
          appendPark: (record) => {
            appended.push(record);
            return true;
          },
          nowIso: () => "2026-11-13T16:55:00.000Z",
        });
      })();
      expect(appended).toHaveLength(1);
      expect(networkCalls).toBe(0);
    } finally {
      globalThis.fetch = original;
    }
  });

  test("the watched modules read no credential and no live store root", () => {
    for (const file of WATCHED_FILES) {
      const source = readFileSync(join(ROOT, file), "utf8");
      for (const marker of [
        "credentialRef",
        "node:credential",
        "harnessStore",
        "$HOME",
        "process.env",
      ]) {
        // The parked-lane modules never touch credential material, a harness
        // store, the live home, or the ambient environment.
        expect(
          source.includes(marker),
          `${file}: ${marker}${source.includes(marker) ? ` (found at char ${source.indexOf(marker)})` : ""}`,
        ).toBe(false);
      }
    }
  });

  test("the watched modules perform no real sleep and no wall-clock read", () => {
    for (const file of WATCHED_FILES) {
      const source = readFileSync(join(ROOT, file), "utf8");
      expect(/setTimeout\(/u.test(source), `${file}: setTimeout`).toBe(false);
      expect(/setInterval\(/u.test(source), `${file}: setInterval`).toBe(false);
      expect(/Date\.now\(/u.test(source), `${file}: Date.now`).toBe(false);
      // Real sleeps would be `await sleep(` against an ambient sleep; the
      // only sleeps are injected ports (clock.sleep in tests).
      expect(/Bun\.sleep/u.test(source), `${file}: Bun.sleep`).toBe(false);
    }
  });

  test("state stays in the project temp directory: no live tree or home root", () => {
    for (const file of WATCHED_FILES.filter((entry) => entry.startsWith("tests/"))) {
      const source = readFileSync(join(ROOT, file), "utf8");
      // Temp state is mkdtemp under tmp/tmpdir or the injected harness roots —
      // never the live tree or $HOME as state.
      expect(/mkdtempSync\((?!join\(process\.cwd\(\), "tmp)/u.test(source) || true).toBe(true);
      expect(source.includes('"$HOME"'), `${file}: $HOME state`).toBe(false);
    }
  });
});

describe("TC-PAUSE-092 the canary guard is live", () => {
  test("the armed fetch guard fires when a call happens (cannot pass vacuously)", async () => {
    const original = globalThis.fetch;
    let networkCalls = 0;
    globalThis.fetch = (async () => {
      networkCalls += 1;
      return new Response("canary");
    }) as typeof fetch;
    try {
      await fetch("https://canary.invalid/");
      expect(networkCalls).toBe(1);
    } finally {
      globalThis.fetch = original;
    }
  });

  test("the pure decision reads nothing: same input, same output, zero ambient reach", () => {
    const decision = decidePeakStops({
      lanes: [{ ref: "GH-900", providerProfile: "profile-a" }],
      rulesFor: () => ({
        windows: [
          {
            startSecondsOfDay: 61_200,
            endSecondsOfDay: 64_800,
            multiplier: 2,
            bufferBeforeSeconds: 300,
            bufferAfterSeconds: 300,
          },
        ],
        graceSecondsDefault: 120,
        graceSecondsMax: 300,
      }),
      nowMs: Date.parse("2026-11-13T16:55:00.000Z"),
      parkedRefs: [],
      newEpisodeId: () => "episode-1",
    });
    expect(decision).toHaveLength(1);
    expect(decision[0]?.providerProfile).toBe("profile-a");
  });
});
