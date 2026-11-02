/**
 * TC-CONF-001 / TC-CONF-005 — flow registry shape and structural non-vacuity.
 *
 * The registry is validated as untrusted data so mutation controls can feed
 * deliberately malformed copies without casts. Adapter-level coverage lands in
 * this module as the registrations and coverage gates are delivered.
 */
import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { JIRA_ADAPTER_CONTRACT } from "@delivery-os/adapters/jira";
import { ADAPTER_OPERATIONS } from "@delivery-os/core/contracts";
import {
  CONFORMANCE_ADAPTERS,
  CONFORMANCE_FLOWS,
  findFlow,
  structuralCoverageViolations,
} from "@delivery-os/testkit";

const ROOT = process.cwd();

const CLOSED_OPERATIONS = new Set<string>(ADAPTER_OPERATIONS);
const EXPECTED_FLOW_IDS = ["change-lifecycle", "comment-provenance", "label-semantics"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
};

/**
 * Pure flow-registry validator. It operates on untrusted data and names the
 * offending flow, step, or operation in every failure.
 */
export const flowRegistryViolations = (flows: readonly unknown[]): string[] => {
  const violations: string[] = [];
  if (flows.length === 0) return ["registry: flow set is empty"];

  const flowIds = new Set<string>();
  const stepIds = new Set<string>();
  const operations = new Set<string>();

  for (const [flowIndex, rawFlow] of flows.entries()) {
    if (!isRecord(rawFlow)) {
      violations.push(`registry: flow ${flowIndex} is not an object`);
      continue;
    }
    const flowId = text(rawFlow, "flowId");
    if (flowId === undefined || flowId.trim().length === 0) {
      violations.push(`registry: flow ${flowIndex} has no flowId`);
      continue;
    }
    if (flowIds.has(flowId)) violations.push(`registry: duplicate flow id ${flowId}`);
    flowIds.add(flowId);
    if (text(rawFlow, "name") === undefined) {
      violations.push(`${flowId}: flow has no name`);
    }
    const steps = rawFlow.steps;
    if (!Array.isArray(steps) || steps.length === 0) {
      violations.push(`${flowId}: flow has no steps`);
      continue;
    }
    for (const [stepIndex, rawStep] of steps.entries()) {
      if (!isRecord(rawStep)) {
        violations.push(`${flowId}: step ${stepIndex} is not an object`);
        continue;
      }
      const stepId = text(rawStep, "stepId");
      if (stepId === undefined || stepId.trim().length === 0) {
        violations.push(`${flowId}: step ${stepIndex} has no stepId`);
        continue;
      }
      if (stepIds.has(stepId)) violations.push(`registry: duplicate step id ${stepId}`);
      stepIds.add(stepId);
      const operation = text(rawStep, "operation");
      if (operation === undefined) {
        violations.push(`${stepId}: step has no operation`);
      } else if (!CLOSED_OPERATIONS.has(operation)) {
        violations.push(`${stepId}: unknown operation ${operation}`);
      } else {
        operations.add(operation);
      }
      if (text(rawStep, "assertionFamily") === undefined) {
        violations.push(`${stepId}: step has no assertion family`);
      }
    }
  }

  if (flowIds.size !== EXPECTED_FLOW_IDS.length) {
    violations.push(
      `registry: expected ${EXPECTED_FLOW_IDS.length} flows but observed ${flowIds.size}`,
    );
  }
  for (const flowId of EXPECTED_FLOW_IDS) {
    if (!flowIds.has(flowId)) violations.push(`registry: missing flow ${flowId}`);
  }
  for (const operation of ADAPTER_OPERATIONS) {
    if (!operations.has(operation)) violations.push(`registry: missing operation ${operation}`);
  }
  return violations;
};

const withoutOperation = (operation: string): unknown => ({
  flowId: "change-lifecycle",
  name: "Change lifecycle",
  steps: [
    {
      stepId: "change-lifecycle.read-work-item",
      operation,
      assertionFamily: "work-item",
    },
  ],
});

