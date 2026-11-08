import { describe, expect, test } from "bun:test";
import {
  resolveDaemonSettings,
  resolvePollSettings,
  resolveStateDirectoryScope,
} from "../../packages/core/src/config/index";
import {
  type ConfigCatalog,
  renderSystemdUnit,
  resolveConfig,
} from "../../packages/core/src/index";
import { fileFacts } from "../fixtures/config/facts";

const winners = {
  "x-test": {
    type: "object",
    fields: {
      nested: {
        type: "object",
        fields: {
          first: {
            type: "string",
            env: true,
            flag: "--first",
            default: "default-first",
            defaultOrigin: {
              layer: "defaults",
              file: "tests/fixtures/config/catalog.ts",
              line: 15,
            },
          },
          second: { type: "string" },
        },
      },
      list: { type: "array", items: { type: "number" }, env: true, flag: "--list" },
    },
  },
} as const satisfies ConfigCatalog;

describe("TC-CONFIG-001/002 real production resolver with typed catalog", () => {
  test("every one of seven layers wins, with recursive maps and replaced lists", () => {
    const fileLayers = ["system", "user-global", "project-committed", "project-local"] as const;
    const sources = fileLayers.map((layer, index) =>
      fileFacts(
        layer,
        {
          "x-test": {
            nested: { first: layer, ...(index === 0 ? { second: "survives" } : {}) },
            list: [index, index + 1],
          },
        },
        8 + index,
      ),
    );
    const first = resolveConfig({ catalog: winners });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.values).toEqual({ "x-test": { nested: { first: "default-first" } } });
    expect(first.value.origins["x-test.nested.first"]).toEqual({
      layer: "defaults",
      file: "tests/fixtures/config/catalog.ts",
      line: 15,
    });
    for (let count = 1; count <= fileLayers.length; count++) {
      const result = resolveConfig({ catalog: winners, sources: sources.slice(0, count) });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect((result.value.values["x-test"] as Record<string, unknown>).nested).toEqual({
        first: fileLayers[count - 1],
        second: "survives",
      });
      expect(result.value.origins["x-test.nested.first"]).toMatchObject({
        layer: fileLayers[count - 1],
        line: 7 + count,
      });
      expect(
        Object.keys(result.value.origins).filter((key) => key.startsWith("x-test.list[")),
      ).toHaveLength(2);
    }
    const environment = {
      FIXTURE_X_TEST__NESTED__FIRST: "environment",
      FIXTURE_X_TEST__LIST: "[44]",
    };
    const env = resolveConfig({
      catalog: winners,
      sources,
      environmentPrefix: "FIXTURE_",
      environment,
    });
    expect(env.ok).toBe(true);
    if (!env.ok) return;
    expect(env.value.origins["x-test.nested.first"]).toEqual({
      layer: "environment",
      env: "FIXTURE_X_TEST__NESTED__FIRST",
    });
    expect(env.value.origins["x-test.list[1]"]).toBeUndefined();
    const flags = { "--first": "cli", "--list": "[55,66,77]" };
    const cli = resolveConfig({
      catalog: winners,
      sources,
      environmentPrefix: "FIXTURE_",
      environment,
      flags,
    });
    expect(cli.ok).toBe(true);
    if (!cli.ok) return;
    expect((cli.value.values["x-test"] as Record<string, unknown>).list).toEqual([55, 66, 77]);
    expect(cli.value.origins["x-test.nested.first"]).toEqual({ layer: "cli", flag: "--first" });
    expect(cli.value.origins["x-test.list[0]"]).toEqual({ layer: "cli", flag: "--list" });
    expect(cli.value.origins["x-test.nested.second"]).toMatchObject({ layer: "system" });
    expect(cli.value.loadedFiles.map((item) => item.layer)).toEqual(fileLayers);
    expect(
      resolveConfig({
        catalog: winners,
        sources,
        environmentPrefix: "FIXTURE_",
        environment,
        flags,
      }),
    ).toEqual(cli);
  });

  test("reset removes inherited values and all descendant origins before setting", () => {
    const lower = fileFacts(
      "system",
      { "x-test": { nested: { first: "lower", second: "old" }, list: [1, 2] } },
      4,
    );
    const higher = fileFacts(
      "project-local",
      { "x-test": { nested: { first: "higher" }, list: [3] } },
      10,
      ["x-test.nested", "x-test.list"],
    );
    const resolved = resolveConfig({ catalog: winners, sources: [higher, lower] });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.values).toEqual({ "x-test": { nested: { first: "higher" }, list: [3] } });
    expect(resolved.value.origins["x-test.nested.second"]).toBeUndefined();
    expect(resolved.value.origins["x-test.list[1]"]).toBeUndefined();
    for (const reset of [
      ["x-test.nope"],
      ["x-test.nested.third"],
      ["not-there"],
      ["x-test..nested"],
    ]) {
      const failed = resolveConfig({
        catalog: winners,
        sources: [lower, fileFacts("project-local", {}, 10, reset)],
      });
      expect(failed.ok).toBe(false);
      if (!failed.ok) expect(failed.error.code).toBe("config.reset.invalid");
    }
  });
});

