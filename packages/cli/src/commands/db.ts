/**
 * The `db` session-admin command definition (GH-180 PIN-5, PIN-8).
 *
 * The handler owns value parsing, subcommand-specific flag sets, numeric
 * ranges, and defaults. It performs no stream write, chooses no exit code, and
 * never inspects `--json`. The shared parser is consumed unchanged.
 */
import {
  type BrandIdentity,
  DB_COMMANDS,
  DB_DEFAULT_LIST_LIMIT,
  DB_DEFAULT_OLDER_THAN_DAYS,
  DB_DEFAULT_PRUNE_LIMIT,
  DB_MAX_LIST_LIMIT,
  DB_MAX_OLDER_THAN_DAYS,
  DB_MAX_PRUNE_LIMIT,
  DB_MIN_LIMIT,
  DB_MIN_OLDER_THAN_DAYS,
  type DbCommand,
  type ListData,
  type PruneData,
  type RebootData,
  renderSessionAdminHuman,
  type SessionListRead,
  type SessionPruneRead,
  type SessionRebootRead,
  type SessionSizeRead,
  type SizeData,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";

/** Everything the db handler reads, injected at the edge. */
export type DbCommandRuntime = {
  size(): Promise<SessionSizeRead>;
  list(input: { readonly limit: number }): Promise<SessionListRead>;
  prune(input: {
    readonly olderThanDays: number;
    readonly limit: number;
    readonly apply: boolean;
  }): Promise<SessionPruneRead>;
  reboot(input: { readonly apply: boolean }): Promise<SessionRebootRead>;
};

type DbData = SizeData | ListData | PruneData | RebootData;

const DECLARED_FLAGS = new Set(["--limit", "--older-than", "--apply"]);

const allowedFlags = (command: DbCommand): ReadonlySet<string> => {
  switch (command) {
    case "size":
      return new Set();
    case "list":
      return new Set(["--limit"]);
    case "prune":
      return new Set(["--limit", "--older-than", "--apply"]);
    case "reboot":
      return new Set(["--apply"]);
  }
};

const isDbCommand = (value: string | undefined): value is DbCommand =>
  value !== undefined && (DB_COMMANDS as readonly string[]).includes(value);

const parseInteger = (value: string): number | undefined => {
  if (!/^-?\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const reject = (detail: string): { readonly error: unknown } => ({
  error: { kind: "input", code: "input.value.rejected", summary: `db: ${detail}` },
});

const toHandlerResult = (
  read: SessionSizeRead | SessionListRead | SessionPruneRead | SessionRebootRead,
): { readonly data: unknown } | { readonly error: unknown } =>
  read.ok ? { data: read.value } : { error: read.error };

/** Build the `db` command definition over the injected runtime. */
export const createDbCommandDefinition = (runtime: DbCommandRuntime): CommandDefinition => ({
  flags: ["--limit", "--older-than", "--apply"],
  positionals: { max: 8 },
  humanText: (data: unknown, brand: BrandIdentity): string =>
    renderSessionAdminHuman(data as DbData, brand),
  handler: async (invocation) => {
    const tokens = invocation.argv;
    const subcommand = tokens[1];
    if (!isDbCommand(subcommand)) {
      return reject(
        subcommand === undefined ? "missing subcommand" : `unknown subcommand "${subcommand}"`,
      );
    }
    const allowed = allowedFlags(subcommand);
    let limit: number | undefined;
    let olderThanDays: number | undefined;
    let apply = false;
    for (let index = 2; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token === undefined) continue;
      if (!token.startsWith("--")) {
        return reject(`unexpected positional "${token}"`);
      }
      if (!DECLARED_FLAGS.has(token)) return reject(`unknown flag "${token}"`);
      if (!allowed.has(token)) return reject(`flag "${token}" is not valid for db ${subcommand}`);
      if (token === "--apply") {
        apply = true;
        continue;
      }
      const value = tokens[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return reject(`missing value for "${token}"`);
      }
      index += 1;
      const parsed = parseInteger(value);
      if (parsed === undefined) return reject(`invalid value for "${token}"`);
      if (token === "--limit") {
        const maximum = subcommand === "list" ? DB_MAX_LIST_LIMIT : DB_MAX_PRUNE_LIMIT;
        if (parsed < DB_MIN_LIMIT || parsed > maximum)
          return reject(`invalid value for "${token}"`);
        limit = parsed;
      } else {
        if (parsed < DB_MIN_OLDER_THAN_DAYS || parsed > DB_MAX_OLDER_THAN_DAYS) {
          return reject(`invalid value for "${token}"`);
        }
        olderThanDays = parsed;
      }
    }
    if (subcommand === "size") return toHandlerResult(await runtime.size());
    if (subcommand === "list") {
      return toHandlerResult(await runtime.list({ limit: limit ?? DB_DEFAULT_LIST_LIMIT }));
    }
    if (subcommand === "prune") {
      return toHandlerResult(
        await runtime.prune({
          olderThanDays: olderThanDays ?? DB_DEFAULT_OLDER_THAN_DAYS,
          limit: limit ?? DB_DEFAULT_PRUNE_LIMIT,
          apply,
        }),
      );
    }
    return toHandlerResult(await runtime.reboot({ apply }));
  },
});
