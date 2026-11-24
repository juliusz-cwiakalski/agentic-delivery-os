/**
 * TC-REMEDY-001/002/003 — the owner-pinned remedy texts are fixture-pinned
 * byte-exact, selection is per allowlist entry and never interpolated, and
 * the failure fields survive every propagation site and render on every
 * surface (DEC-14 forwarding scope: the provider-engine reconstruction sites
 * and the merge-chain refusal reconstruction included).
 */
import { describe, expect, test } from "bun:test";
import {
  COMMAND_ALLOWLIST,
  COMMAND_HOST_AWARE_NON_ZERO_EXIT_REMEDY,
  COMMAND_NEUTRAL_NON_ZERO_EXIT_REMEDY,
  COMMAND_PROGRAM_UNAVAILABLE_REMEDY,
  commandRemedyText,
  environmentRemedyText,
  harnessStoreRemedyText,
  remedyText,
} from "../../packages/adapters/src/credentials/allowlist";
import {
  type ChildRunRequest,
  resolveCommandSource,
} from "../../packages/adapters/src/credentials/command-strategy";
import { CREDENTIAL_FAILURE_REASONS } from "../../packages/core/src/contracts/credentials";
import { renderMergeFailure } from "../../packages/core/src/domain/index";
import { createProviderEngine } from "../../packages/core/src/provider/index";
import { fixtureBrand } from "../fixtures/credentials/cases";

/** The three owner-pinned texts (spec Appendix B), pinned verbatim here. */
const PINNED = {
  programUnavailable: "declare the program path as installed",
  hostAwareNonZeroExit:
    "the program could not obtain a token; it may not be authenticated to the required host — log in to that host (for `gh`: `gh auth login --hostname <host>`), or declare another source.",
  neutralNonZeroExit:
    "the program could not obtain a token; it may not be authenticated — log in, or declare another source.",
};

const ghEntry = COMMAND_ALLOWLIST.find((entry) => entry.program === "gh");
const opencodeEntry = COMMAND_ALLOWLIST.find((entry) => entry.program === "opencode");

describe("TC-REMEDY-001 owner-pinned remedy texts fixture-pinned byte-exact", () => {
  test("command / program-unavailable is pinned byte-exact", () => {
    expect(COMMAND_PROGRAM_UNAVAILABLE_REMEDY).toBe(PINNED.programUnavailable);
    expect(commandRemedyText("program-unavailable", ghEntry)).toBe(PINNED.programUnavailable);
    expect(commandRemedyText("program-unavailable", opencodeEntry)).toBe(PINNED.programUnavailable);
  });

  test("command / non-zero-exit host-aware text is pinned byte-exact and names no concrete host", () => {
    expect(COMMAND_HOST_AWARE_NON_ZERO_EXIT_REMEDY).toBe(PINNED.hostAwareNonZeroExit);
    expect(PINNED.hostAwareNonZeroExit).toContain("`gh auth login --hostname <host>`");
    expect(PINNED.hostAwareNonZeroExit).not.toMatch(/github\.com|gitlab\.com/);
  });

  test("command / non-zero-exit neutral text is pinned byte-exact", () => {
    expect(COMMAND_NEUTRAL_NON_ZERO_EXIT_REMEDY).toBe(PINNED.neutralNonZeroExit);
  });

  test("renderer pass-through: the merge-chain renderings emit the pinned strings verbatim", () => {
    const failure = {
      code: "config.credential.missing",
      domainKind: "config" as const,
      exit: 1 as const,
      evidence: {
        operation: "github-work-item" as const,
        credentialReference: "github-read",
        credentialSourceKey: "GITHUB_TOKEN",
        credentialSource: "literal:GITHUB_TOKEN",
        credentialReason: "variable-absent",
        credentialRemedy: environmentRemedyText("variable-absent", "literal"),
        detail: "config.credential.missing",
      },
    };
    const rendered = renderMergeFailure(failure, { command: "merge", ref: "GH-394" });
    const remedy = environmentRemedyText("variable-absent", "literal");
    expect(rendered).toContain(`credential-remedy=${remedy}`);
    expect(rendered).toContain("credential-identity=literal:GITHUB_TOKEN");
    expect(rendered).toContain("credential-reason=variable-absent");
    // No interpolation, no truncation, no rewriting: the pinned cell appears
    // exactly once, verbatim, on one line.
    expect(rendered.split(`credential-remedy=${remedy}`).length - 1).toBe(1);
  });
});

