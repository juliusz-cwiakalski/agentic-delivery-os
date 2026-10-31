/**
 * TC-CAP-001 — capability honesty for the three delivered client seeds.
 *
 * The production `AdapterContract` values are bound to the exact GH-188 OQ-G
 * postures: closed operation set, exactly one gap per unsupported operation with
 * the recorded reason, none for supported operations, and no implied parity.
 */
import { describe, expect, test } from "bun:test";
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import { GITHUB_ADAPTER_CONTRACT } from "../../../packages/adapters/src/github/capabilities";
import { createGitHubClient } from "../../../packages/adapters/src/github/client";
import { GITLAB_ADAPTER_CONTRACT } from "../../../packages/adapters/src/gitlab/capabilities";
import { createGitLabClient } from "../../../packages/adapters/src/gitlab/client";
import { JIRA_ADAPTER_CONTRACT } from "../../../packages/adapters/src/jira/capabilities";
import { createJiraClient } from "../../../packages/adapters/src/jira/client";
import {
  ADAPTER_OPERATIONS,
  type AdapterOperation,
  type ExternalSystemInstance,
} from "../../../packages/core/src/contracts/index";
import { fixtureBrand } from "../../fixtures/credentials/cases";
import {
  EXPECTED_SEED_POSTURES,
  type ExpectedSeedPosture,
} from "../../fixtures/ports/capabilities";
import { createFixtureTransport } from "./support";

const credentials = createEnvironmentCredentialPort({ environment: {}, brand: fixtureBrand });
const transport = createFixtureTransport([]);

const jiraInstance: ExternalSystemInstance = {
  instanceName: "tracker-primary",
  systemKind: "tracker",
  baseUrl: "https://jira.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: { referenceName: "jira-read", sourceKey: { style: "literal", name: "JIRA_TOKEN" } },
  },
};
const vcsInstance: ExternalSystemInstance = {
  instanceName: "vcs-primary",
  systemKind: "vcs",
  baseUrl: "https://gitlab.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "vcs-read",
      sourceKey: { style: "literal", name: "VCS_TOKEN" },
    },
  },
};

const SEEDS = {
  jira: {
    contract: JIRA_ADAPTER_CONTRACT,
    client: createJiraClient({ instance: jiraInstance, credentials, transport }),
  },
  gitlab: {
    contract: GITLAB_ADAPTER_CONTRACT,
    client: createGitLabClient({
      instance: vcsInstance,
      credentials,
      projectPath: "group-placeholder/project-placeholder",
      transport,
    }),
  },
  github: {
    contract: GITHUB_ADAPTER_CONTRACT,
    client: createGitHubClient({
      instance: vcsInstance,
      credentials,
      repository: { owner: "group-placeholder", name: "project-placeholder" },
      transport,
    }),
  },
} as const;

