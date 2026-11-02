/**
 * TC-VGATES-069 — the new pure domain symbols import from the @delivery-os/core
 * package root, no new subpath exists, and the combined verify runtime dispatches
 * both subcommands through one definition.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  EvaluateVerifyChange,
  evaluateVerifyGates,
  isFullHexSha,
  renderVerifyGatesFailureSummary,
  renderVerifyGatesHuman,
  resolveOpenPr,
} from "@delivery-os/core";
import { createVerifyCommandDefinition } from "../../packages/cli/src/commands/verify";
import type { VerifyGatesCommandRuntime } from "../../packages/cli/src/commands/verify-gates";
import { baseFacts } from "../fixtures/verify-gates/cases/facts";

const ROOT = process.cwd();

const gatesRuntime = (): VerifyGatesCommandRuntime => {
  const facts = baseFacts();
  const pmNotes = parse(
    readFileSync(
      join(ROOT, "tests/fixtures/verify/classification/full/base-complete.yaml"),
      "utf8",
    ),
  ) as unknown;
  return {
    readLifecycle: () => ({
      document: { ok: true, file: "fixture", text: "", value: pmNotes },
      registry: {
        ok: true,
        present: facts.lifecycle.evaluation.registry.present,
        verifiedEmpty: facts.lifecycle.evaluation.registry.verifiedEmpty,
        transitions: [],
        recordCount: facts.lifecycle.evaluation.registry.recordCount,
      },
    }),
    readRepository: () => facts.repository,
    readWorkflow: () => facts.workflow,
    readOpenPullRequests: async () => facts.openPullRequests,
    readDeliveryRequestDetail: async () => facts.deliveryRequestDetail,
    readCheckRuns: async () => facts.checkRuns,
    readWorkItem: async () => facts.workItem,
  };
};

describe("TC-VGATES-069 package-root exports and combined runtime", () => {
  test("every pure symbol is importable and callable from the package root", () => {
    expect(typeof EvaluateVerifyChange).toBe("function");
    expect(typeof evaluateVerifyGates).toBe("function");
    expect(typeof resolveOpenPr).toBe("function");
    expect(typeof renderVerifyGatesFailureSummary).toBe("function");
    expect(typeof renderVerifyGatesHuman).toBe("function");
    expect(typeof isFullHexSha).toBe("function");
    expect(isFullHexSha("1".repeat(40))).toBe(true);
    expect(isFullHexSha("abc")).toBe(false);
  });

  test("no new core subpath exists", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "packages/core/package.json"), "utf8")) as {
      exports: Record<string, unknown>;
    };
    expect(Object.keys(manifest.exports).sort()).toEqual(
      [".", "./branding", "./contracts", "./provider", "./state"].sort(),
    );
  });

  test("one verify definition dispatches change and gates through the combined runtime", async () => {
    const runtime = {
      readPmNotes: () => ({ ok: false as const, reason: "missing" as const }),
      readRegistry: () => ({
        ok: true as const,
        present: false,
        verifiedEmpty: true,
        transitions: [],
        recordCount: 0,
      }),
      gates: gatesRuntime(),
    };
    const definition = createVerifyCommandDefinition(runtime);
    const gates = await definition.handler({
      command: "verify",
      flags: {},
      argv: ["verify", "gates", "GH-178"],
      positionals: ["gates", "GH-178"],
      brand: {
        productName: "example-product",
        binaryName: "example-product",
        packageScope: "@example",
        environmentPrefix: "EXAMPLE_",
        configDirectoryName: ".example",
        stateDirectoryName: ".example-state",
        mcpToolPrefix: "example_",
        telemetryNamespace: "delivery",
        docsBaseUrl: "https://example.invalid",
        repositoryUrl: "https://example.invalid",
        releaseAssetPrefix: "example-",
        installPath: "~/.example/bin/example",
      },
    });
    expect("data" in (gates as object)).toBe(true);
    const change = (await definition.handler({
      command: "verify",
      flags: {},
      argv: ["verify", "change", "GH-178"],
      positionals: ["change", "GH-178"],
      brand: {
        productName: "example-product",
        binaryName: "example-product",
        packageScope: "@example",
        environmentPrefix: "EXAMPLE_",
        configDirectoryName: ".example",
        stateDirectoryName: ".example-state",
        mcpToolPrefix: "example_",
        telemetryNamespace: "delivery",
        docsBaseUrl: "https://example.invalid",
        repositoryUrl: "https://example.invalid",
        releaseAssetPrefix: "example-",
        installPath: "~/.example/bin/example",
      },
    })) as { error?: { code?: string } };
    expect(change.error?.code).toBe("lint.target.missing");
  });

  test("negative control: a runtime missing gates rejects the gates subcommand", () => {
    const definition = createVerifyCommandDefinition({
      readPmNotes: () => ({ ok: false, reason: "missing" }),
      readRegistry: () => ({
        ok: true,
        present: false,
        verifiedEmpty: true,
        transitions: [],
        recordCount: 0,
      }),
    });
    const result = definition.handler({
      command: "verify",
      flags: {},
      argv: ["verify", "gates", "GH-178"],
      positionals: ["gates", "GH-178"],
      brand: {} as never,
    }) as { error?: { code?: string } };
    expect(result.error?.code).toBe("input.value.rejected");
  });
});
