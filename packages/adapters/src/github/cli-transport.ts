/**
 * The GitHub CLI transport: one `ProviderTransport` over `gh api` (F-2, DM-5,
 * DM-7, DM-10; TDR-0031).
 *
 * The vendor CLI is used strictly as an authenticated API caller: an
 * already-shaped `ProviderRequest` is mapped onto one fixed argv array, the
 * child environment is constructed entirely from injected data, and the final
 * `--include` status block is authoritative. There is no shell, no pagination,
 * no output transform, no retry, and no per-request failover.
 *
 * Runtime APIs (a bounded fixed-argv `gh` invocation) are admitted for this file
 * by ADR-0005's exact `github` provider-subpath entry, refined by TDR-0031 item
 * 9: the admitted meaning now covers this one bounded, no-shell child
 * invocation in addition to network I/O. No ambient environment is read.
 */
import { execFile } from "node:child_process";
import { type AdapterOperation, CLOSEOUT_OPERATION_TIMEOUT_MS } from "@delivery-os/core/contracts";
import type {
  ProviderRequest,
  ProviderResponse,
  ProviderTransport,
} from "../io/provider-transport.js";

/** The closed set of probe refusal codes (DM-7); adapter-local, never error-table rows. */
export const GITHUB_CLI_REFUSAL_CODES = [
  "provider.cli.unavailable",
  "provider.cli.version-unsupported",
  "provider.cli.capability-unsupported",
] as const;

/** One probe refusal code. */
export type GithubCliRefusalCode = (typeof GITHUB_CLI_REFUSAL_CODES)[number];

/** The bounded probe result (DM-7): success with a version, or one closed code. */
export type GithubCliProbeResult =
  | { readonly ok: true; readonly version: string }
  | { readonly ok: false; readonly code: GithubCliRefusalCode };

/** One child-runner result; a non-zero exit is data, not a throw. */
export type GithubChildRunnerResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
  readonly timedOut: boolean;
};

/**
 * The injectable fixed-argv child seam. Production defaults to `execFile`;
 * every test injects a recording runner so the mock tier spawns nothing.
 */
export type GithubChildRunner = (
  file: string,
  args: readonly string[],
  options: {
    readonly timeout: number;
    readonly killSignal: "SIGKILL";
    readonly env: Readonly<Record<string, string>>;
    readonly maxBuffer: number;
    readonly input?: string;
  },
) => Promise<GithubChildRunnerResult>;

/** One per-operation transport declaration (DM-5). */
export type GithubTransportPreference = {
  readonly preferred: "gh";
  readonly fallback: "api";
};

/**
 * The declared transport matrix (DM-5, AC-F2-1).
 *
 * Uniform by design: `gh api` is transport-level, so every closed operation
 * declares the same preferred/fallback pair. A future per-primitive divergence
 * needs its own decision (TDR-0031 revisit trigger).
 */
export const GITHUB_TRANSPORT_MATRIX: Readonly<
  Record<AdapterOperation, GithubTransportPreference>
> = {
  "read-work-item": { preferred: "gh", fallback: "api" },
  "write-work-item": { preferred: "gh", fallback: "api" },
  "transition-work-item": { preferred: "gh", fallback: "api" },
  "read-delivery-request": { preferred: "gh", fallback: "api" },
  "write-delivery-request": { preferred: "gh", fallback: "api" },
  "read-pipeline-run": { preferred: "gh", fallback: "api" },
  "write-comment": { preferred: "gh", fallback: "api" },
  "resolve-delivery-thread": { preferred: "gh", fallback: "api" },
  "merge-delivery-request": { preferred: "gh", fallback: "api" },
};

/** The closed composition policy (Table C). */
export type GithubTransportPolicy = "prefer-cli" | "api-only";

/**
 * The composition-edge transport selection (DM-10).
 *
 * The resolver's return value, consumed by the launcher. `degradation` is
 * present exactly when the policy is `prefer-cli` and the CLI was not selected;
 * its `code` is the probe refusal code.
 */
export type GithubTransportSelection = {
  readonly policy: GithubTransportPolicy;
  readonly selected: "gh" | "api";
  readonly degradation?: { readonly code: GithubCliRefusalCode };
};

/** Construction input for the CLI transport. */
export type GithubCliTransportOptions = {
  /** The injected child runner; production defaults to a bounded `execFile`. */
  readonly runner?: GithubChildRunner;
  /** The composition's injected environment; it supplies `PATH`, nothing else ambient. */
  readonly environment: Readonly<Record<string, string | undefined>>;
  /** An optional `--hostname` override; otherwise derived from the request URL. */
  readonly host?: string;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
};

