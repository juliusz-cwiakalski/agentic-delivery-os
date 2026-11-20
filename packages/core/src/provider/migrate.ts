/**
 * One-time legacy provider-policy migration (GH-350 F-6, DM-7; TDR-0059).
 *
 * The legacy files are parsed as DATA under one assignment-only grammar. Nothing
 * is executed, sourced, word-split, glob-expanded, evaluated, or shelled out; no
 * environment is read. A construct outside the grammar refuses the WHOLE run with
 * one identity, one closed reason, the source path and line, and no content.
 *
 * The credential firewall is name-first: a credential-shaped name is recognised
 * before its value is examined, the remainder of the line is discarded at the
 * parse boundary, and the only representable credential artifact is a reference
 * (a literal source-key name). No value of such a name is retained, compared,
 * logged, or emitted.
 *
 * The mapper is literal-to-literal under Appendix E's closed table, with two
 * named derivations: the per-agent model address (the declared profile literal
 * plus the lowercased agent token) and the credential reference name (the
 * credential-shaped variable name with its suffix removed and lowercased). Everything else is copied verbatim, and every
 * name that cannot be mapped is disclosed by name and omitted.
 */
import { PROVIDER_MIGRATE_SOURCE_MAX_BYTES, PROVIDER_MIGRATE_SOURCE_MAX_LINES } from "#contracts";

/** The closed refusal reasons (DM-7, Appendix E). */
export const PROVIDER_MIGRATE_REFUSAL_REASONS = [
  "no-source",
  "unreadable-source",
  "oversized-source",
  "shell-construct",
  "dynamic-value",
  "target-exists",
  "proposal-invalid",
  "no-checkout",
] as const;
export type ProviderMigrateRefusalReason = (typeof PROVIDER_MIGRATE_REFUSAL_REASONS)[number];

/** The credential-shaped name suffixes, checked before any value is examined. */
export const PROVIDER_MIGRATE_CREDENTIAL_SUFFIXES = [
  "_API_KEY",
  "_API_TOKEN",
  "_ACCESS_TOKEN",
  "_SECRET",
  "_PASSWORD",
  "_PRIVATE_KEY",
  "_CLIENT_SECRET",
] as const;

/**
 * The legacy→policy mapping is DATA (TDR-0059 D3): this pure module owns the
 * grammar, the firewall, and the mapper engine, while the vendor names and
 * their targets are supplied by the compatibility edge that reads the legacy
 * identity (`packages/adapters/src/file`). The provider tier therefore carries
 * no vendor constant, and a new legacy name is a table row rather than a branch.
 */
export type ProviderMigrateFlagRule = {
  readonly path: readonly string[];
  /** The accepted literal spellings and the boolean each one declares. */
  readonly values: Readonly<Record<string, boolean>>;
};

export type ProviderMigrateAgentModelRule = {
  readonly pattern: string;
  readonly profileVariable: string;
  readonly targetPrefix: readonly string[];
  readonly agentBefore: readonly string[];
  readonly agentAfter: readonly string[];
};

export type ProviderMigrateTable = {
  readonly strings: Readonly<Record<string, readonly string[]>>;
  readonly integers: Readonly<Record<string, readonly string[]>>;
  readonly flags: Readonly<Record<string, ProviderMigrateFlagRule>>;
  readonly unmapped: readonly string[];
  readonly agentModel?: ProviderMigrateAgentModelRule;
};

/** The proposal's one schema pointer; no generator metadata is emitted. */
export const PROVIDER_MIGRATE_PROPOSAL_SCHEMA = "delivery.config.v1" as const;

/** The project-committed document the proposal targets, relative to the checkout. */
export const PROVIDER_MIGRATE_TARGET_NAME = "config.yaml" as const;

export type ProviderMigrateRefusal = {
  readonly reason: ProviderMigrateRefusalReason;
  readonly source?: string;
  readonly line?: number;
  readonly summary: string;
};

export type ProviderMigrateSourceKind = "profiles" | "hook";

export type ProviderMigrateSourceFile = {
  readonly kind: ProviderMigrateSourceKind;
  readonly path: string;
  readonly text: string;
  readonly bytes: number;
  readonly lines: number;
};

