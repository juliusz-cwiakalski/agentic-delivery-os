/**
 * TC-MCP-002 / TC-MCP-010 / TC-MCP-017 type probe — the payload contract reuses
 * the engine data types and the CLI error shape by reference, and the toolset
 * runtime exposes no write, fence, commit, apply, merge, or delete member.
 *
 * Not named `*.test.ts`, so Bun discovery ignores it; the root `typecheck`
 * compiles it through `tests/types/tsconfig.json`.
 */

import type {
  CommandResultError,
  StatusDigest,
  VerifyGatesReport,
} from "../../packages/core/src/contracts/index";
import type { VerifyChangeSuccessData } from "../../packages/core/src/index";
import type {
  GateReportToolData,
  GateReportToolRuntime,
  McpToolError,
  StatusToolData,
  StatusToolRuntime,
  VerifyArtifactToolData,
  VerifyArtifactToolRuntime,
} from "../../packages/mcp/src/index";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

type StatusIsDigest = Expect<Equal<StatusToolData, StatusDigest>>;
type VerifyIsEngineData = Expect<Equal<VerifyArtifactToolData, VerifyChangeSuccessData>>;
type GatesIsReport = Expect<Equal<GateReportToolData, VerifyGatesReport>>;
type ErrorIsCliShape = Expect<Equal<McpToolError, CommandResultError>>;

type ForbiddenMember =
  | "write"
  | "apply"
  | "mutate"
  | "merge"
  | "delete"
  | "commit"
  | "append"
  | "replaceDocument"
  | "acquireFence"
  | "releaseFence"
  | "recoverFence"
  | "repairTornTail"
  | "salvage"
  | "spawn"
  | "exec"
  | "execFile"
  | "fork";

type NoForbidden<T> = Extract<ForbiddenMember, keyof T> extends never ? true : false;

type StatusRuntimeIsReadOnly = Expect<NoForbidden<StatusToolRuntime>>;
type VerifyRuntimeIsReadOnly = Expect<NoForbidden<VerifyArtifactToolRuntime>>;
type GatesRuntimeIsReadOnly = Expect<NoForbidden<GateReportToolRuntime>>;

/** Failure payload keys are exactly the CLI contract keys. */
type ErrorKeys = keyof CommandResultError;
type RequiredErrorKeys = "code" | "category" | "retryable" | "consequence" | "remediationHint";
type ErrorHasRequiredKeys = Expect<Equal<Extract<RequiredErrorKeys, ErrorKeys>, RequiredErrorKeys>>;
type ErrorHasNoEnvelopeKey = Expect<
  Equal<Extract<"exitCode" | "runId" | "timing", ErrorKeys>, never>
>;

export type Probes = [
  StatusIsDigest,
  VerifyIsEngineData,
  GatesIsReport,
  ErrorIsCliShape,
  StatusRuntimeIsReadOnly,
  VerifyRuntimeIsReadOnly,
  GatesRuntimeIsReadOnly,
  ErrorHasRequiredKeys,
  ErrorHasNoEnvelopeKey,
];