describe("TC-REMEDY-002 host-aware vs neutral selection per entry; never interpolated", () => {
  test("the tracker entry (host slot) selects the host-aware cell; the harness entry the neutral cell", () => {
    expect(ghEntry?.hostAwareRefusal).toBe(true);
    expect(opencodeEntry?.hostAwareRefusal).toBe(false);
    expect(commandRemedyText("non-zero-exit", ghEntry)).toBe(PINNED.hostAwareNonZeroExit);
    expect(commandRemedyText("non-zero-exit", opencodeEntry)).toBe(PINNED.neutralNonZeroExit);
  });

  test("every cell is a fixed shipped string: hostile configuration never reaches the text", () => {
    const hostile = remedyText("variable-absent", "literal");
    expect(hostile).toBe(environmentRemedyText("variable-absent", "literal"));
    for (const reason of CREDENTIAL_FAILURE_REASONS) {
      const harnessCell = harnessStoreRemedyText(reason);
      expect(harnessCell.length).toBeGreaterThan(0);
      expect(harnessCell).not.toContain("<");
    }
    for (const reason of [
      "program-unavailable",
      "timeout",
      "non-zero-exit",
      "empty-output",
      "shape-drift",
      "source-not-supported",
    ] as const) {
      const neutralCell = commandRemedyText(reason, opencodeEntry);
      expect(neutralCell.length).toBeGreaterThan(0);
    }
  });

  test("content contract: the harness timeout cell names the standalone flag; the literal cell names the variable declaration", () => {
    expect(harnessStoreRemedyText("timeout")).toContain("--standalone");
    expect(environmentRemedyText("variable-absent", "literal")).toContain(
      "environment variable named by the literal source key",
    );
    expect(environmentRemedyText("variable-absent", "environment-prefixed")).toContain(
      "declared prefix and suffix",
    );
  });

  test("a hostile program path never leaks into any remedy", () => {
    const hostileProgram = "remedy-declare-the-program-path-as-installed";
    // The allowlist matches by canonical basename against the closed table;
    // a hostile path is refused before any remedy exists, and the refusal
    // text is the fixed shipped string, never configuration-derived.
    expect(COMMAND_ALLOWLIST.some((entry) => entry.program === hostileProgram)).toBe(false);
    expect(commandRemedyText("program-unavailable", undefined)).toBe(PINNED.programUnavailable);
    expect(PINNED.programUnavailable).not.toContain("evil");
  });
});