/** The declared CLI version window; a version outside it is refused at the probe. */
export const GITHUB_CLI_VERSION_WINDOW = { minimum: "2.0.0", maximum: "2.99.99" } as const;

/** The declared bounded output buffer for one CLI invocation. */
export const GITHUB_CLI_MAX_OUTPUT_BYTES = 1024 * 1024;

/** The probe's declared argv: one bounded version invocation. */
const PROBE_ARGV = ["--version"] as const;

/** The bounded `execFile` production default; a non-zero exit is data, not a throw. */
const execFileRunner: GithubChildRunner = (file, args, options) =>
  new Promise((resolve) => {
    const child = execFile(
      file,
      [...args],
      {
        timeout: options.timeout,
        killSignal: options.killSignal,
        env: { ...options.env },
        maxBuffer: options.maxBuffer,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        const status =
          error === null
            ? 0
            : typeof (error as { readonly code?: unknown }).code === "number"
              ? (error as { readonly code: number }).code
              : 1;
        resolve({
          stdout,
          stderr,
          status,
          timedOut: error !== null && (error as { readonly killed?: boolean }).killed === true,
        });
      },
    );
    if (options.input !== undefined) child.stdin?.end(options.input);
  });

const VERSION_PATTERN = /\bgh version (\d+)\.(\d+)\.(\d+)/u;

const parseVersion = (text: string): readonly [number, number, number] | undefined => {
  const match = VERSION_PATTERN.exec(text);
  if (match === null) return undefined;
  const [, major, minor, patch] = match;
  if (major === undefined || minor === undefined || patch === undefined) return undefined;
  return [Number(major), Number(minor), Number(patch)];
};

const compareVersions = (
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number => {
  for (const index of [0, 1, 2] as const) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
};

const DECLARED_MINIMUM = parseVersion(`gh version ${GITHUB_CLI_VERSION_WINDOW.minimum}`) ?? [
  2, 0, 0,
];
const DECLARED_MAXIMUM = parseVersion(`gh version ${GITHUB_CLI_VERSION_WINDOW.maximum}`) ?? [
  2, 99, 99,
];

/**
 * The isolated CLI configuration directory, derived from injected data only.
 *
 * `gh` reads its own host configuration and stored login unless redirected, so
 * an isolated directory keeps a declared credential from silently acting as an
 * operator's stored account. The value is never the operator's home config.
 */
export const resolveGithubCliConfigDirectory = (
  environment: Readonly<Record<string, string | undefined>>,
): string => {
  const temporary = environment.TMPDIR;
  return temporary !== undefined && temporary.length > 0
    ? `${temporary.replace(/\/+$/u, "")}/jaiship-gh-config`
    : ".jaiship-gh-config";
};

/** Extract the credential material the client already placed on the request. */
const credentialOf = (headers: Readonly<Record<string, string>>): string | undefined => {
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== "authorization") continue;
    const match = /^Bearer\s+(\S+)$/u.exec(value.trim());
    if (match?.[1] !== undefined) return match[1];
  }
  return undefined;
};

/** Build the child environment from injected data only (N9, NFR-3). */
const environmentFor = (input: {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly token?: string;
}): Readonly<Record<string, string>> => ({
  PATH: input.environment.PATH ?? input.environment.Path ?? "",
  GH_CONFIG_DIR: resolveGithubCliConfigDirectory(input.environment),
  GH_PROMPT_DISABLED: "1",
  NO_COLOR: "1",
  GH_NO_UPDATE_NOTIFIER: "1",
  ...(input.token === undefined ? {} : { GH_TOKEN: input.token }),
});

/** Build the one fixed argv array for a request; no shell, no pagination. */
const argvFor = (request: ProviderRequest, host: string): readonly string[] => {
  const url = new URL(request.url);
  const path = `${url.pathname}${url.search}`;
  const headers = Object.entries(request.headers)
    .filter(([name]) => name.toLowerCase() !== "authorization")
    .sort(([left], [right]) => left.localeCompare(right, "en"));
  const argv = ["api", path, "--method", request.method, "--hostname", host, "--include"];
  for (const [name, value] of headers) argv.push("--header", `${name}: ${value}`);
  if (request.body !== undefined) argv.push("--input", "-");
  return argv;
};

const STATUS_LINE = /^HTTP\/[\d.]+\s+(\d{3})(?:\s|$)/u;

/**
 * Reconstruct `{ status, body }` from `--include` output.
 *
 * The final status block is authoritative; an unparsable or absent status block
 * is refused rather than assumed to be 200 (RSK-2).
 */
