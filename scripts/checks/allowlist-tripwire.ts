/**
 * TC-TRIP-001 — the CI allowlist tripwire (F-7, DEC-13, NG-5).
 *
 * The allowlist table is the exfiltration control, so every widening path is
 * loud. The tripwire is tree-invariant (fixture change-sets drive its mutation
 * suite; the CI gate may additionally read the PR diff at PR time) and it:
 *
 *   1. diffs the live allowlist table against the shipped closed-table
 *      snapshot declared below — a table edit is legitimate only alongside a
 *      deliberate tripwire re-pin (a reviewed code change, loud by
 *      construction) or with the allowlist module named in the change-set;
 *   2. validates every committed `command` credential declaration discovered
 *      in the shipped configuration surfaces — the shipped defaults, the
 *      committed configuration templates, and the committed configuration
 *      fixtures — against the closed table, and re-derives the effective argv
 *      so the executed form is exactly the table's construction;
 *   3. enumerates declared tracker-host coordinates
 *      (`integrations.<kind>.host`) from the same configuration surfaces.
 *      Their absence is this change's shipped state and never fails the gate;
 *      the enumeration names what it finds so the mechanism is live, not
 *      vacuous.
 *
 * Read-only and fail-closed: every drift names its surface, and a vacuous
 * scan (zero configuration surfaces) fails rather than passing silently.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type AllowlistEntry,
  COMMAND_ALLOWLIST,
  constructArgv,
  matchCommandDeclaration,
} from "../../packages/adapters/src/credentials/allowlist";

export const ALLOWLIST_TRIPWIRE_RULE = "allowlist-tripwire";

/**
 * The shipped closed-table snapshot (DEC-13): exactly the two shipped entries,
 * pinned by (program, prefix, flags, slots). A table edit that is not
 * accompanied by a deliberate re-pin of this snapshot fails by name — the
 * tree-invariant form of "the allowlist module must be in the change-set".
 */
export const SHIPPED_TABLE_SNAPSHOT: readonly {
  readonly program: string;
  readonly prefix: readonly string[];
  readonly valueFlag?: string;
  readonly booleanFlag?: string;
  readonly positionalSlot?: string;
}[] = [
  {
    program: "gh",
    prefix: ["auth", "token"],
    valueFlag: "--hostname",
  },
  {
    program: "opencode",
    prefix: ["auth", "export"],
    booleanFlag: "--standalone",
    positionalSlot: "integration-id",
  },
];

/** One committed `command` declaration the tripwire discovered and checked. */
export type CommittedDeclaration = {
  /** The configuration surface the declaration was discovered in. */
  readonly path: string;
  /** The configuration path the declaration was discovered at. */
  readonly configPath: string;
  readonly sourceKey: {
    readonly style: string;
    readonly program: string;
    readonly args: readonly string[];
  };
};

/** The parameterized inputs: the real tree fills them; mutation tests substitute. */
export type TripwireInputs = {
  readonly liveTable: readonly AllowlistEntry[];
  readonly committedDeclarations: readonly CommittedDeclaration[];
  readonly declaredHostCoordinates: readonly string[];
  /** True when the change-set names the allowlist module (a reviewed widening). */
  readonly allowlistModuleInChangeSet?: boolean;
};

