/**
 * TC-HDA-029 type half — `DispatchEnvelopeError` is additive on the dispatch
 * envelope only: `detail` is optional and narrow, `kind` is the two-value
 * union, and the shared `CommandResultError` stays at six fields.
 *
 * Compiled by `pnpm typecheck` (`tests/types/tsconfig.json`), not run by Bun.
 */
import type {
  CommandResultError,
  DispatchEnvelopeData,
  DispatchEnvelopeError,
} from "../../packages/core/src/contracts/index";

/** The delivered six-field shared error, unchanged. */
const shared: CommandResultError = {
  code: "config.value.invalid",
  category: "user",
  retryable: false,
  consequence: "not_landed",
  remediationHint: "synthetic remediation",
  summary: "synthetic summary",
};

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
  harnessDetail,
  rejectedDetailKindType,
  rejectedKind,
  rejectedSharedField,
  rejectedSharedWidening,
  shared,
  sharedKeys,
  withoutDetail,
};
