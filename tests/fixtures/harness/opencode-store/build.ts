/**
 * Deterministic synthetic opencode store builder over the OBSERVED contract
 * (test plan §4.1 rule 5, §4.1a; GH-335 DM-10).
 *
 * Both observed generations are seeded from their own DDL modules; a variant is
 * declared by NAMED REMOVAL (a missing optional column, a null timestamp pair, a
 * reported zero cost, a missing version) and never by inventing a column. Every
 * store is built in a temp directory, carries a privacy canary in place of
 * message content, and no binary store is committed. The retired `workItemRef`
 * option has no replacement: no observed store has that column.
 */

import { Database } from "bun:sqlite";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { HARNESS_MAX_SESSIONS } from "../../../../packages/core/src/contracts/index";
import { CURRENT_MESSAGE_DDL, CURRENT_PART_DDL, CURRENT_SESSION_DDL } from "./current-generation";
import { LEGACY_MESSAGE_DDL, LEGACY_PART_DDL, LEGACY_SESSION_DDL } from "./legacy-generation";

/** The work-item ref a capture stamps on its rows (never a stored column). */
export const WORK_ITEM_REF = "GH-233";

export const PRIVACY_CANARY = "PRIVACY-CANARY-transcript-body-3c9";

export type StoreGenerationName = "current" | "legacy";

export type StoreVariant =
  | "full"
  | "multi-group"
  | "reported-zero-cost"
  | "no-cost-column"
  | "missing-cost"
  | "missing-token-class"
  | "missing-version"
  | "version-drift"
  | "unstated-agent"
  | "unstated-model"
  | "unstated-both"
  | "no-usage"
  | "empty-session"
  | "inverted-timestamps"
  | "absurd-timestamps"
  | "switched"
  | "version-prefixed"
  | "unrelated"
  | "broken-identity";

export type BuiltStore = {
  readonly directory: string;
  readonly path: string;
  /** The identity a capture holds (its tree is read below it). */
  readonly heldSessionIds: readonly string[];
  /** Every seeded session identity. */
  readonly sessionIds: readonly string[];
  /** The root's child identity. */
  readonly childId: string;
};

export type FixtureTotals = {
  readonly sessions: number;
  readonly input: number;
  readonly output: number;
  readonly reasoning: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
};

/** The full fixture's session totals (root + child). */
export const FULL_FIXTURE_TOTALS: FixtureTotals = {
  sessions: 2,
  input: 15 + 6,
  output: 8 + 3,
  reasoning: 2 + 1,
  cacheRead: 3 + 2,
  cacheWrite: 1 + 1,
};

export const ROOT_SESSION = "ses_root";
export const CHILD_SESSION = "ses_child_a";
export const OTHER_SESSION = "ses_other_root";

export const HARNESS_VERSION = "2.2.5";
export const ROOT_AGENT = "agent-a";
export const ROOT_MODEL = { providerID: "zai", id: "glm-5", variant: "judgment" } as const;
export const ROOT_MODEL_ID = "zai/glm-5#judgment";
export const CHILD_AGENT = "agent-b";
export const CHILD_MODEL = { providerID: "deepseek", id: "deepseek-flash" } as const;
export const CHILD_MODEL_ID = "deepseek/deepseek-flash";

export type MessageSeed = {
  readonly id: string;
  readonly sessionId: string;
  readonly seq: number;
  readonly agent: string | null;
  readonly model: Record<string, unknown> | null;
  readonly input: number | null;
  readonly output: number | null;
  readonly reasoning: number | null;
  readonly cacheRead: number | null;
  readonly cacheWrite: number | null;
  readonly cost: number | null;
  readonly createdAt: number;
  readonly completedAt: number;
};

const message = (input: {
  readonly id: string;
  readonly sessionId: string;
  readonly seq: number;
  readonly agent: string | null;
  readonly model: Record<string, unknown> | null;
  readonly input: number;
  readonly output: number;
  readonly reasoning: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly cost: number | null;
  readonly createdAt: number;
}): MessageSeed => ({
  ...input,
  completedAt: input.createdAt + 100,
});

