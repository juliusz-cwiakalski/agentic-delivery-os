/**
 * Synthetic session facts (test-plan §6.2). Counts, byte lengths, and epoch
 * timestamps only; never a title, prompt, body, part payload, or real path.
 */
import { DAY_MS, NOW_MS } from "./harness";

export type SessionFixture = {
  readonly id: string;
  readonly parentId?: string;
  readonly timeCreated: number;
  readonly timeUpdated: number;
  readonly timeArchived?: number;
  readonly messageCount: number;
  readonly partCount: number;
  readonly dataBytes: number;
  readonly hasChildren?: boolean;
};

export type SessionInput = {
  readonly id: string;
  readonly parentId?: string;
  readonly timeCreated?: number;
  readonly timeUpdated?: number;
  readonly timeArchived?: number;
  readonly messageCount?: number;
  readonly partCount?: number;
  readonly dataBytes?: number;
  readonly hasChildren?: boolean;
};

export const makeSession = (input: SessionInput): SessionFixture => ({
  id: input.id,
  ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
  timeCreated: input.timeCreated ?? NOW_MS - DAY_MS,
  timeUpdated: input.timeUpdated ?? NOW_MS - DAY_MS,
  ...(input.timeArchived === undefined ? {} : { timeArchived: input.timeArchived }),
  messageCount: input.messageCount ?? 0,
  partCount: input.partCount ?? 0,
  dataBytes: input.dataBytes ?? 0,
  ...(input.hasChildren === undefined ? {} : { hasChildren: input.hasChildren }),
});

/** The adapter's pinned page/selection row shape. */
export const sessionRow = (session: SessionFixture): Record<string, unknown> => ({
  id: session.id,
  parent_id: session.parentId ?? null,
  time_created: session.timeCreated,
  time_updated: session.timeUpdated,
  time_archived: session.timeArchived ?? null,
  has_children: session.hasChildren === true ? 1 : 0,
  message_count: session.messageCount,
  part_count: session.partCount,
  data_bytes: session.dataBytes,
});

export const sessions = (count: number, prefix = "ses"): SessionFixture[] =>
  Array.from({ length: count }, (_, index) =>
    makeSession({
      id: `${prefix}_${String(index).padStart(3, "0")}`,
      timeUpdated: NOW_MS - DAY_MS - index * 1_000,
      messageCount: index % 3,
      partCount: index % 2,
      dataBytes: index,
    }),
  );
