/**
 * TC-REF-001..006 — the adapter reference-behavior surface is current truth and
 * mechanically agrees with the declarations it documents.
 *
 * The document is parsed through one locator fixture; every comparison asserts
 * its extraction count before comparing, so a vacuous parse fails. Each case
 * carries a one-row/one-digit mutation that must fail by name.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GITHUB_ADAPTER_CONTRACT } from "../../packages/adapters/src/github/capabilities";
import {
  GITHUB_CLI_REFUSAL_CODES,
  GITHUB_TRANSPORT_MATRIX,
  githubCliHostname,
} from "../../packages/adapters/src/github/cli-transport";
import { GITHUB_LOG_EXCERPT_MAX_BYTES } from "../../packages/adapters/src/github/log-excerpt";
import {
  GITHUB_THREAD_DISCUSSION_MAX_BODY_BYTES,
  GITHUB_THREAD_DISCUSSION_MAX_COMMENTS,
} from "../../packages/adapters/src/github/thread-discussion";
import { GITHUB_WORKFLOW_MAP_SEED } from "../../packages/adapters/src/github/workflow-map";
import { GITLAB_ADAPTER_CONTRACT } from "../../packages/adapters/src/gitlab/capabilities";
import { JIRA_ADAPTER_CONTRACT } from "../../packages/adapters/src/jira/capabilities";
import {
  ADAPTER_OPERATIONS,
  type AdapterContract,
  type AdapterOperation,
} from "../../packages/core/src/contracts/index";
import { PRODUCTION_CATALOG } from "../../packages/core/src/index";
import { arrayField, isRecord, readJson } from "../behaviour/providers/support";
import {
  REFERENCE_BEHAVIOR_DOCUMENT,
  REFERENCE_BEHAVIOR_HOST_MAPPING_FIXTURE,
  REFERENCE_BEHAVIOR_INDEX,
  REFERENCE_BEHAVIOR_INDEX_TARGET,
  REFERENCE_BEHAVIOR_ISOLATION_VARIABLES,
  REFERENCE_BEHAVIOR_SECTIONS,
  REFERENCE_BEHAVIOR_TABLE_HEADERS,
} from "../fixtures/provider/reference-behavior";

const ROOT = process.cwd();

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const documentText = (): string => read(REFERENCE_BEHAVIOR_DOCUMENT);

const sectionOf = (text: string, heading: string): string | undefined => {
  const start = text.indexOf(heading);
  if (start === -1) return undefined;
  const next = text.indexOf("\n## ", start + heading.length);
  return next === -1 ? text.slice(start) : text.slice(start, next);
};

const cellsOf = (line: string): string[] =>
  line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.replace(/`/gu, "").trim());

const tableOf = (section: string): string[][] =>
  section
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => cellsOf(line))
    .filter((cells) => !cells.every((cell) => /^:?-{2,}:?$/u.test(cell)));

/** The table blocks of one section: one row list per markdown table. */
const tableBlocksOf = (section: string): string[][][] =>
  section
    .split(/\n\s*\n/u)
    .map((block) =>
      block
        .split("\n")
        .filter((line) => line.trim().startsWith("|"))
        .map((line) => cellsOf(line))
        .filter((cells) => !cells.every((cell) => /^:?-{2,}:?$/u.test(cell))),
    )
    .filter((rows) => rows.length > 0);

/** The rows of the one table in `section` whose header equals `header`. */
const tableWithHeader = (
  section: string,
  header: readonly string[],
): readonly string[][] | undefined =>
  tableBlocksOf(section)
    .find((rows) => (rows[0] ?? []).join("|") === header.join("|"))
    ?.slice(1);

const REQUIRED_HEADERS = REFERENCE_BEHAVIOR_TABLE_HEADERS;

const headerFailure = (
  label: string,
  rows: readonly string[][],
  expected: readonly string[],
  expectedRows: number,
): string[] => {
  const failures: string[] = [];
  if (rows.length === 0) return [`${label}: table not found`];
  const header = rows[0] ?? [];
  if (header.join("|") !== expected.join("|")) {
    failures.push(`${label}: header ${header.join("|")} != ${expected.join("|")}`);
  }
  if (rows.length - 1 !== expectedRows) {
    failures.push(`${label}: ${rows.length - 1} rows != ${expectedRows}`);
  }
  return failures;
};

