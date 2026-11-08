/**
 * Deterministic synthetic opencode session store builder (test-plan §4.5).
 *
 * The store is built in a temp directory with Bun's built-in SQLite; no binary
 * store is committed. Rows are deterministic, contain a privacy canary in place
 * of message bodies, and cover two agents, two models, all token classes, tool
 * parts, and the drift variants.
 */

import { Database } from "bun:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HARNESS_MAX_SESSIONS } from "../../../../packages/core/src/contracts/index";

export const PRIVACY_CANARY = "PRIVACY-CANARY-transcript-body-3c9";
export const WORK_ITEM_REF = "GH-233";
export const HARNESS_VERSION = "1.0.0";

export type StoreVariant =
  | "full"
  | "multi-group"
  | "no-optional-column"
  | "no-input-column"
  | "non-numeric-cost"
  | "missing-cost"
  | "orphan"
  | "orphan-scope"
  | "broken-identity";

export type BuiltStore = {
  readonly directory: string;
  readonly path: string;
};

export type FixtureTotals = {
  readonly sessions: number;
  readonly input: number;
  readonly output: number;
  readonly reasoning: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
};

export const FULL_FIXTURE_TOTALS: FixtureTotals = {
  sessions: 3,
  input: 15 + 6 + 4,
  output: 8 + 3 + 2,
  reasoning: 2 + 1 + 1,
  cacheRead: 3 + 2 + 1,
  cacheWrite: 1 + 1 + 0,
};

type MessageRow = {
  readonly id: string;
  readonly sessionId: string;
  readonly agent: string | null;
  readonly model: string | null;
  readonly input: number;
  readonly output: number;
  readonly reasoning: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly cost: number | string | null;
  readonly createdAt: string;
  readonly tool?: string;
};

const ROOT_MESSAGES: readonly MessageRow[] = [
  {
    id: "msg_root_1",
    sessionId: "ses_root",
    agent: "agent-a",
    model: "model-a",
    input: 10,
    output: 5,
    reasoning: 1,
    cacheRead: 2,
    cacheWrite: 1,
    cost: 0.5,
    createdAt: "2026-11-06T00:00:01Z",
    tool: "edit",
  },
  {
    id: "msg_root_2",
    sessionId: "ses_root",
    agent: "agent-a",
    model: "model-a",
    input: 5,
    output: 3,
    reasoning: 1,
    cacheRead: 1,
    cacheWrite: 0,
    cost: 0.25,
    createdAt: "2026-11-06T00:00:02Z",
    tool: "edit",
  },
];

const CHILD_A_MESSAGES: readonly MessageRow[] = [
  {
    id: "msg_child_a_1",
    sessionId: "ses_child_a",
    agent: "agent-b",
    model: "model-b",
    input: 6,
    output: 3,
    reasoning: 1,
    cacheRead: 2,
    cacheWrite: 1,
    cost: 0.4,
    createdAt: "2026-11-06T00:00:03Z",
    tool: "bash",
  },
];

const CHILD_B_MESSAGES: readonly MessageRow[] = [
  {
    id: "msg_child_b_1",
    sessionId: "ses_child_b",
    agent: "agent-a",
    model: "model-b",
    input: 4,
    output: 2,
    reasoning: 1,
    cacheRead: 1,
    cacheWrite: 0,
    cost: 0.1,
    createdAt: "2026-11-06T00:00:04Z",
    tool: "edit",
  },
];

const SESSION_SCHEMA =
  "CREATE TABLE session (id TEXT, parent_id TEXT, work_item_ref TEXT, harness_version TEXT);" +
  "CREATE INDEX session_work_item ON session(work_item_ref);" +
  "CREATE INDEX session_parent ON session(parent_id);";

const messageSchema = (variant: StoreVariant): string => {
  const columns = ["id TEXT", "session_id TEXT", "agent TEXT", "model TEXT"];
  if (variant !== "no-input-column") columns.push("input_tokens INTEGER");
  columns.push("output_tokens INTEGER");
  if (variant !== "no-optional-column") columns.push("reasoning_tokens INTEGER");
  columns.push("cache_read_tokens INTEGER", "cache_write_tokens INTEGER");
  columns.push(variant === "non-numeric-cost" ? "cost TEXT" : "cost REAL");
  columns.push("created_at TEXT", "content TEXT");
  return (
    `CREATE TABLE message (${columns.join(", ")});` +
    "CREATE INDEX message_session ON message(session_id, created_at);" +
    // The message id is the join key for per-(agent, model) tool attribution.
    "CREATE INDEX message_id ON message(id);"
  );
};

const PART_SCHEMA =
  "CREATE TABLE part (id TEXT, message_id TEXT, session_id TEXT, tool TEXT);" +
  "CREATE INDEX part_session ON part(session_id);";

