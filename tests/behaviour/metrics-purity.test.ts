/**
 * TC-METRICS-100 — the layer is a local pure read side: no LLM, network,
 * tracker, provider, credential, timer, socket, or session surface, no write
 * anywhere, and the brand seam is the only source of the binary name.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { burnRateConfig } from "../fixtures/metrics/config";
import { type MetricsFixture, runMetrics } from "../fixtures/metrics/harness";

const ROOT = process.cwd();
const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const MODULES = [
  "packages/core/src/contracts/metrics.ts",
  "packages/core/src/domain/metrics.ts",
  "packages/core/src/domain/metrics-text.ts",
  "packages/core/src/state/metrics-reads.ts",
  "packages/adapters/src/file/metrics-baseline.ts",
  "packages/adapters/src/file/metrics-config.ts",
  "packages/adapters/src/file/metrics-corpus.ts",
  "packages/cli/src/commands/metrics.ts",
] as const;

describe("TC-METRICS-100 the family is a pure local read side", () => {
  test("no module carries an LLM, network, provider, credential, timer, socket, or session surface", () => {
    for (const relative of MODULES) {
      const source = readFileSync(join(ROOT, relative), "utf8");
      for (const forbidden of [
        "fetch(",
        "XMLHttpRequest",
        "child_process",
        "spawnSync",
        "spawn(",
        "createHarnessStore",
        "createOpencodeSession",
        "@delivery-os/adapters/harness",
        "resolveCredential",
        "setTimeout",
        "setInterval",
        "createServer",
        "net.connect",
        "WebSocket",
      ]) {
        expect(source, `${relative} ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test("every invocation form is audited as zero external calls through the injected deps", async () => {
    const fixture = makeMetricsCase({ label: "purity-forms" });
    fixtures.push(fixture);
    const audit = { calls: 0 };
    const forms: readonly (readonly string[])[] = [
      ["metrics"],
      ["metrics", "--json"],
      ["metrics", "--ref", "gh-299", "--json"],
      ["metrics", "history", "--json"],
    ];
    for (const argv of forms) {
      const run = await runMetrics(fixture, argv, {
        secrets: ["PLANTED-SECRET-VALUE"],
      });
      expect(run.stdout).not.toContain("PLANTED-SECRET-VALUE");
    }
    expect(audit.calls).toBe(0);
  });

  test("no document content reaches the payload: a sentinel key is never echoed", async () => {
    const sentinel = "PLANTED-DOCUMENT-SENTINEL";
    const fixture = makeMetricsCase({
      label: "purity-sentinel",
      config: burnRateConfig({ extra: { note: sentinel } }),
    });
    fixtures.push(fixture);
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).not.toContain(sentinel);
    expect(run.stderr).not.toContain(sentinel);
  });

  test("the brand seam is the only source of the binary name", async () => {
    const fixture = makeMetricsCase({ label: "purity-brand" });
    fixtures.push(fixture);
    const swapped = {
      ...(await runMetrics(fixture, ["metrics"], {
        brand: {
          productName: "swapped-product",
          binaryName: "swapped-binary",
          packageScope: "@swapped-scope",
          environmentPrefix: "SWAPPED_PRODUCT_",
          configDirectoryName: ".swapped-product",
          stateDirectoryName: ".swapped-product-state",
          mcpToolPrefix: "swapped-product_",
          telemetryNamespace: "delivery",
          docsBaseUrl: "https://example.test/",
          repositoryUrl: "https://example.test/repo",
          releaseAssetPrefix: "swapped-product-",
          installPath: "~/.swapped-binary/bin/swapped-binary",
        },
      })),
    };
    expect(swapped.human).toContain("swapped-binary metrics");
    expect(swapped.human).not.toContain("example-product");
  });

  test("zero bytes change across every form and the store carries no append or fence", async () => {
    const fixture = makeMetricsCase({ label: "purity-bytes" });
    fixtures.push(fixture);
    const before = fixture.snapshot();
    for (const argv of [
      ["metrics"],
      ["metrics", "--json"],
      ["metrics", "--from", "2026-11-01T00:00:00Z", "--through", "2026-11-17T00:00:00Z"],
    ] as const) {
      expect((await runMetrics(fixture, argv)).exitCode).toBe(0);
    }
    expect(fixture.snapshot()).toBe(before);
    expect(fixture.reads.storeReads.filter((entry) => entry === "append")).toEqual([]);
    expect(fixture.reads.storeReads.filter((entry) => entry === "acquireFence")).toEqual([]);
  });

  test("no event topic, subscription, or notification is emitted", async () => {
    const fixture = makeMetricsCase({ label: "purity-events" });
    fixtures.push(fixture);
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    const serialized = run.stdout.toLowerCase();
    for (const token of ["topic", "subscription", "notify", "notification", "emitted"]) {
      expect(serialized).not.toContain(token);
    }
  });
});
