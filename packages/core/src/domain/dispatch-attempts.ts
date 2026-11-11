/**
 * The pure attempt read-side projection, total order, and bounded page
 * (GH-289 F-2, F-6; DM-1, DM-2, DM-4, DM-5; TDR-0024 C-3).
 *
 * No I/O, no clock, no locale, no terminal width, and no `Buffer`: the byte
 * length is computed in runtime-neutral code. The projection is a fixed
 * allowlist of sixteen fields, the order is total (startedAt desc, recordedAt
 * desc, attemptId asc), and at most one truncation object is returned, with the
 * ledger scope taking precedence over the page byte budget.
 */
import {
  ATTEMPTS_DEFAULT_LIMIT,
  DISPATCH_MAX_EVIDENCE_REFS,
  DISPATCH_MAX_MACHINE_BYTES,
  type AttemptsRefSource,
  type DispatchAttemptRecord,
  type DispatchAttemptView,
  type DispatchAttemptsData,
  type DispatchAttemptsTruncation,
} from "#contracts";

/** One page-selection input: the retained ledger window plus the query. */
export type AttemptsPageInput = {
  readonly records: readonly DispatchAttemptRecord[];
  readonly repository: string;
  readonly ref: string;
  readonly refSource: AttemptsRefSource;
  readonly limit?: number;
  /** The delivered ledger read's declared omission, when one bound. */
  readonly ledgerTruncation?: { readonly bound: number; readonly omittedRecords: number };
  /** The serialized `data` byte budget; defaults to the delivered constant. */
  readonly maxBytes?: number;
};

/** The UTF-8 byte length of a string, without any runtime-specific buffer. */
const utf8Length = (text: string): number => {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/** Project exactly the sixteen declared consumer fields from one record. */
export const projectAttempt = (record: DispatchAttemptRecord): DispatchAttemptView => {
  const { class: cmpClass, token: cmpToken, outcome: cmpOutcome } = record.comparison;
  return {
    attemptId: record.attemptId,
    repository: record.repository,
    ref: record.ref,
    harness: record.harness,
    evidenceClass: record.evidenceClass,
    outcome: record.outcome,
    token: record.token,
    startedAt: record.startedAt,
    endedAt: record.finishedAt,
    divergenceRef: record.divergenceRef ?? null,
    corroboration: {
      pmNotes: record.corroboration.pmNotes,
      tracker: record.corroboration.tracker,
      ci: record.corroboration.ci,
    },
    falseSuccess: record.falseSuccess,
    comparison: { class: cmpClass, token: cmpToken ?? null, outcome: cmpOutcome },
    resumeMode: record.resumeMode ?? null,
    evidenceRefs: record.evidenceRefs.slice(0, DISPATCH_MAX_EVIDENCE_REFS),
    recordedAt: record.recordedAt,
  };
};

/**
 * The total declared order: `startedAt` descending, then `recordedAt`
 * descending, then `attemptId` ascending, independent of insertion or map order.
 */
export const orderAttempts = (
  records: readonly DispatchAttemptRecord[],
): readonly DispatchAttemptRecord[] =>
  [...records].sort(
    (left, right) =>
      compareText(right.startedAt, left.startedAt) ||
      compareText(right.recordedAt, left.recordedAt) ||
      compareText(left.attemptId, right.attemptId),
  );

const buildData = (input: {
  readonly repository: string;
  readonly ref: string;
  readonly refSource: AttemptsRefSource;
  readonly limit: number;
  readonly matched: number;
  readonly views: readonly DispatchAttemptView[];
  readonly foreignRepository: number;
  readonly truncation?: DispatchAttemptsTruncation;
}): DispatchAttemptsData => ({
  repository: input.repository,
  ref: input.ref,
  refSource: input.refSource,
  limit: input.limit,
  matched: input.matched,
  hasMore: input.matched > input.views.length,
  attempts: input.views,
  excluded: { foreignRepository: input.foreignRepository },
  ...(input.truncation === undefined ? {} : { truncation: input.truncation }),
});

/**
 * Select the read side's page: repository filter, ref filter, total order, the
 * row bound, then the UTF-8 byte budget over the serialized `data`.
 *
 * `excluded.foreignRepository` counts records of another repository in the
 * retained ledger window, independent of `--ref`, and never names one. A page
 * shortened by the byte budget declares the page scope with the byte bound and
 * the dropped-row count; a ledger omission takes precedence over it.
 */
export const selectAttemptsPage = (input: AttemptsPageInput): DispatchAttemptsData => {
  const limit = input.limit ?? ATTEMPTS_DEFAULT_LIMIT;
  const maxBytes = input.maxBytes ?? DISPATCH_MAX_MACHINE_BYTES;
  const foreignRepository = input.records.filter(
    (record) => record.repository !== input.repository,
  ).length;
  const matching = input.records.filter(
    (record) => record.repository === input.repository && record.ref === input.ref,
  );
  const ordered = orderAttempts(matching);
  const page = ordered.slice(0, limit);
  const ledgerTruncation: DispatchAttemptsTruncation | undefined =
    input.ledgerTruncation === undefined
      ? undefined
      : {
          scope: "ledger",
          bound: input.ledgerTruncation.bound,
          omittedRecords: input.ledgerTruncation.omittedRecords,
        };
  let views = page.map(projectAttempt);
  let truncation = ledgerTruncation;
  let data = buildData({
    repository: input.repository,
    ref: input.ref,
    refSource: input.refSource,
    limit,
    matched: ordered.length,
    views,
    foreignRepository,
    ...(truncation === undefined ? {} : { truncation }),
  });
  let dropped = 0;
  while (views.length > 0 && utf8Length(JSON.stringify(data)) > maxBytes) {
    views = views.slice(0, -1);
    dropped += 1;
    truncation = ledgerTruncation ?? { scope: "page", bound: maxBytes, omittedRecords: dropped };
    data = buildData({
      repository: input.repository,
      ref: input.ref,
      refSource: input.refSource,
      limit,
      matched: ordered.length,
      views,
      foreignRepository,
      ...(truncation === undefined ? {} : { truncation }),
    });
  }
  return data;
};