/** Snapshot failures: the live table must equal the shipped closed snapshot. */
export const tableSnapshotFailures = (
  liveTable: readonly AllowlistEntry[],
  inChangeSet: boolean | undefined,
): string[] => {
  if (inChangeSet === true) return [];
  const failures: string[] = [];
  if (liveTable.length !== SHIPPED_TABLE_SNAPSHOT.length) {
    failures.push(
      `${ALLOWLIST_TRIPWIRE_RULE}: the allowlist table declares ${liveTable.length} entries ` +
        `against the shipped snapshot of ${SHIPPED_TABLE_SNAPSHOT.length}; a widening is a ` +
        `reviewed code change and must name the allowlist module in the change-set and re-pin ` +
        `the tripwire snapshot`,
    );
    return failures;
  }
  for (const [index, entry] of liveTable.entries()) {
    const pinned = SHIPPED_TABLE_SNAPSHOT[index];
    if (pinned === undefined) break;
    if (
      entry.program !== pinned.program ||
      entry.prefix.join(" ") !== pinned.prefix.join(" ") ||
      entry.valueFlag?.name !== pinned.valueFlag ||
      entry.booleanFlag?.name !== pinned.booleanFlag ||
      entry.positionalSlot !== pinned.positionalSlot
    ) {
      failures.push(
        `${ALLOWLIST_TRIPWIRE_RULE}: allowlist entry ${index} (${entry.program}) drifted from ` +
          `the shipped snapshot; re-pin scripts/checks/allowlist-tripwire.ts deliberately and ` +
          `name the allowlist module in the change-set`,
      );
    }
  }
  return failures;
};

/**
 * Declaration failures: every committed `command` declaration must match the
 * closed table and its effective argv must be exactly the table's
 * construction — no committed configuration can express an argv the table
 * refuses, and no derived form may differ from the declared one.
 */
export const declarationFailures = (
  declarations: readonly CommittedDeclaration[],
  liveTable: readonly AllowlistEntry[],
): string[] => {
  const failures: string[] = [];
  for (const declaration of declarations) {
    if (declaration.sourceKey.style !== "command") continue;
    const match = matchCommandDeclaration({
      style: "command",
      program: declaration.sourceKey.program,
      args: declaration.sourceKey.args,
    });
    if (!match.ok) {
      const inTable = liveTable.some(
        (entry) => entry.program === declaration.sourceKey.program.split("/").pop(),
      );
      failures.push(
        `${ALLOWLIST_TRIPWIRE_RULE}: ${declaration.path} ${declaration.configPath} — the committed ` +
          `command declaration is refused by the shipped table (${match.detail})` +
          `${inTable ? "" : " (the program is out of table)"}`,
      );
      continue;
    }
    const declared = [declaration.sourceKey.program, ...declaration.sourceKey.args];
    const effective = [declaration.sourceKey.program, ...constructArgv(match.entry, match.parsed)];
    const effectiveTail = effective.slice(1);
    const declaredTail = declared.slice(1);
    if (declaredTail.join(" ") !== effectiveTail.join(" ")) {
      failures.push(
        `${ALLOWLIST_TRIPWIRE_RULE}: ${declaration.path} ${declaration.configPath} — the effective ` +
          `argv derived from the committed declaration (${effectiveTail.join(" ")}) differs from ` +
          `the declared argv (${declaredTail.join(" ")})`,
      );
    }
  }
  return failures;
};

/** The full check: snapshot diff, committed-argv diff, host-coordinate enumeration. */
export const runTripwire = (inputs: TripwireInputs): string[] => {
  const failures = tableSnapshotFailures(inputs.liveTable, inputs.allowlistModuleInChangeSet);
  failures.push(...declarationFailures(inputs.committedDeclarations, inputs.liveTable));
  return failures;
};

/** The host-coordinate enumeration result: names what configuration declares. */
export const enumerateHostCoordinates = (coordinates: readonly string[]): readonly string[] =>
  coordinates;

const CONFIG_SUFFIXES = [".yaml", ".yml", ".json"];

const listConfigSurfaces = (root: string, relativeDir: string): string[] => {
  const directory = join(root, relativeDir);
  if (!existsSync(directory)) return [];
  const results: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(next);
      } else if (CONFIG_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
        results.push(next);
      }
    }
  };
  walk(relativeDir);
  return results.sort();
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Parse one committed configuration surface into a plain record (YAML subset). */
const parseSurface = (text: string): UnknownRecord | undefined => {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return parseSimpleYaml(text);
  }
};

/**
 * A deliberately small YAML-subset reader for `sourceKey:` blocks and
 * `integrations:` host coordinates: nested maps by indentation, scalar values
 * only. Committed templates are hand-written and bounded; anything the reader
 * cannot represent is skipped rather than guessed.
 */
