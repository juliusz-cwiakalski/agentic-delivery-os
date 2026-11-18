/**
 * TC-HDA-029 type half — `DispatchEnvelopeError` is additive on the dispatch
 * envelope only: `detail` is optional and narrow, `kind` is the two-value
 * union, and the shared `CommandResultError` stays at six fields.
 *
 * Compiled by `pnpm typecheck` (`tests/types/tsconfig.json`), not run by Bun.
 */

import type {
  CommandResultDetail,
  CommandResultError,
  CommandResultFailure,
  DispatchEnvelopeData,
  DispatchEnvelopeError,
} from "../../packages/core/src/contracts/index";
import { COMMAND_FAILURE_DETAIL_MAX_CHARS } from "../../packages/core/src/contracts/index";

/** The delivered six-field shared error, unchanged. */
const shared: CommandResultError = {
  code: "config.value.invalid",
  category: "user",
  retryable: false,
  consequence: "not_landed",
  remediationHint: "synthetic remediation",
  summary: "synthetic summary",
};

/** The additive envelope-root detail slot (TDR-0027 ALT-3). */
const refusalDetail: CommandResultDetail = { holder: "lane-1" };

const failureWithDetail: CommandResultFailure = {
  schemaVersion: "delivery.result.v1",
  runId: "run-detail-0001",
  exitCode: 1,
  timing: { totalMs: 3 },
  error: shared,
  detail: refusalDetail,
};

/** The declared harness evidence member (TDR-0037): four closed facts. */
const harnessEvidence: CommandResultDetail = {
  harness: {
    kind: "opencode",
    observedVersion: "2.3.2",
    versionVerdict: "inside",
    mode: "per-invocation-private-server",
  },
};

/** The indeterminate case: explicit null and no mode member at all. */
const harnessEvidenceIndeterminate: CommandResultDetail = {
  harness: { kind: "opencode", observedVersion: null, versionVerdict: "indeterminate" },
};

const rejectedHarnessVerdict: CommandResultDetail = {
  harness: {
    kind: "opencode",
    observedVersion: "2.3.2",
    // @ts-expect-error — the verdict vocabulary is closed.
    versionVerdict: "probable",
  },
};

const rejectedHarnessMember: CommandResultDetail = {
  harness: {
    kind: "opencode",
    observedVersion: "2.3.2",
    versionVerdict: "outside",
    // @ts-expect-error — the slot is closed; it never becomes an open key-value map.
    availableModes: ["per-invocation-private-server"],
  },
};

/** A failure without the member carries no detail key. */
const failureWithoutDetail: CommandResultFailure = {
  schemaVersion: "delivery.result.v1",
  runId: "run-detail-0002",
  exitCode: 1,
  timing: { totalMs: 3 },
  error: shared,
};

const rejectedDetailMember: CommandResultDetail = {
  // @ts-expect-error — the detail contract is closed; `session` is not a member.
  session: "s1",
};

const detailBound: number = COMMAND_FAILURE_DETAIL_MAX_CHARS;

/** A dispatch error without detail stays assignable (non-spawn dispatch rows). */
const withoutDetail: DispatchEnvelopeError = shared;

const harnessDetail: DispatchEnvelopeError = {
  ...shared,
  detail: {
    kind: "harness",
    code: "harness.spawn.variable-missing",
    field: "HARNESS_MODEL",
  },
};

const configDetailNoField: DispatchEnvelopeError = {
  ...shared,
  detail: {
    kind: "config",
    code: "config.credential.missing",
  },
};

/** The detail is assignable to the dispatch envelope error slot. */
const asEnvelopeError: NonNullable<DispatchEnvelopeData["error"]> = harnessDetail;

const rejectedKind: DispatchEnvelopeError = {
  ...shared,
  detail: {
    // @ts-expect-error — `kind` is exactly "harness" | "config".
    kind: "network",
    code: "synthetic.code",
  },
};

const rejectedDetailKindType: DispatchEnvelopeError = {
  ...shared,
  detail: {
    kind: "harness",
    // @ts-expect-error — `code` is a string identifier, never a number.
    code: 42,
  },
};

const rejectedSharedWidening: CommandResultError = {
  ...shared,
  // @ts-expect-error — `CommandResultError` must not gain a detail member.
  detail: { kind: "harness", code: "harness.spawn.refused" },
};

const rejectedSharedField: CommandResultError = {
  ...shared,
  // @ts-expect-error — the shared error type carries no field member.
  field: "HARNESS_MODEL",
};

type SharedKeys = keyof CommandResultError;
const sharedKeys: readonly SharedKeys[] = [
  "category",
  "code",
  "consequence",
  "remediationHint",
  "retryable",
  "summary",
];

export {
  asEnvelopeError,
  configDetailNoField,
  detailBound,
  failureWithDetail,
  failureWithoutDetail,
  harnessDetail,
  harnessEvidence,
  harnessEvidenceIndeterminate,
  refusalDetail,
  rejectedDetailKindType,
  rejectedDetailMember,
  rejectedHarnessMember,
  rejectedHarnessVerdict,
  rejectedKind,
  rejectedSharedField,
  rejectedSharedWidening,
  shared,
  sharedKeys,
  withoutDetail,
};
