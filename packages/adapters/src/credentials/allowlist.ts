/**
 * The shipped closed allowlist for `command` credential sources (C-10, DM-4).
 *
 * The table is the exfiltration control: the only `command` declarations
 * expressible are the two shipped entries, each a (program, pinned subcommand
 * prefix) pair with its permitted parameters, grammar-closed slots, and
 * per-entry remedy selection. Interpreters and general network clients are
 * absent from the table by construction, so no configuration can name them.
 *
 * Pure module: every function here is a string/table operation with no I/O,
 * clock, randomness, or ambient environment access. The slot bounds are named
 * constants (plan-resolved, spec OQ-4) so the suites pin values, not literals.
 */
import type { CredentialFailureReason, CredentialSourceKey } from "@delivery-os/core/contracts";

/** The `<host>` slot bound: the RFC 1035 FQDN upper bound (min 1). */
export const HOST_SLOT_MAX_LENGTH = 253 as const;
/** The `<integrationID>` slot bound (min 1). */
export const INTEGRATION_ID_MAX_LENGTH = 64 as const;
/** The per-execution default cap (DEC-11). */
export const COMMAND_TIMEOUT_DEFAULT_MS = 15_000 as const;
/** The per-execution hard bound: no declaration may exceed it. */
export const COMMAND_TIMEOUT_MAX_MS = 30_000 as const;
/** The stdout capture bound: comfortably holds one declared integration's export. */
export const COMMAND_STDOUT_MAX_BYTES = 262_144 as const;

const HOST_SLOT_PATTERN = /^[A-Za-z0-9.-]+$/;
const INTEGRATION_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

/** One slot validation outcome. */
export type SlotValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly detail: string };

/** Validate the `<host>` slot grammar: charset, no leading dash, bounded length. */
export const validateHostSlot = (value: string): SlotValidation => {
  if (value.length === 0) return { ok: false, detail: "the host slot is empty" };
  if (value.startsWith("-")) return { ok: false, detail: "the host slot must not start with '-'" };
  if (value.length > HOST_SLOT_MAX_LENGTH) {
    return { ok: false, detail: `the host slot exceeds ${HOST_SLOT_MAX_LENGTH} characters` };
  }
  if (!HOST_SLOT_PATTERN.test(value)) {
    return { ok: false, detail: "the host slot allows only [A-Za-z0-9.-]" };
  }
  return { ok: true };
};

/** Validate the `<integrationID>` slot grammar: closed pattern, no leading dash, bounded length. */
export const validateIntegrationIdSlot = (value: string): SlotValidation => {
  if (value.length === 0) return { ok: false, detail: "the integration id slot is empty" };
  if (value.startsWith("-")) {
    return { ok: false, detail: "the integration id slot must not start with '-'" };
  }
  if (value.length > INTEGRATION_ID_MAX_LENGTH) {
    return {
      ok: false,
      detail: `the integration id slot exceeds ${INTEGRATION_ID_MAX_LENGTH} characters`,
    };
  }
  if (!INTEGRATION_ID_PATTERN.test(value)) {
    return { ok: false, detail: "the integration id slot allows only [a-z0-9][a-z0-9_-]*" };
  }
  return { ok: true };
};

/** The slot grammars an allowlist entry closes by pattern. */
export type AllowlistSlotGrammar = "host" | "integration-id";