export const buildOpencodeStore = (
  options: {
    readonly variant?: StoreVariant;
    readonly extraRoots?: number;
    readonly rootGroups?: number;
    readonly workItemRef?: string;
  } = {},
): BuiltStore => {
  const variant = options.variant ?? "full";
  const workItemRef = options.workItemRef ?? WORK_ITEM_REF;
  const directory = mkdtempSync(join(tmpdir(), "gh233-opencode-store-"));
  const path = join(directory, "opencode.db");
  const database = new Database(path);
  try {
    database.exec(SESSION_SCHEMA);
    database.exec(messageSchema(variant));
    database.exec(PART_SCHEMA);

    const insertSession = database.prepare(
      "INSERT INTO session (id, parent_id, work_item_ref, harness_version) VALUES (?, ?, ?, ?)",
    );
    insertSession.run("ses_root", null, workItemRef, HARNESS_VERSION);
    insertSession.run("ses_child_a", "ses_root", workItemRef, HARNESS_VERSION);
    insertSession.run("ses_child_b", "ses_root", workItemRef, HARNESS_VERSION);

    const costValue = (row: MessageRow): string | number | null => {
      if (variant === "missing-cost") return null;
      if (variant === "non-numeric-cost") return "not-a-number";
      return row.cost;
    };
    const messageColumns = (): string[] => {
      const columns = ["id", "session_id", "agent", "model"];
      if (variant !== "no-input-column") columns.push("input_tokens");
      columns.push("output_tokens");
      if (variant !== "no-optional-column") columns.push("reasoning_tokens");
      columns.push("cache_read_tokens", "cache_write_tokens", "cost", "created_at", "content");
      return columns;
    };
    const columns = messageColumns();
    const valuesFor = (row: MessageRow): Array<string | number | null> => {
      const values: Array<string | number | null> = [row.id, row.sessionId, row.agent, row.model];
      if (variant !== "no-input-column") values.push(row.input);
      values.push(row.output);
      if (variant !== "no-optional-column") values.push(row.reasoning);
      values.push(row.cacheRead, row.cacheWrite, costValue(row), row.createdAt, PRIVACY_CANARY);
      return values;
    };
    const insertMessage = database.prepare(
      `INSERT INTO message (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    );
    const insertPart = database.prepare(
      "INSERT INTO part (id, message_id, session_id, tool) VALUES (?, ?, ?, ?)",
    );
    const allMessages = [...ROOT_MESSAGES, ...CHILD_A_MESSAGES, ...CHILD_B_MESSAGES];
    for (const [index, row] of allMessages.entries()) {
      insertMessage.run(...valuesFor(row));
      insertPart.run(`part_${index}`, row.id, row.sessionId, row.tool ?? "edit");
    }

    if (variant === "multi-group") {
      const row: MessageRow = {
        id: "msg_root_group_b",
        sessionId: "ses_root",
        agent: "agent-b",
        model: "model-b",
        input: 3,
        output: 2,
        reasoning: 0,
        cacheRead: 1,
        cacheWrite: 0,
        cost: 0.05,
        createdAt: "2026-11-06T00:00:07Z",
        tool: "bash",
      };
      insertMessage.run(...valuesFor(row));
      insertPart.run("part_root_group_b", row.id, row.sessionId, row.tool ?? "edit");
    }

    if (variant === "orphan-scope") {
      for (let index = 0; index < 3; index += 1) {
        const id = `ses_oop_${index}`;
        insertSession.run(id, null, null, HARNESS_VERSION);
        insertMessage.run(
          ...valuesFor({
            id: `msg_oop_${index}`,
            sessionId: id,
            agent: "agent-orphan",
            model: "model-orphan",
            input: 1,
            output: 1,
            reasoning: 0,
            cacheRead: 0,
            cacheWrite: 0,
            cost: 0.01,
            createdAt: "2026-11-06T00:00:09Z",
            tool: "edit",
          }),
        );
      }
      insertSession.run("ses_other", null, "GH-999", HARNESS_VERSION);
      insertMessage.run(
        ...valuesFor({
          id: "msg_other",
          sessionId: "ses_other",
          agent: "agent-other",
          model: "model-other",
          input: 2,
          output: 2,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0.02,
          createdAt: "2026-11-06T00:00:10Z",
          tool: "edit",
        }),
      );
      insertSession.run("ses_child_invalid", "ses_root", workItemRef, HARNESS_VERSION);
      insertMessage.run(
        ...valuesFor({
          id: "msg_child_invalid",
          sessionId: "ses_child_invalid",
          agent: null,
          model: null,
          input: 1,
          output: 1,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0.01,
          createdAt: "2026-11-06T00:00:11Z",
          tool: "edit",
        }),
      );
    }
    if (variant === "orphan") {
      insertSession.run("ses_orphan", null, null, HARNESS_VERSION);
      const row: MessageRow = {
        id: "msg_orphan",
        sessionId: "ses_orphan",
        agent: "agent-orphan",
        model: "model-orphan",
        input: 9,
        output: 9,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0.2,
        createdAt: "2026-11-06T00:00:05Z",
        tool: "edit",
      };
      insertMessage.run(...valuesFor(row));
    }
    if (variant === "broken-identity") {
      insertSession.run(null, null, workItemRef, HARNESS_VERSION);
    }

    const extraRoots = options.extraRoots ?? 0;
    for (let index = 0; index < extraRoots; index += 1) {
      const id = `ses_extra_${index}`;
      insertSession.run(id, null, workItemRef, HARNESS_VERSION);
      const row: MessageRow = {
        id: `msg_extra_${index}`,
        sessionId: id,
        agent: "agent-extra",
        model: "model-extra",
        input: 1,
        output: 1,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0.01,
        createdAt: "2026-11-06T00:00:06Z",
        tool: "edit",
      };
      insertMessage.run(...valuesFor(row));
    }

    const rootGroups = options.rootGroups ?? 0;
    for (let index = 0; index < rootGroups; index += 1) {
      const row: MessageRow = {
        id: `msg_root_group_${index}`,
        sessionId: "ses_root",
        agent: `agent-g${index}`,
        model: `model-g${index}`,
        input: 1,
        output: 1,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0.01,
        createdAt: "2026-11-06T00:00:08Z",
        tool: "edit",
      };
      insertMessage.run(...valuesFor(row));
      insertPart.run(`part_root_group_${index}`, row.id, row.sessionId, "edit");
    }
  } finally {
    database.close();
  }
  return { directory, path };
};

/** A store with more roots than the declared session cap. */
export const buildCappedStore = (): BuiltStore =>
  buildOpencodeStore({ extraRoots: HARNESS_MAX_SESSIONS + 2 });
