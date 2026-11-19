/**
 * TC-SYNC-009 — the tenth operation's eighteen enforcing pins move together
 * (GH-349, AC-F4-1, DM-6/DM-7, NFR-7; spec Appendix H).
 *
 * Machine values are imported; the pin files themselves are swept for their
 * updated literal so a surface left at nine fails by name.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GITHUB_ADAPTER_CONTRACT } from "../../packages/adapters/src/github/capabilities";
import { GITHUB_TRANSPORT_MATRIX } from "../../packages/adapters/src/github/cli-transport";
import { GITLAB_ADAPTER_CONTRACT } from "../../packages/adapters/src/gitlab/capabilities";
import { JIRA_ADAPTER_CONTRACT } from "../../packages/adapters/src/jira/capabilities";
import { ADAPTER_OPERATIONS, type AdapterContract } from "../../packages/core/src/contracts/index";
import { CONFORMANCE_FLOWS } from "../../packages/testkit/src/conformance/flows";
import { PARITY_MATRIX } from "../../packages/testkit/src/conformance/parity";
import { EXPECTED_SEED_POSTURES } from "../fixtures/ports/capabilities";
import { CONTROL_CONTRACT } from "../fixtures/providers/conformance/control/column";

const ROOT = process.cwd();

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const coverage = (contract: AdapterContract): readonly string[] => [
  ...contract.capabilities.supportedOperations,
  ...contract.capabilities.declaredGaps.map((gap) => gap.operation),
];

describe("TC-SYNC-009 the operation set and its three postures", () => {
  test("the closed set is ten with close-milestone appended and nothing reordered", () => {
    expect([...ADAPTER_OPERATIONS]).toEqual([
      "read-work-item",
      "write-work-item",
      "transition-work-item",
      "read-delivery-request",
      "write-delivery-request",
      "read-pipeline-run",
      "write-comment",
      "resolve-delivery-thread",
      "merge-delivery-request",
      "close-milestone",
    ]);
  });

  test("GitHub supports the tenth operation with an empty gap list", () => {
    expect(GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations).toHaveLength(10);
    expect(GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations).toContain("close-milestone");
    expect(GITHUB_ADAPTER_CONTRACT.capabilities.declaredGaps).toEqual([]);
  });

  test("GitLab declares adapter-not-implemented and Jira provider-unsupported", () => {
    expect(GITLAB_ADAPTER_CONTRACT.capabilities.declaredGaps).toContainEqual({
      operation: "close-milestone",
      reason: "adapter-not-implemented",
    });
    expect(JIRA_ADAPTER_CONTRACT.capabilities.declaredGaps).toContainEqual({
      operation: "close-milestone",
      reason: "provider-unsupported",
    });
  });

  test("EXPECTED_SEED_POSTURES reads github 10 supported / gitlab 8 gaps / jira 7 gaps", () => {
    expect(EXPECTED_SEED_POSTURES.github.supported).toHaveLength(10);
    expect(EXPECTED_SEED_POSTURES.github.supported).toContain("close-milestone");
    expect(Object.keys(EXPECTED_SEED_POSTURES.github.gapReasons)).toHaveLength(0);
    expect(EXPECTED_SEED_POSTURES.gitlab.supported).toHaveLength(2);
    expect(Object.keys(EXPECTED_SEED_POSTURES.gitlab.gapReasons)).toHaveLength(8);
    expect(EXPECTED_SEED_POSTURES.gitlab.gapReasons["close-milestone"]).toBe(
      "adapter-not-implemented",
    );
    expect(EXPECTED_SEED_POSTURES.jira.supported).toHaveLength(3);
    expect(Object.keys(EXPECTED_SEED_POSTURES.jira.gapReasons)).toHaveLength(7);
    expect(EXPECTED_SEED_POSTURES.jira.gapReasons["close-milestone"]).toBe("provider-unsupported");
  });
});

describe("TC-SYNC-009 the representation pins", () => {
  test("the transport matrix carries ten keys and the milestone close", () => {
    expect(Object.keys(GITHUB_TRANSPORT_MATRIX)).toHaveLength(10);
    expect(GITHUB_TRANSPORT_MATRIX["close-milestone"]).toEqual({
      preferred: "gh",
      fallback: "api",
    });
  });

  test("the parity matrix is 30 cells with ten per column", () => {
    expect(PARITY_MATRIX.columns).toHaveLength(3);
    for (const column of PARITY_MATRIX.columns) {
      expect(column.cells).toHaveLength(10);
    }
    expect(PARITY_MATRIX.register).toHaveLength(3);
  });

  test("the control column covers ten of ten operations", () => {
    expect(coverage(CONTROL_CONTRACT)).toHaveLength(10);
    expect(new Set(coverage(CONTROL_CONTRACT))).toEqual(new Set(ADAPTER_OPERATIONS));
  });

  test("the flow registry represents the tenth operation and the seventh family", () => {
    const operations = new Set(
      CONFORMANCE_FLOWS.flatMap((flow) => flow.steps.map((step) => step.operation)),
    );
    expect([...operations].sort()).toEqual([...ADAPTER_OPERATIONS].sort());
    expect(CONFORMANCE_FLOWS.flatMap((flow) => flow.steps)).toHaveLength(15);
    const families = new Set(
      CONFORMANCE_FLOWS.flatMap((flow) => flow.steps.map((step) => step.assertionFamily)),
    );
    expect(families.size).toBe(7);
    expect(families.has("milestone-state")).toBe(true);
  });
});

describe("TC-SYNC-009 no pin file is left asserting nine", () => {
  const pins: readonly { readonly file: string; readonly marker: string }[] = [
    { file: "packages/adapters/src/github/cli-transport.ts", marker: '"close-milestone"' },
    { file: "tests/types/merge-delivery-request.type-test.ts", marker: 'case "close-milestone"' },
    { file: "tests/behaviour/providers/github-cli-transport.test.ts", marker: "ten of ten" },
    { file: "tests/behaviour/providers/github-landing.test.ts", marker: "close-milestone" },
    { file: "tests/behaviour/providers/github-collection.test.ts", marker: "toHaveLength(10)" },
    {
      file: "tests/behaviour/providers/provider-capabilities.test.ts",
      marker: '"close-milestone": "closeMilestone"',
    },
    { file: "tests/behaviour/closeout-capabilities.test.ts", marker: "close-milestone" },
    { file: "tests/structure/registration-participation.test.ts", marker: "close-milestone" },
    { file: "tests/structure/provider-surface.test.ts", marker: '"closeMilestone"' },
    { file: "tests/structure/closeout-contract.test.ts", marker: "close-milestone" },
    { file: "tests/structure/reference-behavior.test.ts", marker: "9 rows" },
    { file: "tests/fixtures/ports/capabilities.ts", marker: "close-milestone" },
    { file: "tests/fixtures/providers/conformance/control/column.ts", marker: "close-milestone" },
    { file: "tests/conformance/broken-adapter-control.test.ts", marker: "close-milestone" },
    { file: "tests/conformance/live/live-entrypoint.test.ts", marker: "close-milestone" },
    { file: "tests/conformance/mock-conformance.test.ts", marker: "close-milestone" },
    { file: "tests/conformance/control-registration.test.ts", marker: "toHaveLength(10)" },
    { file: "tests/conformance/parity-gate.test.ts", marker: "toBe(30)" },
  ];

  for (const pin of pins) {
    test(`${pin.file} carries its moved pin`, () => {
      expect(read(pin.file)).toContain(pin.marker);
    });
  }

  test("the unrelated artifact flow count stays nine", () => {
    expect(read("tests/conformance/artifact.test.ts")).toContain("toHaveLength(9)");
  });
});