describe("TC-CONF-001 flow registry shape", () => {
  test("exactly three flows and thirteen ordered steps with unique ids", () => {
    expect(flowRegistryViolations(CONFORMANCE_FLOWS)).toEqual([]);
    expect(CONFORMANCE_FLOWS.map((flow) => flow.flowId)).toEqual([...EXPECTED_FLOW_IDS]);
    expect(CONFORMANCE_FLOWS.flatMap((flow) => flow.steps)).toHaveLength(13);
  });

  test("every closed operation is represented exactly by the registry data", () => {
    const operations = new Set(
      CONFORMANCE_FLOWS.flatMap((flow) => flow.steps.map((step) => step.operation)),
    );
    expect([...operations].sort()).toEqual([...ADAPTER_OPERATIONS].sort());
    for (const operation of ADAPTER_OPERATIONS) {
      expect(operations.has(operation), operation).toBe(true);
    }
  });

  test("the public helpers are reachable through the root export", () => {
    expect(findFlow("change-lifecycle")?.steps[0]?.stepId).toBe("change-lifecycle.read-work-item");
    expect(findFlow("comment-provenance")?.steps[1]?.requiresCarrier).toBe(true);
    expect(findFlow("label-semantics")?.flowId).toBe("label-semantics");
    expect(findFlow("missing-flow")).toBeUndefined();
  });
});