export type ProviderMigrateSourceState = {
  readonly kind: ProviderMigrateSourceKind;
  readonly path: string;
  readonly state: "read" | "absent";
  readonly bytes?: number;
};

export type ProviderMigrateAssignment = {
  readonly name: string;
  readonly line: number;
  readonly source: string;
  /** Present only for a non-credential name; a credential value is discarded. */
  readonly value?: string;
  readonly credentialShaped: boolean;
};

export type ProviderMigrateParse =
  | { readonly ok: true; readonly assignments: readonly ProviderMigrateAssignment[] }
  | { readonly ok: false; readonly refusal: ProviderMigrateRefusal };

const refusal = (
  reason: ProviderMigrateRefusalReason,
  summary: string,
  source?: string,
  line?: number,
): ProviderMigrateRefusal => ({
  reason,
  summary,
  ...(source === undefined ? {} : { source }),
  ...(line === undefined ? {} : { line }),
});

/**
 * The typed `--write` refusal when no git checkout resolves from the invoking
 * directory. It is emitted only by the write path (the read-only path produces
 * its proposal wherever it runs) and it goes through the same `refusal` builder
 * as every other closed reason.
 */
export const providerMigrateNoCheckoutRefusal = (cwd: string): ProviderMigrateRefusal =>
  refusal(
    "no-checkout",
    "no git checkout resolves from the invoking directory; run the write inside a checkout",
    cwd,
  );

/** A credential-shaped name is classified before its value is examined. */
export const isCredentialShapedName = (name: string): boolean =>
  PROVIDER_MIGRATE_CREDENTIAL_SUFFIXES.some((suffix) => name.endsWith(suffix));

/**
 * The credential reference name: the variable name minus its credential suffix,
 * lowercased with underscores as hyphens. This is a declared derivation of a
 * *name*, never of a value.
 */
export const credentialReferenceName = (name: string): string => {
  const suffix = PROVIDER_MIGRATE_CREDENTIAL_SUFFIXES.find((candidate) => name.endsWith(candidate));
  const stem = suffix === undefined ? name : name.slice(0, -suffix.length);
  const reference = stem.toLowerCase().replaceAll("_", "-");
  return reference.length === 0 ? name.toLowerCase().replaceAll("_", "-") : reference;
};