const transportFailures = (text: string): string[] => {
  const failures = [
    ...headerFailure(
      "transports",
      tableOf(sectionOf(text, REFERENCE_BEHAVIOR_SECTIONS.transports) ?? ""),
      REQUIRED_HEADERS.transports,
      ADAPTER_OPERATIONS.length,
    ),
  ];
  const rows = tableOf(sectionOf(text, REFERENCE_BEHAVIOR_SECTIONS.transports) ?? "").slice(1);
  const documented = rows.map((cells) => cells[0] ?? "");
  if ([...documented].sort().join(",") !== [...ADAPTER_OPERATIONS].sort().join(",")) {
    failures.push(`transports: operation set ${documented.join(",")} != closed set`);
  }
  for (const cells of rows) {
    const operation = cells[0] as AdapterOperation;
    const entry = GITHUB_TRANSPORT_MATRIX[operation];
    if (entry === undefined) {
      failures.push(`transports: unknown operation ${cells[0]}`);
      continue;
    }
    if (entry.preferred !== cells[1] || entry.fallback !== cells[2]) {
      failures.push(
        `document row ${cells[0]} -> ${cells[1]}/${cells[2]} != ${entry.preferred}/${entry.fallback}`,
      );
    }
  }
  return failures;
};

const CONTRACTS: Readonly<Record<string, AdapterContract>> = {
  github: GITHUB_ADAPTER_CONTRACT,
  gitlab: GITLAB_ADAPTER_CONTRACT,
  jira: JIRA_ADAPTER_CONTRACT,
};

const capabilityFailures = (text: string): string[] => {
  const rows = tableOf(sectionOf(text, REFERENCE_BEHAVIOR_SECTIONS.capabilities) ?? "");
  const failures = [...headerFailure("capabilities", rows, REQUIRED_HEADERS.capabilities, 3)];
  for (const cells of rows.slice(1)) {
    const adapter = cells[0] ?? "";
    const contract = CONTRACTS[adapter];
    if (contract === undefined) {
      failures.push(`capabilities: unknown adapter ${adapter}`);
      continue;
    }
    const capabilities = contract.capabilities;
    if (Number(cells[1]) !== capabilities.supportedOperations.length) {
      failures.push(
        `document row ${adapter} -> ${cells[1]} supported != ${capabilities.supportedOperations.length}`,
      );
    }
    if (Number(cells[2]) !== capabilities.declaredGaps.length) {
      failures.push(
        `document row ${adapter} -> ${cells[2]} gaps != ${capabilities.declaredGaps.length}`,
      );
    }
    const documentedReasons =
      (cells[3] ?? "") === "none"
        ? []
        : (cells[3] ?? "")
            .split(";")
            .map((reason) => reason.trim())
            .filter((reason) => reason.length > 0)
            .sort();
    const machineReasons = [...new Set(capabilities.declaredGaps.map((gap) => gap.reason))].sort();
    if (documentedReasons.join(",") !== machineReasons.join(",")) {
      failures.push(
        `document row ${adapter} -> reasons ${documentedReasons.join(",")} != ${machineReasons.join(",")}`,
      );
    }
  }
  return failures;
};

const ABSENCE_BINDINGS: readonly (readonly [string, string, string])[] = [
  ["PipelineJob.startedAt", "packages/core/src/contracts/ports.ts", "readonly startedAt?: string;"],
  [
    "PipelineJob.completedAt",
    "packages/core/src/contracts/ports.ts",
    "readonly completedAt?: string;",
  ],
  ["DeliveryRequest.headSha", "packages/core/src/contracts/ports.ts", "readonly headSha?: string;"],
  ["DeliveryThread", "packages/core/src/contracts/ports.ts", "readonly authorLogin?: string;"],
  [
    "WorkItem.comments",
    "packages/core/src/contracts/ports.ts",
    "readonly comments?: readonly WorkItemComment[];",
  ],
  ["WorkItem.updatedAt", "packages/core/src/contracts/ports.ts", "readonly updatedAt?: string;"],
  ["pageItemCount", "packages/adapters/src/github/client.ts", "readonly pageItemCount: number;"],
  [
    "signals.relations",
    "packages/core/src/contracts/closeout.ts",
    'readonly relations?: "observed" | "unavailable" | "unknown";',
  ],
  ["mergeCommitSha", "packages/core/src/contracts/ports.ts", "readonly mergeCommitSha?: string;"],
];