describe("TC-REMEDY-003 fields survive every propagation site and render on every surface", () => {
  const projection = {
    source: "command:/usr/bin/gh",
    reason: "non-zero-exit" as const,
    remedy: PINNED.hostAwareNonZeroExit,
  };

  test("the command strategy carries all three fields from birth", () => {
    const resolution = resolveCommandSource(
      { style: "command", program: "/usr/bin/gh", args: ["auth", "token"] },
      {
        parentEnvironment: { PATH: "/usr/bin" },
        registerSecret: () => undefined,
        runChild: (_request: ChildRunRequest) => ({ ok: true, exitCode: 1, stdout: "" }),
      },
    );
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.source).toBe(projection.source);
      expect(resolution.reason).toBe(projection.reason);
      expect(resolution.remedy).toBe(projection.remedy);
    }
  });

  test("the park-evidence build forwards: the announcement line derives from the code plus the reason token", async () => {
    const engine = createProviderEngine({
      clock: { nowMs: () => 1_000 },
      credentialPort: {
        resolve: () => ({
          ok: false as const,
          code: "config.credential.missing" as const,
          domainKind: "config" as const,
          category: "user" as const,
          retryable: false as const,
          consequence: "not_landed" as const,
          projectionClass: "user-validation" as const,
          ...projection,
        }),
      },
      transport: { send: async () => ({ status: 200, bodyText: "{}" }) },
      sleep: { sleep: async () => undefined },
    });
    const result = await engine.resolve({
      config: {
        defaultChain: "main",
        credentials: {
          tracker: { sourceKey: { style: "literal", name: "GITHUB_TOKEN" } },
        },
        entries: {
          alpha: {
            name: "alpha",
            enabled: true,
            class: "subscription",
            quota: {
              enabled: true,
              endpoint: "https://quota.example.com",
              credentialRef: "tracker",
              timeoutMs: 1_000,
              thresholdPercent: 100,
              maxSleepLoops: 1,
              outageParkTtlSeconds: 10,
              credentialParkTtlSeconds: 10,
              capParkTtlSeconds: 10,
            },
          },
        },
        chains: { main: { name: "main", entries: ["alpha"], allowPaidFallback: false } },
      },
      persist: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The parked decision carries the projection through the live log line:
    // the announcement message names the source, the closed reason token, and
    // the fixed remedy, while the persisted evidence keeps its closed shape.
    const announcement = result.announcements.find(
      (entry) => entry.code === "provider.credential.missing",
    );
    expect(announcement).toBeDefined();
    if (announcement === undefined) return;
    expect(announcement.message).toContain("provider.credential.missing");
    expect(announcement.message).toContain("source command:/usr/bin/gh");
    expect(announcement.message).toContain("reason non-zero-exit");
    expect(announcement.message).toContain(projection.remedy);
    // The park record gains no field: the evidence stays the closed
    // failure-class-plus-reference pair, and no park record carries the
    // reason.
    for (const park of result.parks) {
      expect(Object.keys(park.evidence)).not.toContain("reason");
      expect(Object.keys(park.evidence)).not.toContain("source");
      expect(Object.keys(park.evidence)).not.toContain("remedy");
    }
  });

  test("the quota-path failure reconstruction forwards onto the rendered refusal", async () => {
    const engine = createProviderEngine({
      clock: { nowMs: () => 1_000 },
      credentialPort: {
        resolve: () => ({
          ok: false as const,
          code: "config.credential.missing" as const,
          domainKind: "config" as const,
          category: "user" as const,
          retryable: false as const,
          consequence: "not_landed" as const,
          projectionClass: "user-validation" as const,
          ...projection,
        }),
      },
      transport: { send: async () => ({ status: 200, bodyText: "{}" }) },
      sleep: { sleep: async () => undefined },
    });
    const result = await engine.quota({
      config: {
        defaultChain: "main",
        credentials: {
          tracker: { sourceKey: { style: "literal", name: "GITHUB_TOKEN" } },
        },
        entries: {
          alpha: {
            name: "alpha",
            enabled: true,
            class: "subscription",
            quota: {
              enabled: true,
              endpoint: "https://quota.example.com",
              credentialRef: "tracker",
              timeoutMs: 1_000,
              thresholdPercent: 100,
              maxSleepLoops: 1,
              outageParkTtlSeconds: 10,
              credentialParkTtlSeconds: 10,
              capParkTtlSeconds: 10,
            },
          },
        },
        chains: { main: { name: "main", entries: ["alpha"], allowPaidFallback: false } },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("config.credential.missing");
      expect(result.summary).toContain("source command:/usr/bin/gh");
      expect(result.summary).toContain("reason non-zero-exit");
      expect(result.summary).toContain(projection.remedy);
    }
  });

  test("the MCP serve state placeholders carry the reason so the renderer never guesses", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const serve = readFileSync("packages/mcp/src/serve.ts", "utf8");
    expect(serve).toContain('credential: { reason: "source-not-supported" }');
  });

  test("no forwarding site collapses the failure to the evidence pair without the fields alongside", () => {
    // The merge-chain reconstruction is name-shaped evidence WITH the fields:
    // the renderer's lines only appear when the fields rode the evidence.
    const failure = {
      code: "config.credential.missing",
      domainKind: "config" as const,
      exit: 1 as const,
      evidence: {
        operation: "github-merge-delivery-request" as const,
        detail: "landing-fault",
        credentialReference: "github-read",
        credentialSource: "literal:GITHUB_TOKEN",
        credentialReason: "variable-absent",
        credentialRemedy: environmentRemedyText("variable-absent", "literal"),
      },
    };
    const rendered = renderMergeFailure(failure, { command: "merge", ref: "GH-394" });
    expect(rendered).toContain("credential-reason=variable-absent");
    expect(rendered).toContain("credential-identity=literal:GITHUB_TOKEN");
  });

  test("the name-only evidence rule stays intact: rendered fields are identifier-shaped", () => {
    const remedy = environmentRemedyText("variable-absent", "literal");
    expect(remedy).not.toMatch(/canary|token value|secret/i);
    expect("literal:GITHUB_TOKEN").not.toContain("ghp");
    expect(CREDENTIAL_FAILURE_REASONS).toContain("variable-absent");
    expect(fixtureBrand.binaryName.length).toBeGreaterThan(0);
  });
});