const ASSIGNMENT = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u;
const DYNAMIC = /[$`]/u;
const SHELL_CHARACTER = /[\s;&|()<>[\]{}~\\*?]/u;
const unquote = (raw: string): string | { readonly construct: true } => {
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  if (raw.startsWith("'") || raw.startsWith('"')) return { construct: true };
  return raw;
};

/**
 * Parse one source under the declared grammar.
 *
 * A construct outside the grammar refuses the whole run. A credential-shaped
 * name is accepted after its `=` and its value is never inspected.
 */
export const parseProviderMigrateSource = (
  source: ProviderMigrateSourceFile,
): ProviderMigrateParse => {
  if (source.bytes > PROVIDER_MIGRATE_SOURCE_MAX_BYTES) {
    return {
      ok: false,
      refusal: refusal(
        "oversized-source",
        `is ${source.bytes} bytes; PROVIDER_MIGRATE_SOURCE_MAX_BYTES = ${PROVIDER_MIGRATE_SOURCE_MAX_BYTES}`,
        source.path,
      ),
    };
  }
  if (source.lines > PROVIDER_MIGRATE_SOURCE_MAX_LINES) {
    return {
      ok: false,
      refusal: refusal(
        "oversized-source",
        `is ${source.lines} lines; PROVIDER_MIGRATE_SOURCE_MAX_LINES = ${PROVIDER_MIGRATE_SOURCE_MAX_LINES}`,
        source.path,
      ),
    };
  }

  const assignments: ProviderMigrateAssignment[] = [];
  const lines = source.text.split("\n");
  for (const [index, rawLine] of lines.entries()) {
    const line = index + 1;
    const text = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

    const match = ASSIGNMENT.exec(trimmed);
    if (match !== null) {
      const name = match[1] as string;
      const rawValue = match[2] as string;
      if (isCredentialShapedName(name)) {
        // Name-first firewall: the value is discarded at this boundary.
        assignments.push({
          name,
          line,
          source: source.path,
          credentialShaped: true,
        });
        continue;
      }
      const value = unquote(rawValue);
      if (typeof value !== "string") {
        return {
          ok: false,
          refusal: refusal(
            "shell-construct",
            `${line} declares a value with an unbalanced quote; only a single quoted or bare token is accepted`,
            source.path,
            line,
          ),
        };
      }
      if (DYNAMIC.test(value)) {
        return {
          ok: false,
          refusal: refusal(
            "dynamic-value",
            "declares a value that would require expansion or substitution; only a literal token is accepted",
            source.path,
            line,
          ),
        };
      }
      if (SHELL_CHARACTER.test(value)) {
        return {
          ok: false,
          refusal: refusal(
            "shell-construct",
            "is outside the assignment-only subset; only blank lines, # comments, and NAME=value or export NAME=value are accepted",
            source.path,
            line,
          ),
        };
      }
      assignments.push({
        name,
        line,
        source: source.path,
        value,
        credentialShaped: false,
      });
      continue;
    }

    const reason: ProviderMigrateRefusalReason = DYNAMIC.test(trimmed)
      ? "dynamic-value"
      : "shell-construct";
    return {
      ok: false,
      refusal: refusal(
        reason,
        "is outside the assignment-only subset; only blank lines, # comments, and NAME=value or export NAME=value are accepted",
        source.path,
        line,
      ),
    };
  }
  return { ok: true, assignments };
};

export type ProviderMigrateMappedName = {
  readonly name: string;
  readonly target: string;
};

export type ProviderMigrateReport = {
  readonly sources: readonly ProviderMigrateSourceState[];
  readonly mapped: readonly ProviderMigrateMappedName[];
  readonly unmapped: readonly string[];
  readonly writtenPath?: string;
};

export type ProviderMigrateProposal = {
  readonly yaml: string;
  readonly branch: Readonly<Record<string, unknown>>;
  readonly report: ProviderMigrateReport;
};

export type ProviderMigrateBuild =
  | { readonly ok: true; readonly proposal: ProviderMigrateProposal }
  | { readonly ok: false; readonly refusal: ProviderMigrateRefusal };

type Writable = { [key: string]: unknown };

const setPath = (root: Writable, path: readonly string[], value: unknown): void => {
  let current = root;
  for (const segment of path.slice(0, -1)) {
    const next = current[segment];
    if (next === undefined || typeof next !== "object" || Array.isArray(next)) {
      current[segment] = {};
    }
    current = current[segment] as Writable;
  }
  current[path[path.length - 1] as string] = value;
};

const integerLiteral = (raw: string): number | string => (/^\d+$/u.test(raw) ? Number(raw) : raw);

const agentModelTarget = (
  name: string,
  rule: ProviderMigrateAgentModelRule | undefined,
  profile: string | undefined,
): readonly string[] | undefined => {
  if (rule === undefined || profile === undefined) return undefined;
  const match = new RegExp(rule.pattern, "u").exec(name);
  if (match === null) return undefined;
  const agent = (match[1] as string).toLowerCase();
  return [...rule.targetPrefix, profile, ...rule.agentBefore, agent, ...rule.agentAfter];
};

const dotted = (path: readonly string[]): string => `provider.${path.join(".")}`;

/** Serialise a JSON-shaped branch deterministically: sorted keys, 2-space indent. */
const serialise = (value: unknown, indent: number): string => {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null) return "null";
  if (typeof value !== "object") return "null";
  const entries = Object.entries(value as Readonly<Record<string, unknown>>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  if (entries.length === 0) return "{}";
  const pad = " ".repeat(indent + 2);
  const body = entries
    .map(([key, child]) => {
      const rendered = serialise(child, indent + 2);
      return rendered.startsWith("\n") ? `${pad}${key}:${rendered}` : `${pad}${key}: ${rendered}`;
    })
    .join("\n");
  return `\n${body}`;
};

/** Render the proposal document: a header naming sources and unmapped names, then the branch. */
export const renderProviderMigrateProposal = (input: {
  readonly sources: readonly ProviderMigrateSourceState[];
  readonly unmapped: readonly string[];
  readonly branch: Readonly<Record<string, unknown>>;
}): string => {
  const read = input.sources
    .filter((source) => source.state === "read")
    .map((source) => source.path);
  const absent = input.sources
    .filter((source) => source.state === "absent")
    .map((source) => source.path);
  const lines = [
    "# provider migrate legacy — proposal; review and complete before committing",
    `# sources read: ${read.length === 0 ? "none" : read.join(", ")}`,
    `# sources absent: ${absent.length === 0 ? "none" : absent.join(", ")}`,
    `# unmapped names: ${input.unmapped.length === 0 ? "none" : input.unmapped.join(", ")}`,
    `$schema: ${JSON.stringify(PROVIDER_MIGRATE_PROPOSAL_SCHEMA)}`,
  ];
  const rendered = serialise(input.branch, 0);
  lines.push(rendered.startsWith("\n") ? `provider:${rendered}` : `provider: ${rendered}`);
  return `${lines.join("\n")}\n`;
};