const absenceFailures = (text: string): string[] => {
  const section = sectionOf(text, REFERENCE_BEHAVIOR_SECTIONS.absence) ?? "";
  const rows = tableOf(section);
  const failures: string[] = [];
  if (rows.length - 1 < 6) failures.push(`absence: ${rows.length - 1} rows < 6 documented signals`);
  const header = rows[0] ?? [];
  if (header.join("|") !== REQUIRED_HEADERS.absence.join("|")) {
    failures.push(`absence: header ${header.join("|")} != ${REQUIRED_HEADERS.absence.join("|")}`);
  }
  for (const cells of rows.slice(1)) {
    if ((cells[0] ?? "").length === 0) failures.push("absence: empty signal row");
    if ((cells[0] ?? "").includes("durationMs")) {
      failures.push("absence: durationMs is not an absence signal");
    }
  }
  for (const [signal, source, snippet] of ABSENCE_BINDINGS) {
    if (!section.includes(signal)) {
      failures.push(`absence: ${signal} is not documented`);
      continue;
    }
    if (!read(source).includes(snippet)) {
      failures.push(`absence: ${signal} -> code lost \`${snippet}\``);
    }
  }
  if (read("packages/core/src/contracts/ports.ts").includes("durationMs")) {
    failures.push("absence: the contract declares durationMs");
  }
  return failures;
};

const EVIDENCE_CLAIMS: readonly string[] = [
  "Bodies and log excerpts are evidence, never lifecycle truth, and carry no write authority.",
  "The adapter never persists, renders, logs, or captures an excerpt or a comment body in the conformance artifact",
  "any consumer surface that renders provider text routes it through the single redaction chokepoint.",
];

const evidenceFailures = (text: string): string[] => {
  const discussion = sectionOf(text, REFERENCE_BEHAVIOR_SECTIONS.discussion);
  const excerpt = sectionOf(text, REFERENCE_BEHAVIOR_SECTIONS.excerpt);
  const failures: string[] = [];
  if (discussion === undefined) failures.push("evidence: discussion section is missing");
  if (excerpt === undefined) failures.push("evidence: excerpt section is missing");
  const combined = `${discussion ?? ""}\n${excerpt ?? ""}`;
  if (!combined.includes("Review-thread discussion")) {
    failures.push("evidence: discussion table row is missing");
  }
  if (!combined.includes("Failure log excerpt")) {
    failures.push("evidence: excerpt table row is missing");
  }
  if (!combined.includes(String(GITHUB_THREAD_DISCUSSION_MAX_COMMENTS))) {
    failures.push("document row discussion -> comment cap != machine value");
  }
  if (!combined.includes(String(GITHUB_THREAD_DISCUSSION_MAX_BODY_BYTES))) {
    failures.push("document row discussion -> body cap != machine value");
  }
  if (!combined.includes(String(GITHUB_LOG_EXCERPT_MAX_BYTES))) {
    failures.push("document row excerpt -> cap != machine value");
  }
  for (const claim of EVIDENCE_CLAIMS) {
    if (!combined.includes(claim))
      failures.push(`evidence: missing claim "${claim.slice(0, 40)}..."`);
  }
  if (!combined.includes("GitLab and Jira take an explicit same-behavior-or-absent position")) {
    failures.push("evidence: the other-adapter position is missing");
  }
  return failures;
};

const PROBE_CLAIMS: readonly string[] = [
  "The probe runs at composition time only; it never runs at module load, never per request, never on a self-description path that does not compose, and never in the mock tier.",
  "the value is never persisted and renders exactly one diagnostic line naming the refusal code",
  "There is no per-request failover: a mid-run CLI failure is a classified transport failure and a write is never re-issued on the other transport.",
  "`prefer-cli` (default) or `api-only`",
];