/** One shipped allowlist entry: a pinned owner CLI running a pinned subcommand. */
export type AllowlistEntry = {
  /** The canonical program name; a declaration's absolute path must name it. */
  readonly program: string;
  /** The pinned subcommand prefix. */
  readonly prefix: readonly string[];
  /** The optional flag taking one grammar-closed slot value (host entry only). */
  readonly valueFlag?: { readonly name: string; readonly slot: AllowlistSlotGrammar };
  /** The optional boolean flag (harness export only). */
  readonly booleanFlag?: { readonly name: string };
  /** The required trailing positional slot (harness export only). */
  readonly positionalSlot?: AllowlistSlotGrammar;
  /**
   * The binding-supplied slot exception (C-10 as amended by ADR-0015), stated
   * inertly: no binding and no credentials catalog branch exists in this
   * change, so the exception accepts no input and no committed host coordinate
   * can flow into a slot (NG-8, DEC-13). The exception activates only through
   * a reviewed binding change, never through configuration.
   */
  readonly bindingSuppliedSlot?: { readonly slot: AllowlistSlotGrammar; readonly active: false };
  /** Whether this entry's non-zero-exit remedy cell is the host-aware text. */
  readonly hostAwareRefusal: boolean;
};

/**
 * The closed shipped table. Exactly two entries: the tracker CLI's token read
 * and the harness CLI's credential export. Any widening is a reviewed
 * allowlist addition with its own pinned subcommand (NG-5).
 */
export const COMMAND_ALLOWLIST: readonly AllowlistEntry[] = [
  {
    program: "gh",
    prefix: ["auth", "token"],
    valueFlag: { name: "--hostname", slot: "host" },
    bindingSuppliedSlot: { slot: "host", active: false },
    hostAwareRefusal: true,
  },
  {
    program: "opencode",
    prefix: ["auth", "export"],
    booleanFlag: { name: "--standalone" },
    positionalSlot: "integration-id",
    hostAwareRefusal: false,
  },
];

const slotValidator = (slot: AllowlistSlotGrammar): ((value: string) => SlotValidation) =>
  slot === "host" ? validateHostSlot : validateIntegrationIdSlot;

/** The canonical program name a declared absolute path expresses. */
const programNameOf = (programPath: string): string => {
  const segments = programPath.split("/");
  return segments[segments.length - 1] ?? "";
};

/** The parameters a declaration's argv tail expresses against one entry. */
export type ParsedParameters = {
  readonly flagValue?: string;
  readonly booleanFlag?: boolean;
  readonly positional?: string;
};

/** Match a declared `command` source key against the shipped table. */
export type DeclarationMatch =
  | { readonly ok: true; readonly entry: AllowlistEntry; readonly parsed: ParsedParameters }
  | { readonly ok: false; readonly detail: string };

const parseTail = (entry: AllowlistEntry, tail: readonly string[]): ParsedParameters | string => {
  const parsed: {
    flagValue?: string;
    booleanFlag?: boolean;
    positional?: string;
  } = {};
  let index = 0;
  while (index < tail.length) {
    const token = tail[index];
    if (token === undefined) break;
    if (entry.valueFlag !== undefined && token === entry.valueFlag.name) {
      if (parsed.flagValue !== undefined) {
        return `the parameter ${token} is declared more than once`;
      }
      const value = tail[index + 1];
      if (value === undefined) {
        return `the parameter ${token} requires a value`;
      }
      const slot = slotValidator(entry.valueFlag.slot)(value);
      if (!slot.ok) return `the parameter ${token}: ${slot.detail}`;
      parsed.flagValue = value;
      index += 2;
      continue;
    }
    if (entry.booleanFlag !== undefined && token === entry.booleanFlag.name) {
      if (parsed.booleanFlag === true) {
        return `the parameter ${token} is declared more than once`;
      }
      parsed.booleanFlag = true;
      index += 1;
      continue;
    }
    if (entry.positionalSlot !== undefined && index === tail.length - 1 && !token.startsWith("-")) {
      const slot = slotValidator(entry.positionalSlot)(token);
      if (!slot.ok) return `the integration id parameter: ${slot.detail}`;
      parsed.positional = token;
      index += 1;
      continue;
    }
    return `the parameter ${token} is not permitted for ${entry.program}`;
  }
  if (entry.positionalSlot !== undefined && parsed.positional === undefined) {
    return `the declared argv is missing the required ${entry.positionalSlot} parameter`;
  }
  return parsed;
};

