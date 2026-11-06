/**
 * Dev-only commit transport and port fakes (GH-227 test-plan §4.1).
 *
 * Scripted transports implement the commit transport port with ordered attempts,
 * availability states, and call/bundle recorders. Every fake is deterministic,
 * has no network access, and never invokes a real model.
 */
import type {
  CommitMessageDraft,
  CommitSafetyFinding,
  CommitSafetyOutcome,
  CommitTokenSpend,
  CommitTransportAvailability,
  CommitTransportOutcome,
  CommitTransportPort,
  CommitTransportRequest,
  CommitlintOutcome,
  CommitlintPort,
} from "@delivery-os/core/contracts";

/** One scripted transport step. */
export type ScriptedTransportStep =
  | {
      readonly kind: "success";
      readonly message: CommitMessageDraft;
      readonly tokenSpend?: CommitTokenSpend;
    }
  | { readonly kind: "failure"; readonly code: string; readonly detail?: string }
  | { readonly kind: "throw"; readonly detail?: string };

/** A scripted transport with its recorded calls and remaining steps. */
export type ScriptedTransport = CommitTransportPort & {
  readonly calls: readonly CommitTransportRequest[];
  readonly remaining: number;
  push(step: ScriptedTransportStep): void;
};

const ZERO: CommitTokenSpend = { inputTokens: 0, outputTokens: 0 };

/** Build an ordered scripted transport; each generate consumes one step. */
export const createScriptedTransport = (
  steps: readonly ScriptedTransportStep[] = [],
): ScriptedTransport => {
  const queue = [...steps];
  const calls: CommitTransportRequest[] = [];
  return {
    get calls() {
      return [...calls];
    },
    get remaining() {
      return queue.length;
    },
    push(step) {
      queue.push(step);
    },
    generate: async (request) => {
      calls.push(request);
      const step = queue.shift();
      if (step === undefined) {
        return { ok: false, transport: "core-inference", code: "script-exhausted" };
      }
      if (step.kind === "throw") {
        return { ok: false, transport: "core-inference", code: "script-throw", ...(step.detail === undefined ? {} : { detail: step.detail }) };
      }
      if (step.kind === "failure") {
        return {
          ok: false,
          transport: "core-inference",
          code: step.code,
          ...(step.detail === undefined ? {} : { detail: step.detail }),
        };
      }
      return {
        ok: true,
        message: step.message,
        transport: "core-inference",
        tokenSpend: step.tokenSpend ?? ZERO,
      } satisfies CommitTransportOutcome;
    },
  };
};

/** Build availability facts with explicit overrides. */
export const transportAvailability = (
  overrides: Partial<CommitTransportAvailability> = {},
): CommitTransportAvailability => ({
  coreInference: { available: true },
  harnessOneShot: { available: false },
  ...overrides,
});

/** A scripted commitlint port recording every checked message. */
export type ScriptedCommitlint = CommitlintPort & {
  readonly calls: readonly CommitMessageDraft[];
  push(outcome: CommitlintOutcome): void;
};

/** Build a commitlint fake; absent is the default so deterministic checks alone run. */
export const createScriptedCommitlint = (
  outcomes: readonly CommitlintOutcome[] = [],
): ScriptedCommitlint => {
  const queue = [...outcomes];
  const calls: CommitMessageDraft[] = [];
  return {
    get calls() {
      return [...calls];
    },
    push(outcome) {
      queue.push(outcome);
    },
    check: async (message) => {
      calls.push(message);
      return queue.shift() ?? { status: "absent", errors: [] };
    },
  };
};

/** The safety scanner fake's mutable state and recorded calls. */
export type ScriptedSafetyScanner = {
  readonly calls: readonly (readonly { readonly path: string }[])[];
  setOutcome(outcome: CommitSafetyOutcome): void;
  setFindings(findings: readonly CommitSafetyFinding[]): void;
  setUnavailable(detail?: string): void;
  onScan: ((files: readonly { readonly path: string }[]) => void) | undefined;
};

/** Build a safety fake; clean by default, recording every scanned path set. */
export const createSafetyScanner = (): ScriptedSafetyScanner & {
  scan: (files: readonly { readonly path: string }[]) => Promise<CommitSafetyOutcome>;
} => {
  let outcome: CommitSafetyOutcome = { ok: true, findings: [] };
  const calls: (readonly { readonly path: string }[])[] = [];
  const scanner: ScriptedSafetyScanner & {
    scan: (files: readonly { readonly path: string }[]) => Promise<CommitSafetyOutcome>;
  } = {
    get calls() {
      return [...calls];
    },
    setOutcome(value) {
      outcome = value;
    },
    setFindings(findings) {
      outcome = { ok: true, findings };
    },
    setUnavailable(detail = "scanner unavailable") {
      outcome = { ok: false, code: "commit.safety.scan-unavailable", detail };
    },
    onScan: undefined,
    scan: async (files) => {
      calls.push([...files]);
      scanner.onScan?.([...files]);
      return outcome;
    },
  };
  return scanner;
};