const ROOT_MESSAGES: readonly MessageSeed[] = [
  message({
    id: "msg_root_1",
    sessionId: ROOT_SESSION,
    seq: 1,
    agent: ROOT_AGENT,
    model: ROOT_MODEL,
    input: 10,
    output: 5,
    reasoning: 1,
    cacheRead: 2,
    cacheWrite: 1,
    cost: 0.5,
    createdAt: 1_700_000_001_000,
  }),
  message({
    id: "msg_root_2",
    sessionId: ROOT_SESSION,
    seq: 2,
    agent: ROOT_AGENT,
    model: ROOT_MODEL,
    input: 5,
    output: 3,
    reasoning: 1,
    cacheRead: 1,
    cacheWrite: 0,
    cost: 0.25,
    createdAt: 1_700_000_002_000,
  }),
];

const CHILD_MESSAGES: readonly MessageSeed[] = [
  message({
    id: "msg_child_1",
    sessionId: CHILD_SESSION,
    seq: 1,
    agent: CHILD_AGENT,
    model: CHILD_MODEL,
    input: 6,
    output: 3,
    reasoning: 1,
    cacheRead: 2,
    cacheWrite: 1,
    cost: 0.4,
    createdAt: 1_700_000_003_000,
  }),
];

const OTHER_MESSAGES: readonly MessageSeed[] = [
  message({
    id: "msg_other_1",
    sessionId: OTHER_SESSION,
    seq: 1,
    agent: "agent-other",
    model: { providerID: "synthetic", id: "other-model" },
    input: 3,
    output: 2,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0.1,
    createdAt: 1_700_000_004_000,
  }),
];

const dataOf = (seed: MessageSeed, variant: StoreVariant): string => {
  const tokens: Record<string, unknown> = {
    input: seed.input,
    output: seed.output,
    reasoning: seed.reasoning,
    cache: { read: seed.cacheRead, write: seed.cacheWrite },
  };
  if (variant === "missing-token-class") delete tokens.reasoning;
  const unstatedAgent =
    (variant === "unstated-agent" || variant === "unstated-both") &&
    seed.sessionId === ROOT_SESSION;
  const unstatedModel =
    (variant === "unstated-model" || variant === "unstated-both") &&
    seed.sessionId === ROOT_SESSION;
  return JSON.stringify({
    agent: unstatedAgent ? null : seed.agent,
    model: unstatedModel ? null : seed.model,
    cost: variant === "missing-cost" ? null : variant === "reported-zero-cost" ? 0 : seed.cost,
    tokens,
    time: { created: seed.createdAt, completed: seed.completedAt },
    // Content is present in the real document and is NEVER projected.
    content: [{ type: "text", text: PRIVACY_CANARY }],
  });
};