/**
 * Match a declared `command` source key against the table: an absolute program
 * path whose canonical name is in the table, the exact pinned prefix, and only
 * the entry's permitted parameters. Every refusal names the program, the
 * parameter, or the slot by name.
 */
export const matchCommandDeclaration = (sourceKey: CredentialSourceKey): DeclarationMatch => {
  if (sourceKey.style !== "command") {
    return { ok: false, detail: "the source key is not a command declaration" };
  }
  const programPath = sourceKey.program;
  if (!programPath.startsWith("/")) {
    return { ok: false, detail: "the program path must be absolute" };
  }
  const programName = programNameOf(programPath);
  const entry = COMMAND_ALLOWLIST.find((candidate) => candidate.program === programName);
  if (entry === undefined) {
    return { ok: false, detail: `the program ${programName} is not in the shipped allowlist` };
  }
  const prefix = entry.prefix;
  if (sourceKey.args.length < prefix.length) {
    return {
      ok: false,
      detail: `the declared argv does not carry the pinned prefix for ${entry.program}`,
    };
  }
  for (const [index, prefixToken] of prefix.entries()) {
    if (sourceKey.args[index] !== prefixToken) {
      return {
        ok: false,
        detail: `the declared argv does not carry the pinned prefix for ${entry.program}`,
      };
    }
  }
  const tail = sourceKey.args.slice(prefix.length);
  const parsed = parseTail(entry, tail);
  if (typeof parsed === "string") return { ok: false, detail: parsed };
  return { ok: true, entry, parsed };
};

/**
 * Construct the executed argv from a matched declaration. The positional form
 * always carries the `--` terminator before the positional, so even a
 * malformed slot value cannot be read as a flag.
 */
export const constructArgv = (
  entry: AllowlistEntry,
  parsed: ParsedParameters,
): readonly string[] => {
  const argv: string[] = [...entry.prefix];
  if (parsed.flagValue !== undefined && entry.valueFlag !== undefined) {
    argv.push(entry.valueFlag.name, parsed.flagValue);
  }
  if (parsed.booleanFlag === true && entry.booleanFlag !== undefined) {
    argv.push(entry.booleanFlag.name);
  }
  if (parsed.positional !== undefined) {
    argv.push("--", parsed.positional);
  }
  return argv;
};

/**
 * Owner-pinned remedy texts (spec Appendix B), fixture-pinned byte-exact.
 * The host-aware `command` / `non-zero-exit` cell applies only to entries
 * with a binding-supplied or declared host slot; the neutral cell applies
 * otherwise. No binding exists in this change, so the host-aware text names
 * no concrete host.
 */
export const COMMAND_HOST_AWARE_NON_ZERO_EXIT_REMEDY =
  "the program could not obtain a token; it may not be authenticated to the required host — log in to that host (for `gh`: `gh auth login --hostname <host>`), or declare another source." as const;
export const COMMAND_NEUTRAL_NON_ZERO_EXIT_REMEDY =
  "the program could not obtain a token; it may not be authenticated — log in, or declare another source." as const;
export const COMMAND_PROGRAM_UNAVAILABLE_REMEDY = "declare the program path as installed" as const;

/**
 * The fixed shipped remedy for one (reason, style) cell of the two
 * environment styles. The remedy is never interpolated from configuration
 * text or child output; it names the one operator act that helps.
 */
export const environmentRemedyText = (
  reason: CredentialFailureReason,
  style: "literal" | "environment-prefixed",
): string => {
  if (reason !== "variable-absent") {
    return environmentRemedyText("variable-absent", style);
  }
  return style === "literal"
    ? "declare the credential value in the environment variable named by the literal source key, then re-run"
    : "declare the credential value in the environment variable named by the declared prefix and suffix, then re-run";
};