describe("TC-CONF-005 flow non-vacuity and mutation controls", () => {
  test("the registry carries no empty flow, duplicate id, or unknown operation", () => {
    expect(flowRegistryViolations(CONFORMANCE_FLOWS)).toEqual([]);
    expect(CONFORMANCE_FLOWS.every((flow) => flow.steps.length > 0)).toBe(true);
  });

  test("an empty registry fails with a non-vacuity message", () => {
    expect(flowRegistryViolations([]).some((message) => message.includes("empty"))).toBe(true);
  });

  test("a fourth flow fails naming it", () => {
    const mutated: unknown[] = [
      ...CONFORMANCE_FLOWS,
      {
        flowId: "extra-flow",
        name: "Extra",
        steps: [
          {
            stepId: "extra-flow.read",
            operation: "read-work-item",
            assertionFamily: "work-item",
          },
        ],
      },
    ];
    expect(flowRegistryViolations(mutated)).toContain("registry: expected 3 flows but observed 4");
  });

  test("a duplicate step id fails naming the id", () => {
    const mutated: unknown[] = [
      ...CONFORMANCE_FLOWS,
      {
        flowId: "extra-flow",
        name: "Extra",
        steps: [
          {
            stepId: "change-lifecycle.read-work-item",
            operation: "read-work-item",
            assertionFamily: "work-item",
          },
        ],
      },
    ];
    expect(
      flowRegistryViolations(mutated).some((message) =>
        message.includes("duplicate step id change-lifecycle.read-work-item"),
      ),
    ).toBe(true);
  });

  test("an unknown operation fails naming the step and operation", () => {
    expect(
      flowRegistryViolations([withoutOperation("read-orbit")]).some((message) =>
        message.includes("unknown operation read-orbit"),
      ),
    ).toBe(true);
  });

  test("a removed operation fails naming the missing operation", () => {
    const flows = CONFORMANCE_FLOWS.map((flow) => ({
      ...flow,
      steps: flow.steps.filter((step) => step.operation !== "transition-work-item"),
    }));
    expect(
      flowRegistryViolations(flows).some((message) =>
        message.includes("missing operation transition-work-item"),
      ),
    ).toBe(true);
  });

  test("an empty flow fails naming the flow", () => {
    const mutated: unknown[] = [{ flowId: "empty-flow", name: "Empty", steps: [] }];
    expect(
      flowRegistryViolations(mutated).some((message) =>
        message.includes("empty-flow: flow has no steps"),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-CONF-002 / TC-CONF-003 — adapter registration and provider-contract scan
// ---------------------------------------------------------------------------

type ContractDeclaration = {
  readonly symbol: string;
  readonly file: string;
  readonly adapter: string;
};

const ADAPTERS_SRC = "packages/adapters/src";
const CONTRACT_DECLARATION = /\bexport\s+const\s+([A-Za-z0-9_]*_ADAPTER_CONTRACT)\b/g;
const CONTRACT_SYMBOL = /\b[A-Za-z0-9_]*_ADAPTER_CONTRACT\b/g;

const listTsFiles = (root: string, relative: string): string[] => {
  const directory = join(root, relative);
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const next = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...listTsFiles(root, next));
    } else if (entry.name.endsWith(".ts")) {
      files.push(next);
    }
  }
  return files.sort();
};

/** Declaration-only scan: an `index.ts` re-export is never an occurrence. */
export const scanContractDeclarations = (root: string): ContractDeclaration[] => {
  const declarations: ContractDeclaration[] = [];
  for (const file of listTsFiles(root, ADAPTERS_SRC)) {
    const text = readFileSync(join(root, file), "utf8");
    const remainder = file.slice(`${ADAPTERS_SRC}/`.length).split("/");
    const adapter = remainder.length > 1 ? (remainder[0] ?? "") : "";
    for (const match of text.matchAll(CONTRACT_DECLARATION)) {
      const symbol = match[1];
      if (symbol !== undefined) declarations.push({ symbol, file, adapter });
    }
  }
  return declarations;
};

const registrationProvider = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  return text(value, "provider");
};

const registrationAdapterName = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const contract = value.contract;
  return isRecord(contract) ? text(contract, "adapterName") : undefined;
};

/** Registry completeness and contract-binding checks, naming both names. */
export const adapterRegistryViolations = (registrations: readonly unknown[]): string[] => {
  const violations: string[] = [];
  if (registrations.length !== EXPECTED_FLOW_IDS.length) {
    violations.push(
      `registry: expected 3 adapter registrations but observed ${registrations.length}`,
    );
  }
  const seen = new Set<string>();
  for (const registration of registrations) {
    if (!isRecord(registration)) {
      violations.push("registry: registration is not an object");
      continue;
    }
    const provider = registrationProvider(registration);
    if (provider === undefined) {
      violations.push("registry: registration has no provider");
      continue;
    }
    if (seen.has(provider)) violations.push(`registry: duplicate registration ${provider}`);
    seen.add(provider);
    if (!["github", "gitlab", "jira"].includes(provider)) {
      violations.push(`registry: unexpected non-provider registration ${provider}`);
    }
    const adapterName = registrationAdapterName(registration);
    if (adapterName === undefined) {
      violations.push(`registry: registration ${provider} has no contract adapterName`);
    } else if (adapterName !== provider) {
      violations.push(
        `registry: registration ${provider} names contract ${adapterName} instead of ${provider}`,
      );
    }
    if (typeof registration.buildClient !== "function") {
      violations.push(`registry: registration ${provider} has no client builder`);
    }
  }
  for (const provider of ["github", "gitlab", "jira"]) {
    if (!seen.has(provider)) violations.push(`registry: missing registration ${provider}`);
  }
  return violations;
};

/** Every declaration is registered and every registration names a declaration. */
export const registrationViolations = (
  declarations: readonly ContractDeclaration[],
  registrations: readonly unknown[],
): string[] => {
  const violations: string[] = [];
  const declaredAdapters = new Set(declarations.map((entry) => entry.adapter));
  const registeredProviders = new Set(
    registrations.flatMap((entry) => {
      const provider = registrationProvider(entry);
      return provider === undefined ? [] : [provider];
    }),
  );
  for (const declaration of declarations) {
    if (!registeredProviders.has(declaration.adapter)) {
      violations.push(
        `${declaration.file}: provider contract ${declaration.symbol} has no conformance registration for ${declaration.adapter}`,
      );
    }
  }
  for (const provider of registeredProviders) {
    if (!declaredAdapters.has(provider)) {
      violations.push(`registration ${provider} names no declared provider contract`);
    }
  }
  return violations;
};

const writeTempTree = (files: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), "gh189-contracts-"));
  for (const [relative, content] of Object.entries(files)) {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
};

const capabilityFile = (name: string, symbol: string): string =>
  `export const ${symbol} = { adapterName: "${name}", systemKind: "vcs", capabilities: {} };\n`;