const SEED_NAMES = ["jira", "gitlab", "github"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const READ_METHODS: Readonly<Partial<Record<AdapterOperation, string>>> = {
  "read-work-item": "readWorkItem",
  "read-delivery-request": "readDeliveryRequest",
  "read-pipeline-run": "readPipelineRun",
};

const WRITE_METHODS: Readonly<Partial<Record<AdapterOperation, string>>> = {
  "write-work-item": "writeWorkItem",
  "write-delivery-request": "writeDeliveryRequest",
  "transition-work-item": "transitionWorkItem",
  "write-comment": "writeComment",
};

/** Validate a declaration read from untrusted data (also used for mutations). */
const declarationFailures = (value: unknown, expected: ExpectedSeedPosture): string[] => {
  const failures: string[] = [];
  if (!isRecord(value)) return ["contract is not an object"];
  if (value.adapterName !== expected.adapterName) {
    failures.push(`adapterName ${String(value.adapterName)} != ${expected.adapterName}`);
  }
  if (value.systemKind !== expected.systemKind) {
    failures.push(`systemKind ${String(value.systemKind)} != ${expected.systemKind}`);
  }
  const capabilities = value.capabilities;
  if (!isRecord(capabilities)) return [...failures, "capabilities is not an object"];
  const supported = capabilities.supportedOperations;
  const gaps = capabilities.declaredGaps;
  if (!Array.isArray(supported) || !Array.isArray(gaps)) {
    return [...failures, "supportedOperations/declaredGaps must be arrays"];
  }
  const supportedNames = supported.filter((entry): entry is string => typeof entry === "string");
  if (supportedNames.length !== supported.length) {
    failures.push("supportedOperations contains a non-string entry");
  }
  if (new Set(supportedNames).size !== supportedNames.length) {
    failures.push("supportedOperations contains a duplicate");
  }
  for (const operation of supportedNames) {
    if (!(ADAPTER_OPERATIONS as readonly string[]).includes(operation)) {
      failures.push(`unknown operation ${operation}`);
    }
  }
  const gapOperations: string[] = [];
  for (const gap of gaps) {
    if (!isRecord(gap) || typeof gap.operation !== "string" || typeof gap.reason !== "string") {
      failures.push("declaredGaps contains an invalid record");
      continue;
    }
    gapOperations.push(gap.operation);
    if (supportedNames.includes(gap.operation)) {
      failures.push(`gap declared for supported operation ${gap.operation}`);
    }
    if (
      !["provider-unsupported", "adapter-not-implemented", "plan-restriction"].includes(gap.reason)
    ) {
      failures.push(`invalid gap reason ${gap.reason}`);
    }
  }
  for (const operation of ADAPTER_OPERATIONS) {
    const entries = gapOperations.filter((entry) => entry === operation);
    if (supportedNames.includes(operation) && entries.length > 0) {
      failures.push(`${operation}: gap on a supported operation`);
    }
    if (!supportedNames.includes(operation) && entries.length !== 1) {
      failures.push(`${operation}: exactly one gap record is required, found ${entries.length}`);
    }
  }
  for (const [operation, reason] of Object.entries(expected.gapReasons)) {
    const gap = gaps.find((entry) => isRecord(entry) && entry.operation === operation);
    if (!isRecord(gap) || gap.reason !== reason) {
      failures.push(`${operation}: expected gap reason ${String(reason)}`);
    }
  }
  if (gapOperations.length !== Object.keys(expected.gapReasons).length) {
    failures.push("declaredGaps does not match the recorded posture");
  }
  const supportedExpected = [...expected.supported].sort();
  if ([...supportedNames].sort().join(",") !== supportedExpected.join(",")) {
    failures.push(
      `supportedOperations ${supportedNames.join(",")} != ${supportedExpected.join(",")}`,
    );
  }
  for (const carriers of ["writableCarriers", "readableCarriers"]) {
    const value2 = capabilities[carriers];
    if (!Array.isArray(value2) || value2.length !== 0) {
      failures.push(`${carriers} must be empty for this change`);
    }
  }
  return failures;
};

describe("TC-CAP-001 capability declarations", () => {
  test("each seed matches its exact recorded posture", () => {
    for (const name of SEED_NAMES) {
      expect(declarationFailures(SEEDS[name].contract, EXPECTED_SEED_POSTURES[name]), name).toEqual(
        [],
      );
    }
  });

  test("the closed operation set is partitioned into supported and gapped exactly once", () => {
    for (const name of SEED_NAMES) {
      const supported = new Set(SEEDS[name].contract.capabilities.supportedOperations);
      for (const operation of ADAPTER_OPERATIONS) {
        expect(supported.has(operation), `${name}:${operation}`).toBe(
          EXPECTED_SEED_POSTURES[name].supported.includes(operation),
        );
      }
    }
  });

  test("declarations and implementations agree, with no implied parity", () => {
    for (const name of SEED_NAMES) {
      const seed = SEEDS[name];
      const methods = new Set(Object.keys(seed.client));
      for (const operation of seed.contract.capabilities.supportedOperations) {
        const method = READ_METHODS[operation] ?? WRITE_METHODS[operation];
        expect(method, `${name}:${operation} needs an implementation method`).toBeDefined();
        if (method !== undefined) expect(methods, `${name}:${method}`).toContain(method);
      }
      for (const gap of seed.contract.capabilities.declaredGaps) {
        const method = WRITE_METHODS[gap.operation] ?? READ_METHODS[gap.operation];
        if (method !== undefined) {
          expect(methods, `${name}:${method} must not exist for a gapped operation`).not.toContain(
            method,
          );
        }
      }
    }
  });

  test("removing a Jira write gap fails the declaration check", () => {
    const mutated = {
      ...JIRA_ADAPTER_CONTRACT,
      capabilities: {
        ...JIRA_ADAPTER_CONTRACT.capabilities,
        declaredGaps: JIRA_ADAPTER_CONTRACT.capabilities.declaredGaps.filter(
          (gap) => gap.operation !== "write-work-item",
        ),
      },
    };
    const failures = declarationFailures(mutated, EXPECTED_SEED_POSTURES.jira);
    expect(failures.some((message) => message.includes("write-work-item"))).toBe(true);
  });

  test("adding a non-operation string fails the declaration check", () => {
    const mutated = {
      ...GITHUB_ADAPTER_CONTRACT,
      capabilities: {
        ...GITHUB_ADAPTER_CONTRACT.capabilities,
        supportedOperations: [
          ...GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations,
          "publish-release",
        ],
      },
    };
    const failures = declarationFailures(mutated, EXPECTED_SEED_POSTURES.github);
    expect(failures.some((message) => message.includes("unknown operation publish-release"))).toBe(
      true,
    );
  });
});