/**
 * Map parsed assignments into the proposed `provider` branch.
 *
 * Literal-to-literal under Appendix E; the two declared derivations are the
 * per-agent model address and the credential reference name. A credential-shaped
 * name contributes only a reference, never its value.
 */
export const buildProviderMigrationProposal = (input: {
  readonly sources: readonly ProviderMigrateSourceState[];
  readonly assignments: readonly ProviderMigrateAssignment[];
  readonly table: ProviderMigrateTable;
}): ProviderMigrateBuild => {
  const profile = input.assignments.find(
    (entry) => entry.name === (input.table.agentModel?.profileVariable ?? ""),
  )?.value;

  const branch: Writable = {};
  const mapped: ProviderMigrateMappedName[] = [];
  const unmapped: string[] = [];
  const seen = new Set<string>();

  for (const assignment of input.assignments) {
    if (seen.has(assignment.name)) continue;
    seen.add(assignment.name);

    if (assignment.credentialShaped) {
      const reference = credentialReferenceName(assignment.name);
      const path = ["credentials", reference, "sourceKey"];
      setPath(branch, [...path, "style"], "literal");
      setPath(branch, [...path, "name"], assignment.name);
      mapped.push({ name: assignment.name, target: dotted(path) });
      continue;
    }

    if (input.table.unmapped.includes(assignment.name)) {
      unmapped.push(assignment.name);
      continue;
    }

    const flag = input.table.flags[assignment.name];
    if (flag !== undefined) {
      const value = assignment.value as string;
      if (Object.hasOwn(flag.values, value)) {
        setPath(branch, flag.path, flag.values[value]);
        mapped.push({ name: assignment.name, target: dotted(flag.path) });
        continue;
      }
      return {
        ok: false,
        refusal: refusal(
          "dynamic-value",
          `declares ${assignment.name}; only the literals ${Object.keys(flag.values)
            .sort()
            .join(" and ")} are mappable`,
          assignment.source,
          assignment.line,
        ),
      };
    }

    const directString = input.table.strings[assignment.name];
    if (directString !== undefined) {
      setPath(branch, directString, assignment.value as string);
      mapped.push({ name: assignment.name, target: dotted(directString) });
      continue;
    }

    const directInteger = input.table.integers[assignment.name];
    if (directInteger !== undefined) {
      setPath(branch, directInteger, integerLiteral(assignment.value as string));
      mapped.push({ name: assignment.name, target: dotted(directInteger) });
      continue;
    }

    const agentPath = agentModelTarget(assignment.name, input.table.agentModel, profile);
    if (agentPath !== undefined) {
      setPath(branch, agentPath, assignment.value as string);
      mapped.push({ name: assignment.name, target: dotted(agentPath) });
      continue;
    }

    unmapped.push(assignment.name);
  }

  return {
    ok: true,
    proposal: {
      yaml: renderProviderMigrateProposal({ sources: input.sources, unmapped, branch }),
      branch,
      report: { sources: input.sources, mapped, unmapped },
    },
  };
};

/**
 * The refusal a command layer turns into `provider.migrate.refused`, naming the
 * reason, the source, and the line (never the content).
 */
export const providerMigrateRefusalSummary = (refusal: ProviderMigrateRefusal): string => {
  const location =
    refusal.source === undefined
      ? ""
      : ` at ${refusal.source}${refusal.line === undefined ? "" : `:${refusal.line}`}`;
  return `provider migrate legacy refused (${refusal.reason})${location}: ${refusal.summary}`;
};