const parseIncludedResponse = (stdout: string, boundBytes: number): ProviderResponse => {
  if (Buffer.byteLength(stdout, "utf8") > boundBytes) {
    throw new Error("GitHub CLI response exceeded the declared output bound");
  }
  const lines = stdout.split(/\r?\n/u);
  let status: number | undefined;
  let statusIndex = -1;
  for (const [index, line] of lines.entries()) {
    const match = STATUS_LINE.exec(line);
    if (match?.[1] === undefined) continue;
    status = Number(match[1]);
    statusIndex = index;
  }
  if (status === undefined || statusIndex < 0) {
    throw new Error("GitHub CLI output has no parsable status block");
  }
  const separatorIndex = lines.findIndex((line, index) => index > statusIndex && line.length === 0);
  const bodyText = (separatorIndex < 0 ? [] : lines.slice(separatorIndex + 1)).join("\n").trim();
  if (bodyText.length === 0) return { status, body: undefined };
  try {
    const body: unknown = JSON.parse(bodyText);
    return { status, body };
  } catch {
    throw new Error("GitHub CLI output body is not JSON");
  }
};

/** Build the CLI transport over an injected child runner. */
export const createGithubCliTransport = (options: GithubCliTransportOptions): ProviderTransport => {
  const runner = options.runner ?? execFileRunner;
  const timeoutMs = options.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? GITHUB_CLI_MAX_OUTPUT_BYTES;
  return {
    send: async (request: ProviderRequest): Promise<ProviderResponse> => {
      const host = options.host ?? new URL(request.url).host;
      const token = credentialOf(request.headers);
      const argv = argvFor(request, host);
      let result: GithubChildRunnerResult;
      try {
        result = await runner("gh", argv, {
          timeout: timeoutMs,
          killSignal: "SIGKILL",
          env: environmentFor({
            environment: options.environment,
            ...(token === undefined ? {} : { token }),
          }),
          maxBuffer: maxResponseBytes,
          ...(request.body === undefined ? {} : { input: request.body }),
        });
      } catch {
        // A rejected spawn is a classified transport failure with no status.
        throw new Error("GitHub CLI invocation failed");
      }
      if (result.timedOut) throw new Error("GitHub CLI invocation timed out");
      if (result.status !== 0) {
        // Stderr prose never becomes a failure detail; the exit code is enough.
        throw new Error(`GitHub CLI exited with status ${result.status}`);
      }
      return parseIncludedResponse(result.stdout, maxResponseBytes);
    },
  };
};

/** Run one bounded probe; the caller decides the policy and fallback. */
export const probeGithubCli = async (input: {
  readonly runner?: GithubChildRunner;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly timeoutMs?: number;
}): Promise<GithubCliProbeResult> => {
  const runner = input.runner ?? execFileRunner;
  let result: GithubChildRunnerResult;
  try {
    result = await runner("gh", [...PROBE_ARGV], {
      timeout: input.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS,
      killSignal: "SIGKILL",
      env: environmentFor({ environment: input.environment }),
      maxBuffer: GITHUB_CLI_MAX_OUTPUT_BYTES,
    });
  } catch {
    return { ok: false, code: "provider.cli.unavailable" };
  }
  if (result.timedOut || result.status !== 0) {
    return { ok: false, code: "provider.cli.unavailable" };
  }
  const version = parseVersion(result.stdout);
  if (version === undefined) {
    // The binary answered, but not with a version this transport can use: the
    // required capability cannot be established.
    return { ok: false, code: "provider.cli.capability-unsupported" };
  }
  if (
    compareVersions(version, DECLARED_MINIMUM) < 0 ||
    compareVersions(version, DECLARED_MAXIMUM) > 0
  ) {
    return { ok: false, code: "provider.cli.version-unsupported" };
  }
  return { ok: true, version: version.join(".") };
};

/**
 * The PURE, synchronous adapter selection resolver (DM-10).
 *
 * The launcher edge calls the async composition resolver in `packages/cli`;
 * this function takes the probe result as data so it stays synchronous.
 */
export const resolveTransportSelection = (input: {
  readonly policy: GithubTransportPolicy;
  readonly probe?: GithubCliProbeResult;
}): GithubTransportSelection => {
  if (input.policy === "api-only") return { policy: "api-only", selected: "api" };
  const probe = input.probe;
  if (probe !== undefined && probe.ok) return { policy: "prefer-cli", selected: "gh" };
  const code: GithubCliRefusalCode =
    probe !== undefined && !probe.ok ? probe.code : "provider.cli.unavailable";
  return { policy: "prefer-cli", selected: "api", degradation: { code } };
};