describe("TC-CONF-002 adapter registry completeness and contract binding", () => {
  test("the live registry is exactly GitHub, GitLab and Jira with matching contracts", () => {
    expect(adapterRegistryViolations(CONFORMANCE_ADAPTERS)).toEqual([]);
    expect(CONFORMANCE_ADAPTERS.map((entry) => entry.provider).sort()).toEqual([
      "github",
      "gitlab",
      "jira",
    ]);
    for (const registration of CONFORMANCE_ADAPTERS) {
      expect(registration.contract.adapterName).toBe(registration.provider);
      expect(typeof registration.buildClient).toBe("function");
      expect(registration.writeHandler).toBeUndefined();
    }
  });

  test("a wrong-contract binding fails naming both names", () => {
    const mutated = CONFORMANCE_ADAPTERS.map((entry) =>
      entry.provider === "github" ? { ...entry, contract: JIRA_ADAPTER_CONTRACT } : entry,
    );
    expect(
      adapterRegistryViolations(mutated).some(
        (message) => message.includes("github") && message.includes("jira"),
      ),
    ).toBe(true);
  });

  test("an azure registration fails naming the registration", () => {
    const mutated = [
      ...CONFORMANCE_ADAPTERS,
      { provider: "azure", contract: JIRA_ADAPTER_CONTRACT, buildClient: () => ({}) },
    ];
    expect(adapterRegistryViolations(mutated).some((message) => message.includes("azure"))).toBe(
      true,
    );
  });
});