const probeFailures = (text: string): string[] => {
  const section = sectionOf(text, REFERENCE_BEHAVIOR_SECTIONS.transport) ?? "";
  const rows = tableOf(section);
  const probeRows = rows.filter((cells) => (cells[0] ?? "").startsWith("provider.cli."));
  const failures: string[] = [];
  const documented = probeRows.map((cells) => cells[0] ?? "").sort();
  const machine = [...GITHUB_CLI_REFUSAL_CODES].sort();
  if (documented.join(",") !== machine.join(",")) {
    failures.push(`document row probe codes -> ${documented.join(",")} != ${machine.join(",")}`);
  }
  if (documented.length !== machine.length) {
    failures.push(`probe: ${documented.length} documented codes != ${machine.length}`);
  }
  for (const claim of PROBE_CLAIMS) {
    if (!section.includes(claim))
      failures.push(`transport: missing claim "${claim.slice(0, 40)}..."`);
  }
  return failures;
};

const declaredHostMapping = (): readonly {
  readonly instanceHost: string;
  readonly cliHost: string;
}[] => {
  const parsed = readJson(REFERENCE_BEHAVIOR_HOST_MAPPING_FIXTURE);
  if (!isRecord(parsed) || !Array.isArray(parsed.hostMapping)) {
    throw new Error("cli-argv fixture has no hostMapping block");
  }
  return parsed.hostMapping
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => ({ instanceHost: String(entry.instanceHost), cliHost: String(entry.cliHost) }));
};

/**
 * The documented host mapping agrees with the exported mapping function.
 *
 * The extraction count is asserted against the fixture's declared rows before
 * any comparison, so a deleted or vacuous host table fails; and the rows are
 * matched by instance host, so a documented identity change fails by name.
 */
const hostFailures = (text: string): string[] => {
  const section = sectionOf(text, REFERENCE_BEHAVIOR_SECTIONS.transport) ?? "";
  const rows = tableWithHeader(section, REQUIRED_HEADERS.hosts);
  const expected = declaredHostMapping();
  const failures: string[] = [];
  if (rows === undefined) return ["hosts: the host-mapping table is missing"];
  if (rows.length !== expected.length) {
    failures.push(`hosts: ${rows.length} documented rows != ${expected.length} declared rows`);
  }
  const byHost = new Map(expected.map((row) => [row.instanceHost, row.cliHost]));
  for (const cells of rows) {
    const instanceHost = cells[0] ?? "";
    const documented = cells[1] ?? "";
    const machine = githubCliHostname(instanceHost);
    if (documented !== machine) {
      failures.push(`document row ${instanceHost} -> ${documented} != ${machine}`);
    }
    const declared = byHost.get(instanceHost);
    if (declared === undefined) {
      failures.push(`hosts: ${instanceHost} is not a declared mapping row`);
      continue;
    }
    if (documented !== declared) {
      failures.push(`document row ${instanceHost} -> ${documented} != ${declared}`);
    }
  }
  for (const instanceHost of byHost.keys()) {
    if (!rows.some((cells) => (cells[0] ?? "") === instanceHost)) {
      failures.push(`hosts: ${instanceHost} is not documented`);
    }
  }
  if (!rows.some((cells) => (cells[0] ?? "") !== (cells[1] ?? ""))) {
    failures.push("hosts: every documented row is an identity mapping");
  }
  return failures;
};

/**
 * The documented isolation row agrees with the constructed environment.
 *
 * The document must name every path-valued variable the transport sets and the
 * one variable it deliberately does not forward; the source must still set them
 * and still refuse to forward `HOME`, so neither side can drift silently.
 */
