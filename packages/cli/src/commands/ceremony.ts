/**
 * The `ceremony list|run|resume|catch-up` command definition (GH-296 F-1).
 *
 * The handler owns the four-verb grammar, the `--note`/`--window`/`--apply`/
 * `--name` flag grammar, and the window value grammar before any runtime call.
 * It performs no stream write, chooses no exit code, and never inspects `--json`.
 * Grammar refusals resolve through the delivered `fallback.invocation` identity
 * before any read or write.
 */
import type { CeremonyWindow } from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";
import { renderCeremonyText } from "../output/ceremony-text.js";

/** One refusal or runtime result. */
export type CeremonyCommandFailure = {
  readonly code: string;
  readonly summary: string;
  readonly field?: string;
  readonly kind?: string;
};

export type CeremonyCommandResult =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly error: CeremonyCommandFailure };

/** The injected ceremony runtime; every read and write is a port. */
export type CeremonyCommandRuntime = {
  list(): CeremonyCommandResult | Promise<CeremonyCommandResult>;
  run(input: {
    readonly name: string;
    readonly notePath?: string;
    readonly window?: CeremonyWindow;
    readonly apply: boolean;
  }): CeremonyCommandResult | Promise<CeremonyCommandResult>;
  resume(input: {
    readonly runId: string;
    readonly apply: boolean;
  }): CeremonyCommandResult | Promise<CeremonyCommandResult>;
  catchUp(input: {
    readonly name?: string;
  }): CeremonyCommandResult | Promise<CeremonyCommandResult>;
};

const VERBS = ["list", "run", "resume", "catch-up"] as const;

const invocationFailure = (
  summary: string,
  field?: string,
): { readonly error: CeremonyCommandFailure } => ({
  error: {
    code: "fallback.invocation",
    summary,
    ...(field === undefined ? {} : { field }),
    kind: "fallback",
  },
});

const valueFailure = (
  summary: string,
  field: string,
): { readonly error: CeremonyCommandFailure } => ({
  error: { code: "input.value.rejected", summary, field, kind: "input" },
});

const asHandler = (
  result: CeremonyCommandResult,
): { readonly data: unknown } | { readonly error: CeremonyCommandFailure } =>
  result.ok
    ? { data: result.data }
    : {
        error: {
          ...result.error,
          kind: result.error.kind ?? kindFor(result.error.code),
        },
      };

const kindFor = (code: string): string => {
  if (code.startsWith("fallback.")) return "fallback";
  if (code.startsWith("state.")) return "state";
  if (code.startsWith("config.")) return "config";
  if (code.startsWith("input.")) return "input";
  if (code.startsWith("ceremony.")) return "ceremony";
  return "input";
};

const parseWindow = (
  value: string,
):
  | { readonly ok: true; readonly window: CeremonyWindow }
  | { readonly ok: false; readonly summary: string } => {
  const parts = value.split("..");
  if (parts.length !== 2) {
    return { ok: false, summary: '--window must be "<start>..<end>"' };
  }
  const [start, end] = parts;
  if (start === undefined || end === undefined || start.length === 0 || end.length === 0) {
    return { ok: false, summary: "--window must name both a start and an end" };
  }
  if (start > end) {
    return { ok: false, summary: `--window start "${start}" is after end "${end}"` };
  }
  return { ok: true, window: { start, end } };
};

const exitProjectionFor = (data: unknown): "success" | "user-validation" => {
  if (typeof data !== "object" || data === null) return "success";
  const record = data as Record<string, unknown>;
  if (record.verdict === "unverified") return "user-validation";
  if (record.outcome === "unverified") return "user-validation";
  return "success";
};

/** Build the ceremony command definition over the injected runtime. */
export const createCeremonyCommandDefinition = (
  runtime: CeremonyCommandRuntime,
): CommandDefinition => ({
  flags: ["--note", "--window", "--apply", "--name"],
  requiresValue: ["--note", "--window", "--name"],
  positionals: { max: 2 },
  humanText: (data: unknown): string => renderCeremonyText(data),
  exitProjection: (data: unknown): "success" | "user-validation" => exitProjectionFor(data),
  handler: async ({ positionals, flags }) => {
    const [verb, subject, ...extra] = positionals;
    if (extra.length > 0) {
      return invocationFailure(`unexpected positional "${extra[0] as string}"`);
    }
    if (verb === undefined) return invocationFailure("missing ceremony verb");
    if (!(VERBS as readonly string[]).includes(verb)) {
      return invocationFailure(`unknown ceremony verb "${verb}"`);
    }
    const rawWindow = flags["--window"];
    let window: CeremonyWindow | undefined;
    if (rawWindow !== undefined) {
      if (typeof rawWindow !== "string") return invocationFailure('missing value for "--window"');
      const parsed = parseWindow(rawWindow);
      if (!parsed.ok) return valueFailure(parsed.summary, "--window");
      window = parsed.window;
    }
    const apply = flags["--apply"] === true;
    const notePath = typeof flags["--note"] === "string" ? flags["--note"] : undefined;

    if (verb === "list") {
      if (subject !== undefined) return invocationFailure(`unexpected positional "${subject}"`);
      return asHandler(await runtime.list());
    }
    if (verb === "run") {
      if (subject === undefined) return invocationFailure("missing ceremony name");
      return asHandler(
        await runtime.run({
          name: subject,
          ...(notePath === undefined ? {} : { notePath }),
          ...(window === undefined ? {} : { window }),
          apply,
        }),
      );
    }
    if (verb === "resume") {
      if (subject === undefined) return invocationFailure("missing run id");
      return asHandler(await runtime.resume({ runId: subject, apply }));
    }
    const name = typeof flags["--name"] === "string" ? flags["--name"] : undefined;
    if (subject !== undefined && name === undefined) {
      return invocationFailure(`unexpected positional "${subject}"`);
    }
    return asHandler(await runtime.catchUp(name === undefined ? {} : { name }));
  },
});

/** Re-export the kind resolution for the runtime composition. */
export const ceremonyErrorKind = (code: string): string => kindFor(code);
