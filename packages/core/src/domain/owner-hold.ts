/**
 * The pure owner-hold resolver (GH-280 F-1, DM-1, DM-2, DM-9, DEC-7, D12).
 *
 * One injected fact is resolved from three injected inputs: the environment
 * record, the production store directory (or its absence), and the marker
 * outcome. Core reads no ambient environment and no filesystem; the marker is
 * read at the CLI/MCP edge and injected.
 *
 * Precedence: a present environment value with a length greater than zero wins
 * over the marker; an empty environment is not active; a whitespace-only
 * environment is active without a reason; a present marker is active, and an
 * unreadable, non-regular, or stat-failing marker is active without a reason
 * (fail-closed). Only a non-existent marker path is inactive.
 */

import {
  OWNER_HOLD_ENV_SUFFIX,
  OWNER_HOLD_MAX_REASON_CHARS,
  type OwnerHoldFact,
  type OwnerHoldMarkerOutcome,
  type OwnerHoldSource,
} from "#contracts";

export type { OwnerHoldMarkerOutcome } from "#contracts";

/** Everything the pure resolver consumes; every input is injected. */
export type OwnerHoldResolutionInput = {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly environmentPrefix: string;
  /** The production store directory, or `undefined` when no home is resolvable. */
  readonly storeDirectory?: string | undefined;
  readonly marker: OwnerHoldMarkerOutcome;
};

/**
 * The brand-derived variable name: the prefix normalized to exactly one
 * trailing underscore plus the declared suffix. Never a product literal.
 */
export const ownerHoldEnvironmentVariableName = (environmentPrefix: string): string => {
  const normalized = environmentPrefix.endsWith("_") ? environmentPrefix : `${environmentPrefix}_`;
  return `${normalized}${OWNER_HOLD_ENV_SUFFIX}`;
};

const ESCAPE = String.fromCharCode(27);
const ANSI_ESCAPE = new RegExp(`${ESCAPE}\\[[0-?]*[ -/]*[@-~]`, "gu");
const LINE_BREAKS_AND_TABS = /[\r\n\t\v\f\u0085]+/gu;
const C0_C1_CONTROL = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f]", "gu");
const WHITESPACE_RUN = /\s+/gu;

/**
 * Make one bounded, control-free reason line. Strips ANSI and C0/C1 control
 * characters, folds line breaks and tabs to a single space, collapses
 * whitespace, trims, and truncates to 160 code points with no ellipsis. An
 * empty result is omitted by the caller, never rendered as an empty segment.
 */
export const sanitizeOwnerHoldReason = (value: string): string | undefined => {
  const withoutAnsi = value.replace(ANSI_ESCAPE, "");
  const singleLine = withoutAnsi
    .replace(LINE_BREAKS_AND_TABS, " ")
    .replace(C0_C1_CONTROL, "")
    .replace(WHITESPACE_RUN, " ")
    .trim();
  if (singleLine.length === 0) return undefined;
  const characters = Array.from(singleLine);
  return characters.length <= OWNER_HOLD_MAX_REASON_CHARS
    ? singleLine
    : characters.slice(0, OWNER_HOLD_MAX_REASON_CHARS).join("");
};

const active = (source: OwnerHoldSource, reason: string | undefined): OwnerHoldFact =>
  reason === undefined ? { active: true, source } : { active: true, source, reason };

/** The first line of a marker is its reason; later lines never contribute. */
const firstLine = (content: string): string => {
  const newline = content.search(/[\r\n]/u);
  return newline === -1 ? content : content.slice(0, newline);
};

/** Resolve one owner-hold fact from the injected environment and marker outcome. */
export const resolveOwnerHoldFact = (input: OwnerHoldResolutionInput): OwnerHoldFact => {
  const key = ownerHoldEnvironmentVariableName(input.environmentPrefix);
  const environmentValue = input.environment[key];
  if (environmentValue !== undefined && environmentValue.length > 0) {
    return active("env", sanitizeOwnerHoldReason(environmentValue));
  }
  if (input.storeDirectory === undefined) return { active: false };
  switch (input.marker.state) {
    case "absent":
      return { active: false };
    case "unreadable":
      return active("marker", undefined);
    case "present":
      return active("marker", sanitizeOwnerHoldReason(firstLine(input.marker.content)));
  }
};