const isolationFailures = (text: string): string[] => {
  const section = sectionOf(text, REFERENCE_BEHAVIOR_SECTIONS.transport) ?? "";
  const rows = tableWithHeader(section, ["Aspect", "Reference behavior"]);
  const row = rows?.find((cells) => (cells[0] ?? "") === "Child environment");
  const failures: string[] = [];
  if (row === undefined) return ["child environment: the documented row is missing"];
  const documented = (row[1] ?? "").toLowerCase();
  const source = read("packages/adapters/src/github/cli-transport.ts");
  for (const variable of REFERENCE_BEHAVIOR_ISOLATION_VARIABLES) {
    if (!documented.includes(variable.toLowerCase())) {
      failures.push(`child environment: ${variable} is not documented`);
    }
  }
  for (const variable of ["GH_CONFIG_DIR", "XDG_CONFIG_HOME", "XDG_STATE_HOME", "XDG_CACHE_HOME"]) {
    if (!source.includes(variable)) {
      failures.push(`child environment: the transport no longer sets ${variable}`);
    }
  }
  for (const directory of ["jaiship-gh-config", "jaiship-gh-state", "jaiship-gh-cache"]) {
    if (!source.includes(directory)) {
      failures.push(`child environment: the transport no longer isolates ${directory}`);
    }
    if (!new RegExp(`${directory}(?![\\w-])`, "u").test(documented)) {
      failures.push(`child environment: ${directory} is not documented`);
    }
  }
  if (!source.includes("tmpdir()")) {
    failures.push("child environment: the transport lost its absolute base fallback");
  }
  if (/\bHOME\s*:/u.test(source)) {
    failures.push("child environment: the transport forwards HOME");
  }
  if (!documented.includes("home")) {
    failures.push("child environment: the not-forwarded HOME rule is not documented");
  }
  return failures;
};

const seedFailures = (text: string): string[] => {
  const section = sectionOf(text, REFERENCE_BEHAVIOR_SECTIONS.mapping) ?? "";
  const rows = tableOf(section).filter((cells) => /^\d+$/u.test(cells[0] ?? ""));
  const failures: string[] = [];
  if (rows.length !== GITHUB_WORKFLOW_MAP_SEED.states.length) {
    failures.push(`seed: ${rows.length} rows != ${GITHUB_WORKFLOW_MAP_SEED.states.length}`);
  }
  for (const [index, cells] of rows.entries()) {
    const row = GITHUB_WORKFLOW_MAP_SEED.states[index];
    if (row === undefined) {
      failures.push(`seed: unexpected row ${index + 1}`);
      continue;
    }
    if (
      cells[1] !== row.nativeStatus ||
      cells[2] !== row.deliveryState ||
      cells[3] !== row.transitionMechanism
    ) {
      failures.push(
        `document row ${cells[1]} -> ${cells[2]}/${cells[3]} != ${row.nativeStatus}/${row.deliveryState}/${row.transitionMechanism}`,
      );
    }
  }
  return failures;
};

const mappingCases = (): {
  readonly tokens: readonly string[];
  readonly aliases: readonly string[];
} => {
  const fixture = readJson("tests/fixtures/providers/github/workflow-map-cases.json");
  return {
    tokens: arrayField(fixture, "unmappedTokens").map((token) => String(token)),
    aliases: arrayField(fixture, "unmappedAliases").map((alias) => String(alias)),
  };
};