/** Seed one generation into an open database. */
const seed = (
  database: Database,
  input: {
    readonly generation: StoreGenerationName;
    readonly variant: StoreVariant;
    readonly extraRoots: number;
    readonly rootGroups: number;
  },
): BuiltStore => {
  const current = input.generation === "current";
  const variant = input.variant;
  database.exec(current ? CURRENT_SESSION_DDL : LEGACY_SESSION_DDL);
  database.exec(current ? CURRENT_MESSAGE_DDL : LEGACY_MESSAGE_DDL);
  database.exec(current ? CURRENT_PART_DDL : LEGACY_PART_DDL);

  const sessionColumns = current
    ? "id, parent_id, version, agent, model, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, time_created, time_updated"
    : "id, parent_id, version, agent, model, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, time_created, time_updated";
  const costColumn = variant === "no-cost-column" ? "NULL" : "?";
  const insertSession = database.prepare(
    `INSERT INTO ${current ? "session_v2" : "session"} (${sessionColumns}) VALUES (?, ?, ?, ?, ?, ${costColumn}, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertMessage = database.prepare(
    current
      ? "INSERT INTO session_message (id, session_id, type, seq, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?, ?)"
      : "INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)",
  );

  const sessionId = (id: string): string | null =>
    variant === "broken-identity" && id === ROOT_SESSION ? null : id;
  const agentOf = (value: string | null, identity: string): string | null => {
    if (variant === "unstated-agent" || variant === "unstated-both") {
      return identity === ROOT_SESSION ? null : value;
    }
    return value;
  };
  const modelOf = (value: Record<string, unknown> | null, identity: string): string | null => {
    if (variant === "unstated-model" || variant === "unstated-both") {
      return identity === ROOT_SESSION ? null : value === null ? null : JSON.stringify(value);
    }
    return value === null ? null : JSON.stringify(value);
  };
  const versionOf = (identity: string): string | null => {
    if (variant === "missing-version") return null;
    if (variant === "version-prefixed") return `v${HARNESS_VERSION}`;
    if (variant === "version-drift" && identity === CHILD_SESSION) return "2.1.7";
    return HARNESS_VERSION;
  };
  const sessionCost = (identity: string): number => {
    if (variant === "reported-zero-cost") return 0;
    if (variant === "missing-cost") return 0;
    return identity === CHILD_SESSION ? 0.4 : 0.75;
  };
  const times = (identity: string): { readonly created: number; readonly updated: number } => {
    if (variant === "absurd-timestamps") {
      return { created: 9_000_000_000_000_000, updated: 9_000_000_000_000_001 };
    }
    const created = identity === CHILD_SESSION ? 1_700_000_003_000 : 1_700_000_000_000;
    const updated = identity === CHILD_SESSION ? 1_700_000_004_000 : 1_700_000_002_000;
    return variant === "inverted-timestamps"
      ? { created: updated + 10_000, updated }
      : { created, updated };
  };

  const seedSession = (identity: string, parent: string | null): void => {
    const empty = variant === "empty-session" && identity === "ses_empty";
    const t = times(identity);
    const agent = agentOf(identity === CHILD_SESSION ? CHILD_AGENT : ROOT_AGENT, identity);
    const model = modelOf(identity === CHILD_SESSION ? CHILD_MODEL : ROOT_MODEL, identity);
    const row: (string | number | null)[] = [
      sessionId(identity),
      parent,
      versionOf(identity),
      empty ? null : agent,
      empty ? null : model,
      empty ? 0 : sessionCost(identity),
      empty ? 0 : identity === CHILD_SESSION ? 6 : 15,
      empty ? 0 : identity === CHILD_SESSION ? 3 : 8,
      empty ? 0 : identity === CHILD_SESSION ? 1 : 2,
      empty ? 0 : identity === CHILD_SESSION ? 2 : 3,
      empty ? 0 : identity === CHILD_SESSION ? 1 : 1,
      t.created,
      t.updated,
    ];
    if (variant === "no-cost-column") row.splice(5, 1);
    insertSession.run(...row);
  };

  seedSession(ROOT_SESSION, null);
  seedSession(CHILD_SESSION, ROOT_SESSION);
  if (variant === "empty-session") seedSession("ses_empty", null);
  if (variant !== "no-usage") seedSession(OTHER_SESSION, null);

  const seedsFor = (identity: string): readonly MessageSeed[] =>
    identity === ROOT_SESSION
      ? ROOT_MESSAGES
      : identity === CHILD_SESSION
        ? CHILD_MESSAGES
        : OTHER_MESSAGES;
  const insert = (item: MessageSeed): void => {
    const id = sessionId(item.sessionId) === null ? item.sessionId : item.sessionId;
    if (current) {
      insertMessage.run(
        item.id,
        id,
        "assistant",
        item.seq,
        item.createdAt,
        item.completedAt,
        dataOf(item, variant),
      );
    } else {
      insertMessage.run(item.id, id, item.createdAt, item.completedAt, dataOf(item, variant));
    }
  };
  if (variant !== "no-usage") {
    for (const item of [...seedsFor(ROOT_SESSION), ...seedsFor(CHILD_SESSION)]) insert(item);
    if (variant === "unrelated") insert(OTHER_MESSAGES[0] as MessageSeed);
    // `empty-session` deliberately seeds no message below ses_empty.
  }

  if (variant === "switched") {
    const insertSwitch = (type: string, payload: Record<string, unknown>, seq: number): void => {
      const data = JSON.stringify({ ...payload, time: { created: 1_700_000_002_500 } });
      if (current) {
        insertMessage.run(
          `msg_switch_${seq}`,
          ROOT_SESSION,
          type,
          seq,
          1_700_000_002_500,
          1_700_000_002_500,
          data,
        );
      } else {
        insertMessage.run(
          `msg_switch_${seq}`,
          ROOT_SESSION,
          1_700_000_002_500,
          1_700_000_002_500,
          data,
        );
      }
    };
    insertSwitch("agent-switched", { agent: "agent-c", previous: ROOT_AGENT }, 3);
    insertSwitch(
      "model-switched",
      { model: { providerID: "synthetic", id: "model-c" }, previous: ROOT_MODEL },
      4,
    );
    // A usage row that states no identity after the switches inherits them.
    insert(
      message({
        id: "msg_switched_usage",
        sessionId: ROOT_SESSION,
        seq: 5,
        agent: null,
        model: null,
        input: 2,
        output: 1,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0.05,
        createdAt: 1_700_000_002_600,
      }),
    );
  }

  if (variant === "multi-group") {
    insert(
      message({
        id: "msg_root_group_b",
        sessionId: ROOT_SESSION,
        seq: 3,
        agent: CHILD_AGENT,
        model: CHILD_MODEL,
        input: 3,
        output: 2,
        reasoning: 0,
        cacheRead: 1,
        cacheWrite: 0,
        cost: 0.05,
        createdAt: 1_700_000_005_000,
      }),
    );
  }

  for (let index = 0; index < input.rootGroups; index += 1) {
    insert(
      message({
        id: `msg_root_group_${index}`,
        sessionId: ROOT_SESSION,
        seq: 10 + index,
        agent: `agent-g${index}`,
        model: { providerID: "synthetic", id: `model-g${index}` },
        input: 1,
        output: 1,
        reasoning: 0,
        cacheRead: 1,
        cacheWrite: 0,
        cost: 0.01,
        createdAt: 1_700_000_006_000,
      }),
    );
  }

  for (let index = 0; index < input.extraRoots; index += 1) {
    const identity = `ses_extra_${index}`;
    seedSession(identity, null);
    insert(
      message({
        id: `msg_extra_${index}`,
        sessionId: identity,
        seq: 1,
        agent: "agent-extra",
        model: { providerID: "synthetic", id: "extra-model" },
        input: 1,
        output: 1,
        reasoning: 0,
        cacheRead: 1,
        cacheWrite: 0,
        cost: 0.01,
        createdAt: 1_700_000_007_000,
      }),
    );
  }

  const extra = Array.from({ length: input.extraRoots }, (_value, index) => `ses_extra_${index}`);
  return {
    directory: "",
    path: "",
    heldSessionIds: [ROOT_SESSION],
    sessionIds: [ROOT_SESSION, CHILD_SESSION, OTHER_SESSION, ...extra],
    childId: CHILD_SESSION,
  };
};

/** Build one synthetic store in a temp directory. */
export const buildOpencodeStore = (
  options: {
    readonly generation?: StoreGenerationName;
    readonly variant?: StoreVariant;
    readonly extraRoots?: number;
    readonly rootGroups?: number;
  } = {},
): BuiltStore => {
  const directory = mkdtempSync(join(tmpdir(), "gh335-opencode-store-"));
  const path = join(directory, "opencode.db");
  const database = new Database(path);
  try {
    const seeded = seed(database, {
      generation: options.generation ?? "current",
      variant: options.variant ?? "full",
      extraRoots: options.extraRoots ?? 0,
      rootGroups: options.rootGroups ?? 0,
    });
    return { ...seeded, directory, path };
  } finally {
    database.close();
  }
};

/** A store with more held roots than the declared session cap. */
export const buildCappedStore = (): BuiltStore =>
  buildOpencodeStore({ extraRoots: HARNESS_MAX_SESSIONS + 2 });
