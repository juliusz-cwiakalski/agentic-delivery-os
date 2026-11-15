/**
 * TC-SCITE-005 — the shipped MCP `gate-report` composition supplies the
 * single-document map read, so the mirror refuses a narrowed declaration exactly
 * as the CLI does, and an undeclared or equality map leaves the delivered tool
 * outcome unchanged.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import type { GateReportToolRuntime } from "../../packages/mcp/src/commands/gate-report";
import { createToolset } from "../../packages/mcp/src/index";
import { composeServeSurface } from "../../packages/mcp/src/serve";
import { REFERENCE_JOB, REFERENCE_SUITES } from "../fixtures/verify-gates/suite-map/cases";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const CONFIG_DIR = ".delivery-os";
const TMP = join(process.cwd(), "tmp/tmpdir");

const brand = (() => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
})();

const suites = REFERENCE_SUITES.map((id) => `          - ${id}`).join("\n");
const document = (local: readonly string[]): string => `verify:
  suite-map:
    schemaVersion: "delivery.verify.suite-map.v1"
    jobs:
      - job: "${REFERENCE_JOB}"
        suites:
${suites}
    local:
${local.map((id) => `      - ${id}`).join("\n")}
`;

const workflow = `name: CI
jobs:
  ts-aggregate:
    name: ${REFERENCE_JOB}
    runs-on: ubuntu-latest
    steps: [{ run: echo ok }]
`;

type Checkout = {
  readonly cwd: string;
  readonly home: string;
  cleanup(): void;
};

const checkout = (label: string, map: string | undefined): Checkout => {
  mkdirSync(TMP, { recursive: true });
  const root = mkdtempSync(join(TMP, `gh300-mcp-${label}-`));
  const cwd = join(root, "checkout");
  const home = join(root, "home");
  mkdirSync(join(cwd, ".git"), { recursive: true });
  mkdirSync(join(cwd, ".github/workflows"), { recursive: true });
  mkdirSync(join(cwd, "doc/changes"), { recursive: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(join(cwd, ".github/workflows/ci.yml"), workflow);
  if (map !== undefined) {
    mkdirSync(join(cwd, CONFIG_DIR), { recursive: true });
    writeFileSync(join(cwd, CONFIG_DIR, "config.yaml"), map);
  }
  return { cwd, home, cleanup: () => rmSync(root, { recursive: true, force: true }) };
};

const callShipped = async (target: Checkout) => {
  const surface = composeServeSurface({
    brand,
    environment: { HOME: target.home },
    cwd: target.cwd,
    homeDirectory: target.home,
  });
  expect(surface.ok).toBe(true);
  if (!surface.ok) throw new Error("surface composition failed");
  return surface.toolset.callTool("gate-report", { ref: "GH-300" });
};

const injectedRuntime = (withMap: boolean): GateReportToolRuntime => ({
  readLifecycle: () => ({
    document: { ok: false, reason: "missing" },
    registry: { ok: true, present: false, verifiedEmpty: true, transitions: [], recordCount: 0 },
  }),
  readRepository: () => ({ binding: "address-unresolved", head: { detached: true } }),
  readWorkflow: () => ({ outcome: "read", names: [REFERENCE_JOB] }),
  readOpenPullRequests: async () => ({ ok: false, reason: "not-attempted" }),
  readDeliveryRequestDetail: async () => ({ ok: false, reason: "not-attempted" }),
  readCheckRuns: async () => ({ ok: false, reason: "not-attempted" }),
  readWorkItem: async () => ({ ok: false, reason: "not-attempted" }),
  ...(withMap
    ? {
        readSuiteMap: () => ({
          ok: true as const,
          declared: true as const,
          value: {
            schemaVersion: "delivery.verify.suite-map.v1" as const,
            jobs: [{ job: REFERENCE_JOB, suites: [...REFERENCE_SUITES] }],
            local: ["tests"],
          },
        }),
      }
    : {}),
});

describe("TC-SCITE-005 the shipped composition is live for the map", () => {
  test("a narrowed committed document fails the tool call with the row identity", async () => {
    const target = checkout("narrowed", document(["tests"]));
    try {
      const result = await callShipped(target);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("verify.narrowed-scope");
      expect(result.error.category).toBe("user");
      expect(result.error.retryable).toBe(false);
      expect(result.error.consequence).toBe("not_landed");
      expect(result.error.remediationHint).toBe(
        "Run the local gate over the declared full suite breadth, or update the declared suite map so the local suite set matches the mirrored CI job, then re-run the gates.",
      );
      expect(Object.hasOwn(result.error, "kind")).toBe(false);
      expect(Object.hasOwn(result.error, "gates")).toBe(false);
      expect(Object.hasOwn(result.error, "detail")).toBe(false);
      const summary = String(result.error.summary ?? "");
      expect(summary.split("\n")[0]).toContain("scope=narrowed mirror=TS aggregate check breadth=");
    } finally {
      target.cleanup();
    }
  });

  test("an undeclared document leaves the delivered tool outcome unchanged", async () => {
    const target = checkout("undeclared", undefined);
    try {
      const result = await callShipped(target);
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain("suiteBreadth");
      expect(JSON.stringify(result)).not.toContain("mirrorsJob");
      expect(JSON.stringify(result)).not.toContain("verify.narrowed-scope");
    } finally {
      target.cleanup();
    }
  });

  test("an equality document changes no delivered byte of the tool outcome", async () => {
    const undeclared = checkout("equality-control", undefined);
    const equality = checkout("equality", document(REFERENCE_SUITES));
    try {
      const control = await callShipped(undeclared);
      const mapped = await callShipped(equality);
      expect(JSON.stringify(mapped)).toBe(JSON.stringify(control));
      expect(JSON.stringify(mapped)).not.toContain("suiteBreadth");
      expect(JSON.stringify(mapped)).not.toContain("mirrorsJob");
    } finally {
      undeclared.cleanup();
      equality.cleanup();
    }
  });

  test("the assertion is non-vacuous: a runtime without the read never refuses", async () => {
    const withMap = await createToolset({
      brand: SYNTHETIC_BRAND,
      gates: injectedRuntime(true),
    }).callTool("gate-report", { ref: "GH-300" });
    const withoutMap = await createToolset({
      brand: SYNTHETIC_BRAND,
      gates: injectedRuntime(false),
    }).callTool("gate-report", { ref: "GH-300" });
    expect(withMap.ok).toBe(false);
    expect(withoutMap.ok).toBe(false);
    if (withMap.ok || withoutMap.ok) return;
    expect(withMap.error.code).toBe("verify.narrowed-scope");
    expect(withoutMap.error.code).not.toBe("verify.narrowed-scope");
  });

  test("the composition supplies the same read the CLI composes and appends nothing observable", async () => {
    const target = checkout("repeat", document(["tests"]));
    try {
      const first = await callShipped(target);
      const second = await callShipped(target);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    } finally {
      target.cleanup();
    }
  });
});