describe("TC-CONF-003 provider-contract registration scan", () => {
  test("the live scan finds exactly three declarations from three files", () => {
    const declarations = scanContractDeclarations(ROOT);
    expect(declarations.map((entry) => entry.adapter).sort()).toEqual(["github", "gitlab", "jira"]);
    expect(new Set(declarations.map((entry) => entry.file)).size).toBe(3);
    expect(registrationViolations(declarations, CONFORMANCE_ADAPTERS)).toEqual([]);
  });

  test("six raw symbol occurrences collapse to three declarations", () => {
    const corpus = listTsFiles(ROOT, ADAPTERS_SRC)
      .map((file) => readFileSync(join(ROOT, file), "utf8"))
      .join("\n");
    expect([...corpus.matchAll(CONTRACT_SYMBOL)].length).toBe(6);
    expect(scanContractDeclarations(ROOT)).toHaveLength(3);
  });

  test("a new declaration fails naming its source and adapter", () => {
    const root = writeTempTree({
      [`${ADAPTERS_SRC}/github/capabilities.ts`]: capabilityFile(
        "github",
        "GITHUB_ADAPTER_CONTRACT",
      ),
      [`${ADAPTERS_SRC}/gitlab/capabilities.ts`]: capabilityFile(
        "gitlab",
        "GITLAB_ADAPTER_CONTRACT",
      ),
      [`${ADAPTERS_SRC}/jira/capabilities.ts`]: capabilityFile("jira", "JIRA_ADAPTER_CONTRACT"),
      [`${ADAPTERS_SRC}/example/capabilities.ts`]: capabilityFile(
        "example",
        "EXAMPLE_ADAPTER_CONTRACT",
      ),
      [`${ADAPTERS_SRC}/example/index.ts`]:
        'export { EXAMPLE_ADAPTER_CONTRACT } from "./capabilities.js";\n',
    });
    try {
      const declarations = scanContractDeclarations(root);
      expect(declarations).toHaveLength(4);
      const failures = registrationViolations(declarations, CONFORMANCE_ADAPTERS);
      expect(
        failures.some(
          (message) => message.includes("example/capabilities.ts") && message.includes("example"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an index.ts-only re-export adds zero declarations", () => {
    const root = writeTempTree({
      [`${ADAPTERS_SRC}/github/capabilities.ts`]: capabilityFile(
        "github",
        "GITHUB_ADAPTER_CONTRACT",
      ),
      [`${ADAPTERS_SRC}/gitlab/capabilities.ts`]: capabilityFile(
        "gitlab",
        "GITLAB_ADAPTER_CONTRACT",
      ),
      [`${ADAPTERS_SRC}/jira/capabilities.ts`]: capabilityFile("jira", "JIRA_ADAPTER_CONTRACT"),
      [`${ADAPTERS_SRC}/example/index.ts`]:
        'export { GITHUB_ADAPTER_CONTRACT as EXAMPLE_ADAPTER_CONTRACT } from "../github/capabilities.js";\n',
      [`${ADAPTERS_SRC}/io/index.ts`]: "export const PROVIDER_TRANSPORT = 1;\n",
    });
    try {
      expect(scanContractDeclarations(root)).toHaveLength(3);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a dangling registration fails naming the registration", () => {
    const root = writeTempTree({
      [`${ADAPTERS_SRC}/github/capabilities.ts`]: capabilityFile(
        "github",
        "GITHUB_ADAPTER_CONTRACT",
      ),
      [`${ADAPTERS_SRC}/gitlab/capabilities.ts`]: capabilityFile(
        "gitlab",
        "GITLAB_ADAPTER_CONTRACT",
      ),
      [`${ADAPTERS_SRC}/jira/capabilities.ts`]: capabilityFile("jira", "JIRA_ADAPTER_CONTRACT"),
    });
    try {
      const declarations = scanContractDeclarations(root);
      const mutated = [
        ...CONFORMANCE_ADAPTERS,
        { provider: "example", contract: JIRA_ADAPTER_CONTRACT, buildClient: () => ({}) },
      ];
      expect(
        registrationViolations(declarations, mutated).some(
          (message) =>
            message.includes("registration example") &&
            message.includes("names no declared provider contract"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("non-provider modules and placeholders do not false-positive", () => {
    const root = writeTempTree({
      [`${ADAPTERS_SRC}/io/index.ts`]: "export const PROVIDER_TRANSPORT = 1;\n",
      [`${ADAPTERS_SRC}/azure/index.ts`]: "export const AZURE_PLACEHOLDER = 1;\n",
      [`${ADAPTERS_SRC}/registry/index.ts`]: "export const REGISTRY = 1;\n",
    });
    try {
      expect(scanContractDeclarations(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// TC-CONF-004 / TC-CONF-005 — adapter-level structural coverage
// ---------------------------------------------------------------------------

const flowsWithout = (predicate: (operation: string) => boolean): unknown[] =>
  CONFORMANCE_FLOWS.map((flow) => ({
    ...flow,
    steps: flow.steps.filter((step) => !predicate(step.operation)),
  }));

describe("TC-CONF-004 structural step and carrier coverage", () => {
  test("every supported operation and declared gap has at least one step", () => {
    expect(
      structuralCoverageViolations({ flows: CONFORMANCE_FLOWS, adapters: CONFORMANCE_ADAPTERS }),
    ).toEqual([]);
    const operations = new Set(
      CONFORMANCE_FLOWS.flatMap((flow) => flow.steps.map((step) => step.operation)),
    );
    for (const registration of CONFORMANCE_ADAPTERS) {
      for (const operation of registration.contract.capabilities.supportedOperations) {
        expect(operations.has(operation), `${registration.provider}:${operation}`).toBe(true);
      }
      for (const gap of registration.contract.capabilities.declaredGaps) {
        expect(operations.has(gap.operation), `${registration.provider}:${gap.operation}`).toBe(
          true,
        );
      }
    }
  });

  test("the shipped adapters declare no carriers and the carrier step stays registered", () => {
    for (const registration of CONFORMANCE_ADAPTERS) {
      expect(registration.contract.capabilities.writableCarriers).toEqual([]);
      expect(registration.contract.capabilities.readableCarriers).toEqual([]);
    }
    const carrierSteps = CONFORMANCE_FLOWS.flatMap((flow) =>
      flow.steps.filter((step) => step.requiresCarrier === true),
    );
    expect(carrierSteps.map((step) => step.stepId)).toEqual([
      "comment-provenance.carrier-roundtrip",
    ]);
  });

  test("a declared carrier without a carrier step fails by provider", () => {
    const flows = CONFORMANCE_FLOWS.map((flow) => ({
      ...flow,
      steps: flow.steps.filter((step) => step.requiresCarrier !== true),
    }));
    const adapter = {
      provider: "github",
      contract: {
        adapterName: "github",
        systemKind: "vcs",
        capabilities: {
          supportedOperations: ["read-work-item"],
          declaredGaps: ["write-work-item"],
          writableCarriers: ["invisible-comment-block"],
          readableCarriers: ["invisible-comment-block"],
        },
      },
    };
    expect(
      structuralCoverageViolations({ flows, adapters: [adapter] }).some((message) =>
        message.includes("github: declared carrier has no carrier step"),
      ),
    ).toBe(true);
  });

  test("removing the only step for a supported operation fails by provider and operation", () => {
    const violations = structuralCoverageViolations({
      flows: flowsWithout((operation) => operation === "read-work-item"),
      adapters: CONFORMANCE_ADAPTERS,
    });
    expect(
      violations.some((message) =>
        message.includes("github: supported operation read-work-item has no step"),
      ),
    ).toBe(true);
  });

  test("removing the only step for a declared gap fails by provider and operation", () => {
    const violations = structuralCoverageViolations({
      flows: flowsWithout((operation) => operation === "write-comment"),
      adapters: CONFORMANCE_ADAPTERS,
    });
    expect(
      violations.some((message) =>
        message.includes("github: declared gap write-comment has no step"),
      ),
    ).toBe(true);
  });
});

describe("TC-CONF-005 structural non-vacuity floors", () => {
  test("exact sets are complete and every adapter participates in every operation", () => {
    expect(CONFORMANCE_FLOWS).toHaveLength(3);
    expect(CONFORMANCE_ADAPTERS).toHaveLength(3);
    expect(
      structuralCoverageViolations({ flows: CONFORMANCE_FLOWS, adapters: CONFORMANCE_ADAPTERS }),
    ).toEqual([]);
    expect(CONFORMANCE_FLOWS.every((flow) => flow.steps.length > 0)).toBe(true);
  });

  test("an empty registry fails with a non-vacuity message", () => {
    expect(
      structuralCoverageViolations({ flows: [], adapters: CONFORMANCE_ADAPTERS }).some((message) =>
        message.includes("flows: registry is empty"),
      ),
    ).toBe(true);
  });

  test("an empty flow fails with a non-vacuity message", () => {
    const mutated = [{ flowId: "empty-flow", name: "Empty", steps: [] }];
    expect(
      structuralCoverageViolations({ flows: mutated, adapters: CONFORMANCE_ADAPTERS }).some(
        (message) => message.includes("empty-flow: flow has no steps"),
      ),
    ).toBe(true);
  });

  test("removing all steps for one operation fails naming the operation", () => {
    expect(
      structuralCoverageViolations({
        flows: flowsWithout((operation) => operation === "transition-work-item"),
        adapters: CONFORMANCE_ADAPTERS,
      }).some((message) => message.includes("missing operation transition-work-item")),
    ).toBe(true);
  });

  test("removing all adapters fails with a non-vacuity message", () => {
    expect(
      structuralCoverageViolations({ flows: CONFORMANCE_FLOWS, adapters: [] }).some((message) =>
        message.includes("adapters: registration set is empty"),
      ),
    ).toBe(true);
  });

  test("an adapter with zero supported operations and zero gaps fails", () => {
    const adapter = {
      provider: "github",
      contract: {
        adapterName: "github",
        systemKind: "vcs",
        capabilities: {
          supportedOperations: [],
          declaredGaps: [],
          writableCarriers: [],
          readableCarriers: [],
        },
      },
    };
    expect(
      structuralCoverageViolations({ flows: CONFORMANCE_FLOWS, adapters: [adapter] }).some(
        (message) => message.includes("github: adapter declares no operations"),
      ),
    ).toBe(true);
  });

  test("the gates do not compare against a moving base ref", () => {
    for (const file of [
      "packages/testkit/src/conformance/coverage.ts",
      "packages/testkit/src/conformance/runner.ts",
    ]) {
      const source = readFileSync(join(ROOT, file), "utf8");
      expect(source.includes("origin/main-tools"), file).toBe(false);
    }
  });
});