const parseSimpleYaml = (text: string): UnknownRecord | undefined => {
  const lines = text
    .split("\n")
    .filter((line) => line.trim().length > 0 && !line.trim().startsWith("#"));
  if (lines.length === 0) return undefined;
  let index = 0;

  const parseBlock = (indent: number): UnknownRecord | undefined => {
    const result: UnknownRecord = {};
    while (index < lines.length) {
      const line = lines[index] ?? "";
      const currentIndent = line.length - line.trimStart().length;
      if (currentIndent < indent) break;
      if (currentIndent > indent) return undefined;
      const trimmed = line.trim();
      const separator = trimmed.indexOf(":");
      if (separator === -1) return undefined;
      const key = trimmed.slice(0, separator).trim();
      const rest = trimmed.slice(separator + 1).trim();
      index += 1;
      if (rest.length === 0) {
        const child = parseBlock(currentIndent + 2);
        if (child === undefined) return undefined;
        result[key] = child;
      } else {
        result[key] = rest.replace(/^['"]|['"]$/g, "");
      }
    }
    return result;
  };
  return parseBlock(0);
};

const walkSources = (
  node: unknown,
  path: string,
  found: {
    declarations: CommittedDeclaration[];
    hostCoordinates: string[];
  },
  surface: string,
): void => {
  if (!isRecord(node)) return;
  if (isRecord(node.sourceKey) && node.sourceKey.style === "command") {
    const program = node.sourceKey.program;
    const args = node.sourceKey.args;
    if (typeof program === "string" && Array.isArray(args)) {
      found.declarations.push({
        path: surface,
        configPath: path || "sourceKey",
        sourceKey: {
          style: "command",
          program,
          args: args.filter((arg): arg is string => typeof arg === "string"),
        },
      });
    }
  }
  if (/^integrations$/.test(path.split(".").pop() ?? "")) {
    for (const [kind, value] of Object.entries(node)) {
      if (isRecord(value) && typeof value.host === "string") {
        found.hostCoordinates.push(`integrations.${kind}.host`);
      }
    }
  }
  for (const [key, value] of Object.entries(node)) {
    walkSources(value, path.length === 0 ? key : `${path}.${key}`, found, surface);
  }
};

/** Discover committed command declarations and host coordinates from the tree. */
export const discoverFromTree = (
  root: string,
): {
  readonly declarations: readonly CommittedDeclaration[];
  readonly hostCoordinates: readonly string[];
  readonly surfaces: number;
} => {
  const found = { declarations: [] as CommittedDeclaration[], hostCoordinates: [] as string[] };
  let surfaces = 0;
  for (const relativeDir of [
    "doc/templates",
    "tests/fixtures/config",
    "tests/fixtures/providers",
  ]) {
    for (const surface of listConfigSurfaces(root, relativeDir)) {
      const parsed = parseSurface(readFileSync(join(root, surface), "utf8"));
      if (parsed === undefined) continue;
      surfaces += 1;
      walkSources(parsed, "", found, surface);
    }
  }
  return { declarations: found.declarations, hostCoordinates: found.hostCoordinates, surfaces };
};

if (import.meta.main) {
  const discovered = discoverFromTree(process.cwd());
  const failures = runTripwire({
    liveTable: COMMAND_ALLOWLIST,
    committedDeclarations: discovered.declarations,
    declaredHostCoordinates: discovered.hostCoordinates,
  });
  const enumerated = enumerateHostCoordinates(discovered.hostCoordinates);
  if (discovered.surfaces === 0) {
    console.error(
      `FAIL ${ALLOWLIST_TRIPWIRE_RULE}: zero configuration surfaces discovered — the scan is vacuous`,
    );
    process.exit(1);
  }
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    process.exit(1);
  }
  console.log(
    `OK ${ALLOWLIST_TRIPWIRE_RULE}: ${discovered.surfaces} configuration surfaces scanned, ` +
      `${discovered.declarations.length} committed command declarations match the closed table, ` +
      `${enumerated.length} declared tracker-host coordinate(s) enumerated`,
  );
}
