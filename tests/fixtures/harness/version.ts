/**
 * The version verdict and probe-grammar table (test plan §4.4, V-01..V-19).
 *
 * One data table serves the behaviour and grammar suites so parse acceptance and
 * rejection cannot drift apart. `raw` is the probe stdout; `normalized` is the
 * bare semantic version the gate stamps (or explicit null for indeterminate).
 */
import type { HarnessVersionVerdict } from "../../../packages/core/src/contracts/index";

export type VersionIdentity = "harness.version.unsupported" | "harness.version.unknown" | null;

export type VersionRow = {
  readonly id: string;
  readonly raw: string;
  readonly normalized: string | null;
  readonly verdict: HarnessVersionVerdict;
  readonly identity: VersionIdentity;
  readonly exit: 0 | 1;
  readonly note: string;
};

/** The observed accepted grammar: product token, optional `v`, three-part semver, one line. */
export const ACCEPTED_GRAMMAR_EXAMPLES: readonly string[] = [
  "opencode v2.3.2",
  "opencode 2.3.2",
  "opencode v2.2.5",
];

export const VERSION_TABLE: readonly VersionRow[] = [
  {
    id: "V-01",
    raw: "opencode v2.3.2",
    normalized: "2.3.2",
    verdict: "inside",
    identity: null,
    exit: 0,
    note: "the observed delivery output",
  },
  {
    id: "V-02",
    raw: "opencode v2.2.5",
    normalized: "2.2.5",
    verdict: "inside",
    identity: null,
    exit: 0,
    note: "the observed intake output; previous minor, still inside",
  },
  {
    id: "V-03",
    raw: "opencode v2.3.0",
    normalized: "2.3.0",
    verdict: "inside",
    identity: null,
    exit: 0,
    note: "lower bound of the current line",
  },
  {
    id: "V-04",
    raw: "opencode v2.4.0",
    normalized: "2.4.0",
    verdict: "outside",
    identity: "harness.version.unsupported",
    exit: 1,
    note: "the next minor is out",
  },
  {
    id: "V-05",
    raw: "opencode v2.1.7",
    normalized: "2.1.7",
    verdict: "outside",
    identity: "harness.version.unsupported",
    exit: 1,
    note: "the previous-previous line is out of window (M-01)",
  },
  {
    id: "V-06",
    raw: "opencode v3.0.0",
    normalized: "3.0.0",
    verdict: "outside",
    identity: "harness.version.unsupported",
    exit: 1,
    note: "a major beyond the window",
  },
  {
    id: "V-07",
    raw: "opencode v2.3.2\n",
    normalized: "2.3.2",
    verdict: "inside",
    identity: null,
    exit: 0,
    note: "the observed newline framing is accepted",
  },
  {
    id: "V-08",
    raw: "opencode 2.3.2",
    normalized: "2.3.2",
    verdict: "inside",
    identity: null,
    exit: 0,
    note: "the v is optional",
  },
  {
    id: "V-09",
    raw: "2.3.2",
    normalized: null,
    verdict: "indeterminate",
    identity: "harness.version.unknown",
    exit: 1,
    note: "a bare semver with no product token is off-grammar",
  },
  {
    id: "V-10",
    raw: "",
    normalized: null,
    verdict: "indeterminate",
    identity: "harness.version.unknown",
    exit: 1,
    note: "empty output",
  },
  {
    id: "V-11",
    raw: "opencode v2.3.2\nopencode v2.1.7",
    normalized: null,
    verdict: "indeterminate",
    identity: "harness.version.unknown",
    exit: 1,
    note: "multiple lines are never pick-one",
  },
  {
    id: "V-12",
    raw: "opencode v2.3.2 extra",
    normalized: null,
    verdict: "indeterminate",
    identity: "harness.version.unknown",
    exit: 1,
    note: "the line must match the grammar end to end",
  },
  {
    id: "V-13a",
    raw: "opencode v2.3",
    normalized: null,
    verdict: "indeterminate",
    identity: "harness.version.unknown",
    exit: 1,
    note: "a two-part version is never a match",
  },
  {
    id: "V-13b",
    raw: "opencode v2.3.2.1",
    normalized: null,
    verdict: "indeterminate",
    identity: "harness.version.unknown",
    exit: 1,
    note: "a four-part version is never a match",
  },
  {
    id: "V-14a",
    raw: "v2.3.2",
    normalized: null,
    verdict: "indeterminate",
    identity: "harness.version.unknown",
    exit: 1,
    note: "no product token",
  },
  {
    id: "V-14b",
    raw: "latest",
    normalized: null,
    verdict: "indeterminate",
    identity: "harness.version.unknown",
    exit: 1,
    note: "an unparseable label",
  },
  {
    id: "V-14c",
    raw: "2.three.2",
    normalized: null,
    verdict: "indeterminate",
    identity: "harness.version.unknown",
    exit: 1,
    note: "a non-numeric segment",
  },
  {
    id: "V-14d",
    raw: "2.3.x",
    normalized: null,
    verdict: "indeterminate",
    identity: "harness.version.unknown",
    exit: 1,
    note: "a wildcard is not a version",
  },
  {
    id: "V-15a",
    raw: "opencode v2.20.0",
    normalized: "2.20.0",
    verdict: "outside",
    identity: "harness.version.unsupported",
    exit: 1,
    note: "a prefix-shaped near-miss parses and is out of window",
  },
  {
    id: "V-15b",
    raw: "opencode v12.2.5",
    normalized: "12.2.5",
    verdict: "outside",
    identity: "harness.version.unsupported",
    exit: 1,
    note: "a prefix-shaped near-miss parses and is out of window",
  },
];

/** The probe-outcome cases that are not a raw stdout string (V-16, V-17). */
export type ProbeOutcomeRow = {
  readonly id: string;
  readonly status: "answered" | "timed-out";
  readonly stdout: string;
  readonly reject: boolean;
  readonly identity: VersionIdentity;
  readonly exit: 0 | 1;
  readonly note: string;
};

export const PROBE_OUTCOME_TABLE: readonly ProbeOutcomeRow[] = [
  {
    id: "V-16",
    status: "answered",
    stdout: "opencode v2.3.2",
    reject: true,
    identity: "harness.version.unknown",
    exit: 1,
    note: "a non-zero exit is indeterminate regardless of stdout",
  },
  {
    id: "V-17",
    status: "timed-out",
    stdout: "",
    reject: false,
    identity: "harness.version.unknown",
    exit: 1,
    note: "the bound was reached: one invocation, no retry",
  },
];