describe("TC-PROV-003 provider provenance through the layered resolver", () => {
  test("shipped provider defaults carry a defaults-layer origin and layer overrides win", () => {
    const resolved = resolveConfig({
      sources: [fileFacts("system", { provider: { defaultChain: "default" } }, 4)],
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.origins["provider.entries.zai-coding-plan.peak.timezone"]?.layer).toBe(
        "defaults",
      );
      expect(resolved.value.origins["provider.defaultChain"]?.layer).toBe("system");
    }
  });
});

describe("GH-238 daemon and poll branches", () => {
  test("an absent daemon branch resolves the Appendix E defaults", () => {
    const resolved = resolveDaemonSettings({}, {}, { stateDirectory: "/var/lib/ados" });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.heartbeatIntervalMs).toBe(5000);
      expect(resolved.value.lockStalenessMs).toBe(30000);
      expect(resolved.value.transport).toBe("unix");
      expect(resolved.value.socketPath).toBe("/var/lib/ados/daemon.sock");
    }
  });

  test("declared-not-delivered transports and outside socket paths are refused", () => {
    const transport = resolveDaemonSettings(
      { daemon: { transport: "tcp" } },
      {},
      { stateDirectory: "/var/lib/ados" },
    );
    expect(transport.ok).toBe(false);
    if (!transport.ok) expect(transport.error.code).toBe("config.value.invalid");
    const outside = resolveDaemonSettings(
      { daemon: { "socket-path": "/tmp/elsewhere.sock" } },
      {},
      { stateDirectory: "/var/lib/ados" },
    );
    expect(outside.ok).toBe(false);
    if (!outside.ok) expect(outside.error.code).toBe("config.value.invalid");
    const invalid = resolveDaemonSettings(
      { daemon: { "heartbeat-interval": 0 } },
      {},
      { stateDirectory: "/var/lib/ados" },
    );
    expect(invalid.ok).toBe(false);
  });

  test("poll settings validate the closed platform set and integer domains", () => {
    const ok = resolvePollSettings({
      poll: { github: { "base-interval": 1000, "max-interval": 5000, "min-spacing": 500 } },
    });
    expect(ok.ok).toBe(true);
    const unknown = resolvePollSettings({ poll: { azure: {} } });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe("config.key.unknown");
  });

  test("state-directory scope precedence is exact and absolute-only", () => {
    // The production brand prefix ends in one underscore ("ADOS_"); the resolver
    // must read exactly one separator, never ADOS__STATE_DIR.
    const explicit = resolveStateDirectoryScope({
      environment: { ADOS_STATE_DIR: "/srv/one" },
      environmentPrefix: "ADOS_",
      stateDirectoryName: "ados",
      homeDirectory: "/srv/me",
    });
    expect(explicit).toEqual({ ok: true, value: "/srv/one" });
    const fallback = resolveStateDirectoryScope({
      environment: {},
      environmentPrefix: "ADOS_",
      stateDirectoryName: "ados",
      homeDirectory: "/srv/me",
    });
    expect(fallback).toEqual({ ok: true, value: "/srv/me/ados" });
    const invalid = resolveStateDirectoryScope({
      environment: { ADOS_STATE_DIR: "relative/path" },
      environmentPrefix: "ADOS_",
      stateDirectoryName: "ados",
      homeDirectory: "/srv/me",
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.code).toBe("config.value.invalid");
    // A double separator is not a second scope: the wrong spelling is ignored.
    const wrong = resolveStateDirectoryScope({
      environment: { ADOS__STATE_DIR: "/srv/two" },
      environmentPrefix: "ADOS_",
      stateDirectoryName: "ados",
      homeDirectory: "/srv/me",
    });
    expect(wrong).toEqual({ ok: true, value: "/srv/me/ados" });
  });

  test("the installed unit's Environment= name reads back through the resolver", () => {
    const unit = renderSystemdUnit({
      binary: "ados",
      stateDirectory: "/srv/one",
      environmentName: "ADOS_STATE_DIR",
      unit: "ados.service",
    });
    const binding = /^Environment=([^=]+)=(.+)$/mu.exec(unit);
    expect(binding).not.toBeNull();
    const name = binding?.[1] ?? "";
    const value = binding?.[2] ?? "";
    expect(name).toBe("ADOS_STATE_DIR");
    // Round-trip: the exact name the unit writes is the name the resolver reads.
    expect(
      resolveStateDirectoryScope({
        environment: { [name]: value },
        environmentPrefix: "ADOS_",
        stateDirectoryName: "ados",
        homeDirectory: "/srv/me",
      }),
    ).toEqual({ ok: true, value: "/srv/one" });
    // Two scopes select two paths; a third spelling selects neither.
    const one = resolveStateDirectoryScope({
      environment: { ADOS_STATE_DIR: "/srv/one" },
      environmentPrefix: "ADOS_",
      stateDirectoryName: "ados",
      homeDirectory: "/srv/me",
    });
    const two = resolveStateDirectoryScope({
      environment: { ADOS_STATE_DIR: "/srv/two" },
      environmentPrefix: "ADOS_",
      stateDirectoryName: "ados",
      homeDirectory: "/srv/me",
    });
    expect(one).toEqual({ ok: true, value: "/srv/one" });
    expect(two).toEqual({ ok: true, value: "/srv/two" });
    expect(one).not.toEqual(two);
  });
});