/** The harness-store style's fixed remedy cells, keyed by reachable reason. */
export const harnessStoreRemedyText = (reason: CredentialFailureReason): string => {
  switch (reason) {
    case "program-unavailable":
      return "install the harness CLI so its export is reachable, then re-run";
    case "timeout":
      return "the harness export did not finish within its time bound; declare the --standalone flag on the command source, then re-run";
    case "non-zero-exit":
      return "the harness export failed; declare the --standalone flag on the command source, then re-run";
    case "empty-output":
      return "no stored entry exists for the declared integration; store an API key for that integration in the harness, then re-run";
    case "shape-drift":
      return "the harness export departed its pinned shape; use a harness CLI version within the supported window, then re-run";
    case "ambiguous-account":
      return "keep exactly one active stored entry for the declared integration, then re-run";
    case "oauth-excluded":
      return "store an API-key entry for the declared integration; harness OAuth grants are never consumed, then re-run";
    case "source-not-supported":
      return "declare the supported harness identity in the source key, then re-run";
    default:
      return "resolve the declared credential source, then re-run";
  }
};

/** One command entry's fixed remedy cells, keyed by reachable reason. */
export type CommandRemedyReason =
  | "program-unavailable"
  | "timeout"
  | "non-zero-exit"
  | "empty-output"
  | "shape-drift"
  | "source-not-supported";
export type CommandRemedyCells = Readonly<Record<CommandRemedyReason, string>>;

const COMMAND_SOURCE_NOT_SUPPORTED_REMEDY =
  "declare a program pair from the shipped allowlist, then re-run";

const hostAwareCommandCells: CommandRemedyCells = {
  "program-unavailable": COMMAND_PROGRAM_UNAVAILABLE_REMEDY,
  timeout:
    "the token read did not finish within its time bound; retry once the host keyring is responsive, or declare another source.",
  "non-zero-exit": COMMAND_HOST_AWARE_NON_ZERO_EXIT_REMEDY,
  "empty-output": "the program returned no credential; log in so the host holds one, then re-run.",
  "shape-drift":
    "the program returned a refused output shape; a token read returns one line, so log in or declare another source.",
  "source-not-supported": COMMAND_SOURCE_NOT_SUPPORTED_REMEDY,
};

const neutralCommandCells: CommandRemedyCells = {
  "program-unavailable": COMMAND_PROGRAM_UNAVAILABLE_REMEDY,
  timeout:
    "the export did not finish within its time bound; declare the --standalone flag on the command source, then re-run.",
  "non-zero-exit": COMMAND_NEUTRAL_NON_ZERO_EXIT_REMEDY,
  "empty-output":
    "the export returned no stored credential for the declared integration; store an API key for that integration in the harness, then re-run.",
  "shape-drift":
    "the export returned a refused output shape; declare the source as harness-store to consume the export, then re-run.",
  "source-not-supported": COMMAND_SOURCE_NOT_SUPPORTED_REMEDY,
};

/**
 * The fixed `(reason, style)`-keyed remedy for a `command` source, selected
 * per allowlist entry: the host-aware non-zero-exit cell applies only to
 * entries with a host slot, the neutral cell otherwise. Without a matched
 * entry (an out-of-table declaration), the neutral cells apply.
 */
export const commandRemedyText = (
  reason: CredentialFailureReason,
  entry?: AllowlistEntry,
): string => {
  const cells = entry?.hostAwareRefusal ? hostAwareCommandCells : neutralCommandCells;
  return cells[reason as CommandRemedyReason];
};

/** The fixed remedy for one (reason, style) pair across all four styles. */
export const remedyText = (
  reason: CredentialFailureReason,
  style: CredentialSourceKey["style"],
  entry?: AllowlistEntry,
): string => {
  if (style === "literal" || style === "environment-prefixed") {
    return environmentRemedyText(reason, style);
  }
  if (style === "command") {
    return commandRemedyText(reason, entry);
  }
  return harnessStoreRemedyText(reason);
};
