/**
 * GH-350 TC-WFRESH-004 and TC-WFRESH-008 (structural arms) — `watch-stale` is a
 * member of the closed watch condition set and of no other closed set, the
 * freshness bound is the only `maxAgeSeconds`-shaped key in the catalog, the
 * watch producer adds no cache, timer, refresher, scheduler, or store, and the
 * provider family gains no member.
 *
 * Every scanner ships its own planted control, so a scan that never fires fails
 * rather than passes.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CatalogField } from "../../packages/core/src/config/catalog";
import { PRODUCTION_CATALOG } from "../../packages/core/src/config/catalog";
import {
  ANNOUNCEMENT_CODES,
  PARK_CAUSES,
  PROVIDER_CONDITION_KINDS,
  PROVIDER_RECORD_KINDS,
  PROVIDER_SKIP_REASONS,
  PROVIDER_WATCH_CONDITIONS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const QUOTA = "packages/core/src/provider/quota.ts";
const COMMANDS = "packages/cli/src/commands/provider.ts";

const sourceOf = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

/** Every catalog path whose name is `maxAgeSeconds`, records included. */
export const maxAgeSecondsPaths = (catalog: typeof PRODUCTION_CATALOG): string[] => {
  const paths: string[] = [];
  const walk = (field: CatalogField, path: string): void => {
    if (path.endsWith(".maxAgeSeconds") || path.endsWith("<name>.maxAgeSeconds")) {
      paths.push(path);
    }
    if (field.type === "object") {
      for (const [name, child] of Object.entries(field.fields)) walk(child, `${path}.${name}`);
    }
    if (field.type === "record") walk(field.value, `${path}.<name>`);
    if (field.type === "array") walk(field.items, `${path}[]`);
  };
  const provider = catalog.provider;
  if (provider.type === "object") walk(provider, "provider");
  return paths.sort();
};

/** Runtime capabilities a read-only freshness evaluation must never reach. */
export const forbiddenWatchTokens = (text: string): string[] =>
  [
    "setTimeout(",
    "setInterval(",
    "setImmediate(",
    "readFile",
    "writeFile",
    "node:",
    "fetch(",
    "new Map(",
  ].filter((token) => text.includes(token));

/** The provider family's declared subcommands, read from its grammar. */
export const providerSubcommands = (text: string): string[] =>
  [...text.matchAll(/subcommand === "([a-z-]+)"/gu)].map((match) => match[1] as string).sort();

describe("TC-WFRESH-004 watch-stale is watch-only in the closed sets", () => {
  test("the watch set holds six values including watch-stale; the other four sets exclude it", () => {
    expect([...PROVIDER_WATCH_CONDITIONS]).toEqual([
      "clear",
      "quota-exhausted",
      "watch-stale",
      "provider-outage",
      "credential-missing",
      "credential-rejected",
    ]);
    for (const [label, set] of [
      ["condition kinds", PROVIDER_CONDITION_KINDS],
      ["park causes", PARK_CAUSES],
      ["skip reasons", PROVIDER_SKIP_REASONS],
      ["announcement codes", ANNOUNCEMENT_CODES],
      ["record kinds", PROVIDER_RECORD_KINDS],
    ] as const) {
      expect(set as readonly string[], label).not.toContain("watch-stale");
    }
    expect([...PROVIDER_RECORD_KINDS]).toEqual(["provider.park", "provider.announcement"]);
  });

  test("a stale reading produces no announcement and no park", async () => {
    const { createProviderWatchStatus } = await import("../../packages/core/src/provider/quota");
    const { createProviderWatchMappings } = await import(
      "../../packages/adapters/src/provider-quota/index"
    );
    const reader = createProviderWatchStatus({
      clock: { nowMs: () => 1_700_000_000_000 },
      credentialPort: { resolve: () => ({ ok: true, material: { value: "" } }) },
      transport: {
        send: async () => ({
          status: 200,
          bodyText: JSON.stringify({ code: 200, success: true, data: { limits: [] } }),
        }),
      },
      mappings: createProviderWatchMappings(),
    });
    const result = await reader.status({
      targets: {
        p: {
          mapping: "coding-plan-windows",
          endpoint: "https://watch.example/quota",
          credentialRef: "c",
          maxAgeSeconds: 900,
        },
      },
      credentials: { c: { sourceKey: { style: "literal", name: "WATCH_KEY" } } },
      observedAtMs: 1_700_000_000_000 - 1_200_000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("announcement");
    expect(serialized).not.toContain("park");
  });
});

describe("TC-WFRESH-008 the watch path adds no cache, timer, refresher, scheduler or key", () => {
  test("the freshness bound is the only maxAgeSeconds-shaped catalog key", () => {
    expect(maxAgeSecondsPaths(PRODUCTION_CATALOG)).toEqual([
      "provider.profiles.watch.<name>.maxAgeSeconds",
    ]);
  });

  test("the watch producer reaches no runtime capability and accepts no store", () => {
    const source = sourceOf(QUOTA);
    expect(forbiddenWatchTokens(source)).toEqual([]);
    const runtimeBlock = source.slice(
      source.indexOf("export type ProviderWatchStatusRuntime"),
      source.indexOf("export type ProviderWatchStatusInput"),
    );
    expect(runtimeBlock).toContain("clock");
    expect(runtimeBlock).toContain("credentialPort");
    expect(runtimeBlock).toContain("transport");
    expect(runtimeBlock).toContain("mappings");
    expect(runtimeBlock).not.toContain("stateStore");
    expect(runtimeBlock).not.toContain("store");
  });

  test("the provider family keeps exactly its declared subcommands", () => {
    expect(providerSubcommands(sourceOf(COMMANDS))).toEqual([
      "migrate",
      "parks",
      "profile",
      "quota",
      "resolve",
      "simulate",
      "watch",
    ]);
  });

  test("the scanners are non-vacuous: planted capabilities, a planted key and a planted member fire", () => {
    expect(forbiddenWatchTokens("const t = setTimeout(run, 1);\n")).toEqual(["setTimeout("]);
    expect(forbiddenWatchTokens("readFileSync(path);\n")).toEqual(["readFile"]);
    const planted = {
      provider: {
        type: "object",
        fields: {
          profiles: {
            type: "object",
            fields: {
              watch: {
                type: "record",
                value: {
                  type: "object",
                  fields: { maxAgeSeconds: { type: "number" } },
                },
              },
            },
          },
          cache: {
            type: "object",
            fields: { maxAgeSeconds: { type: "number" } },
          },
        },
      },
    } as unknown as typeof PRODUCTION_CATALOG;
    expect(maxAgeSecondsPaths(planted)).toEqual([
      "provider.cache.maxAgeSeconds",
      "provider.profiles.watch.<name>.maxAgeSeconds",
    ]);
    expect(
      providerSubcommands('if (subcommand === "watch") {}\nif (subcommand === "cache") {}\n'),
    ).toEqual(["cache", "watch"]);
  });
});