const backticked = (value: string | undefined): string[] =>
  [...(value ?? "").matchAll(/`([^`]+)`/gu)].map((match) => match[1] ?? "");

const unmappedFailures = (text: string): string[] => {
  const section = sectionOf(text, REFERENCE_BEHAVIOR_SECTIONS.mapping) ?? "";
  const expected = mappingCases();
  const documentedTokens = backticked(
    section.match(/deliberately unmapped tokens are (.+?);/u)?.[1],
  );
  const documentedAliases = backticked(
    section.match(/deliberately unmapped aliases are (.+?)\./u)?.[1],
  );
  const failures: string[] = [];
  if (documentedTokens.join(",") !== expected.tokens.join(",")) {
    failures.push(
      `document row unmapped tokens -> ${documentedTokens.join(",")} != ${expected.tokens.join(",")}`,
    );
  }
  if (documentedAliases.join(",") !== expected.aliases.join(",")) {
    failures.push(
      `document row unmapped aliases -> ${documentedAliases.join(",")} != ${expected.aliases.join(",")}`,
    );
  }
  return failures;
};

const MAPPING_CLAIMS: readonly string[] = [
  "Only a `label-swap` transition changes labels and refuses on an unavailable label signal.",
  "every other label in the supplied current read is preserved",
  "a label another actor adds between that read and the write is not preserved",
  "The writable aliases are `done` plus each declared `label-swap` row's alias; a declared non-terminal `field-update` alias is readable but read-only.",
  "A `label-swap` write to an issue whose current read resolves to `done` refuses with a named typed failure and zero provider requests, regardless of the issue's labels;",
  "which the caller supplies as adapter-local input data; the adapter issues no read to obtain it, so every refusal costs zero provider requests.",
  "The map is validated exactly once per client construction on the resolved map, before the first operation;",
  "four declared outcomes",
];

const mappingClaimFailures = (text: string): string[] => {
  const section = sectionOf(text, REFERENCE_BEHAVIOR_SECTIONS.mapping) ?? "";
  return MAPPING_CLAIMS.filter((claim) => !section.includes(claim)).map(
    (claim) => `mapping: missing claim "${claim.slice(0, 48)}..."`,
  );
};

describe("TC-REF-001 the surface documents every closed operation and evidence read", () => {
  test("the document exists, is linked from the index, and covers ten operations", () => {
    const text = documentText();
    expect(text.length).toBeGreaterThan(1000);
    expect(read(REFERENCE_BEHAVIOR_INDEX)).toContain(`](${REFERENCE_BEHAVIOR_INDEX_TARGET})`);
    const rows = tableOf(sectionOf(text, REFERENCE_BEHAVIOR_SECTIONS.transports) ?? "").slice(1);
    expect(rows).toHaveLength(ADAPTER_OPERATIONS.length);
    for (const section of [
      REFERENCE_BEHAVIOR_SECTIONS.discussion,
      REFERENCE_BEHAVIOR_SECTIONS.excerpt,
    ]) {
      expect(sectionOf(text, section), section).toBeDefined();
    }
  });

  test("deleting an operation row fails naming the row", () => {
    const text = documentText();
    const mutated = text.replace("| `write-comment` | `gh` | `api` |\n", "");
    expect(mutated).not.toBe(text);
    expect(transportFailures(mutated).some((failure) => failure.includes("9 rows"))).toBe(true);
  });
});

describe("TC-REF-002 documented transports, caps, and gaps agree with the declarations", () => {
  test("every documented transport, posture, and cap equals the machine value", () => {
    const text = documentText();
    expect(transportFailures(text)).toEqual([]);
    expect(capabilityFailures(text)).toEqual([]);
    expect(evidenceFailures(text)).toEqual([]);
    expect(hostFailures(text)).toEqual([]);
    expect(isolationFailures(text)).toEqual([]);
  });

  test("a one-digit cap change and a transport change fail naming the row", () => {
    const text = documentText();
    const capMutation = text.replaceAll(String(GITHUB_LOG_EXCERPT_MAX_BYTES), "8191");
    expect(evidenceFailures(capMutation).some((failure) => failure.includes("excerpt"))).toBe(true);
    const transportMutation = text.replace(
      "| `read-work-item` | `gh` | `api` |",
      "| `read-work-item` | `api` | `gh` |",
    );
    expect(
      transportFailures(transportMutation).some((failure) => failure.includes("read-work-item")),
    ).toBe(true);

    // A documented host or isolation value that drifts from the machine value
    // fails by name, and deleting the cloud row fails the extraction count.
    const hostMutation = text.replace(
      "| `api.github.com` | `github.com` |",
      "| `api.github.com` | `api.github.com` |",
    );
    expect(hostMutation).not.toBe(text);
    expect(hostFailures(hostMutation).some((failure) => failure.includes("api.github.com"))).toBe(
      true,
    );
    const deletedHostRow = text.replace("| `api.github.com` | `github.com` |\n", "");
    expect(deletedHostRow).not.toBe(text);
    expect(
      hostFailures(deletedHostRow).some((failure) => failure.includes("documented rows")),
    ).toBe(true);
    const isolationMutation = text.replace(
      "`XDG_STATE_HOME` is `<base>/jaiship-gh-state`",
      "`XDG_STATE_HOME` is `<base>/jaiship-gh-state-x`",
    );
    expect(isolationMutation).not.toBe(text);
    expect(
      isolationFailures(isolationMutation).some((failure) => failure.includes("jaiship-gh-state")),
    ).toBe(true);
  });
});

describe("TC-REF-003 documented absence semantics agree with the code", () => {
  test("each absence row binds to a named property and no duration exists", () => {
    expect(absenceFailures(documentText())).toEqual([]);
  });

  test("adding a durationMs row fails the absence check", () => {
    const text = documentText();
    const mutated = text.replace(
      "| `pageItemCount` |",
      "| `PipelineJob.durationMs` | absent | derived |\n| `pageItemCount` |",
    );
    expect(absenceFailures(mutated).some((failure) => failure.includes("durationMs"))).toBe(true);
  });
});

describe("TC-REF-004 evidence and other-adapter positions are stated", () => {
  test("the evidence statements and both other adapters are present as parsed claims", () => {
    expect(evidenceFailures(documentText())).toEqual([]);
  });

  test("deleting the write-authority sentence fails", () => {
    const text = documentText();
    const mutated = text.replace(
      "Bodies and log excerpts are evidence, never lifecycle truth, and carry no write authority.",
      "",
    );
    expect(
      evidenceFailures(mutated).some((failure) => failure.includes("Bodies and log excerpts")),
    ).toBe(true);
  });
});

describe("TC-REF-005 probe, selection value, refusals, and no-failover agree with the code", () => {
  test("the closed probe codes and the four prose obligations are present", () => {
    expect(probeFailures(documentText())).toEqual([]);
  });

  test("a fourth documented code and a deleted no-failover sentence fail", () => {
    const text = documentText();
    const fourthCode = text.replace(
      "| `provider.cli.capability-unsupported` | the binary is present but cannot provide the declared capability |",
      "| `provider.cli.capability-unsupported` | the binary is present but cannot provide the declared capability |\n| `provider.cli.unsupported-host` | an extra code |",
    );
    expect(probeFailures(fourthCode).some((failure) => failure.includes("probe codes"))).toBe(true);
    const noFailover = text.replace(
      "There is no per-request failover: a mid-run CLI failure is a classified transport failure and a write is never re-issued on the other transport.",
      "",
    );
    expect(
      probeFailures(noFailover).some((failure) => failure.includes("no per-request failover")),
    ).toBe(true);
  });
});

describe("TC-REF-006 mapping documentation agrees with the seed and states the rules", () => {
  test("the seed rows, unmapped sets, and mapping rules are exact", () => {
    const text = documentText();
    expect(seedFailures(text)).toEqual([]);
    expect(unmappedFailures(text)).toEqual([]);
    expect(mappingClaimFailures(text)).toEqual([]);
  });

  test("reordering a seed row and dropping an unmapped token fail", () => {
    const text = documentText();
    const reordered = text.replace(
      "| 1 | `closed` | `done` | `field-update` |\n| 2 | `review` | `in-review` | `label-swap` |",
      "| 1 | `review` | `in-review` | `label-swap` |\n| 2 | `closed` | `done` | `field-update` |",
    );
    expect(seedFailures(reordered).some((failure) => failure.includes("document row"))).toBe(true);
    const droppedToken = text.replace("`delivered`, `blocked`,", "`blocked`,");
    expect(
      unmappedFailures(droppedToken).some((failure) => failure.includes("unmapped tokens")),
    ).toBe(true);
    const sweeping = text.replace(
      "Only a `label-swap` transition changes labels and refuses on an unavailable label signal.",
      "Every transition sweeps the declared lifecycle labels;",
    );
    expect(mappingClaimFailures(sweeping).some((failure) => failure.includes("label-swap"))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// TC-FLOOR-007 — the non-decision scope boundaries hold.
// ---------------------------------------------------------------------------

const listTs = (relative: string): string[] => {
  const entries = readdirSync(join(ROOT, relative), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const next = `${relative}/${entry.name}`;
    if (entry.isDirectory()) files.push(...listTs(next));
    else if (entry.name.endsWith(".ts")) files.push(next);
  }
  return files;
};

describe("TC-FLOOR-007 the change respects the declared non-decisions", () => {
  test("the lifecycle merge transaction composes the closed provider landing operation only", () => {
    const merge = read("packages/core/src/domain/merge-transaction.ts");
    // The reconciliation decision (GH-349 F-1): the lifecycle landing IS the
    // closed provider-side `merge-delivery-request` operation, so the
    // transaction's one landing port carries that operation's argument shape.
    expect(merge).toContain("MergeDeliveryRequestInput");
    // The pure domain module imports no adapter and no transport: the landing
    // arrives through an injected port, exactly like every other read.
    for (const forbidden of ["@delivery-os/adapters", "createGitHubClient"]) {
      expect(merge.includes(forbidden), forbidden).toBe(false);
    }
    // No local squash landing and no local refresh is composed anywhere on the
    // command path: both stay declared capabilities at the git seam.
    expect(merge.includes("squashLand")).toBe(false);
    expect(merge.includes("readonly refresh:")).toBe(false);
    for (const file of listTs("packages/core/src")) {
      if (file.endsWith("domain/merge-transaction.ts")) continue;
      const text = read(file);
      expect(text.includes("mergeDeliveryRequest"), file).toBe(false);
    }
  });

  test("no persistence schema or state record is added for the new behavior", () => {
    for (const file of listTs("packages/core/src/state")) {
      const text = read(file);
      for (const forbidden of [
        "workflow-map",
        "thread-discussion",
        "log-excerpt",
        "GithubTransportSelection",
      ]) {
        expect(text.includes(forbidden), `${file}:${forbidden}`).toBe(false);
      }
    }
  });

  test("no configuration surface is added for the transport or the mapping", () => {
    // GH-394 DM-5: the declarable tracker credential reference is a declared
    // github branch, not a transport or mapping surface. The adapter absence
    // still holds.
    expect(Object.keys(PRODUCTION_CATALOG).filter((key) => /adapter/iu.test(key))).toEqual([]);
    for (const file of listTs("packages/adapters/src/github")) {
      const text = read(file);
      for (const forbidden of ["process.env", "github.workflow", "PRODUCTION_CATALOG"]) {
        expect(text.includes(forbidden), `${file}:${forbidden}`).toBe(false);
      }
    }
  });

  test("DeliveryThread, DeliveryRequest, and WorkItem field sets are unchanged", () => {
    const ports = read("packages/core/src/contracts/ports.ts");
    const threadStart = ports.indexOf("export type DeliveryThread = {");
    const threadBlock = ports.slice(threadStart, ports.indexOf("};", threadStart));
    expect([...threadBlock.matchAll(/readonly (\w+)\??:/gu)].map((match) => match[1])).toEqual([
      "threadId",
      "resolved",
      "commentCount",
      "authorLogin",
      "authorKind",
      "authorAssociation",
    ]);
    const requestStart = ports.indexOf("export type DeliveryRequest = {");
    const requestBlock = ports.slice(requestStart, ports.indexOf("};", requestStart));
    expect([...requestBlock.matchAll(/readonly (\w+)\??:/gu)].map((match) => match[1])).toEqual([
      "identity",
      "sourceRef",
      "targetRef",
      "reviewState",
      "threads",
      "headSha",
      "sourceHeadSha",
      "mergeableState",
      "commitCount",
      "changedFileCount",
      // GH-349's one additive optional field.
      "title",
    ]);
    const workItemStart = ports.indexOf("export type WorkItem = {");
    const workItemBlock = ports.slice(workItemStart, ports.indexOf("};", workItemStart));
    expect([...workItemBlock.matchAll(/readonly (\w+)\??:/gu)].map((match) => match[1])).toEqual([
      "identity",
      "title",
      "status",
      "labels",
      "assignee",
      "relations",
      "comments",
      "milestone",
      "updatedAt",
    ]);
  });
});
