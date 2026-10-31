/**
 * Shared helpers for the golden suites: synthetic brand, program descriptors,
 * injected clock/id, and buffer streams. No process spawning, no real streams.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type CliDependencies,
  type CliStreams,
  type CommandDefinition,
  type CommandHandler,
  type CommandProgram,
  runCli,
} from "../../packages/cli/src/index";
import type { BrandIdentity } from "../../packages/core/src/contracts/index";
import type { GoldenCase } from "../../packages/testkit/src/result-conformance";

export const ROOT = process.cwd();
export const GOLDEN_ROOT = join(ROOT, "tests/fixtures/result/envelopes");
export const PROGRAMS_ROOT = join(ROOT, "tests/fixtures/result/programs");

export const SYNTHETIC_BRAND: BrandIdentity = {
  productName: "example-product",
  binaryName: "example-product",
  packageScope: "@example-scope",
  environmentPrefix: "EXAMPLE_PRODUCT_",
  configDirectoryName: ".example-product",
  stateDirectoryName: ".example-product-state",
  mcpToolPrefix: "example-product_",
  telemetryNamespace: "delivery",
  docsBaseUrl: "https://example-scope.github.io/example-product/",
  repositoryUrl: "https://github.com/example-scope/example-product",
  releaseAssetPrefix: "example-product-",
  installPath: "~/.example-product/bin/example-product",
};

export type ProgramDescriptor = {
  readonly id: string;
  readonly command: string;
  readonly kind:
    | "data"
    | "classified"
    | "unknown-kind"
    | "throw-error"
    | "throw-non-error"
    | "reject"
    | "partial"
    | "malformed"
    | "secret-data"
    | "secret-failure";
  readonly data?: unknown;
  readonly message?: string;
  readonly failureKind?: string;
  readonly failureCode?: string;
  readonly summary?: string;
  readonly flags?: readonly string[];
  readonly requiresValue?: readonly string[];
  readonly conflicts?: readonly (readonly [string, string])[];
};

export const loadProgram = (id: string): ProgramDescriptor =>
  JSON.parse(readFileSync(join(PROGRAMS_ROOT, `${id}.json`), "utf8")) as ProgramDescriptor;

const handlerFor = (descriptor: ProgramDescriptor): CommandHandler => {
  switch (descriptor.kind) {
    case "data":
      return () => ({ data: descriptor.data === undefined ? {} : descriptor.data });
    case "classified":
      return () => {
        throw {
          kind: descriptor.failureKind,
          ...(descriptor.failureCode === undefined ? {} : { code: descriptor.failureCode }),
          ...(descriptor.summary === undefined ? {} : { summary: descriptor.summary }),
        };
      };
    case "unknown-kind":
      return () => {
        throw { kind: "mystery" };
      };
    case "throw-error":
      return () => {
        throw new Error(descriptor.message ?? "synthetic failure");
      };
    case "throw-non-error":
      return () => {
        throw "synthetic non-error thrown value";
      };
    case "reject":
      return () => Promise.reject(new Error(descriptor.message ?? "synthetic rejection"));
    case "partial":
      return () => {
        const payload = { partiallyAssembled: true };
        throw new Error(`failed after partial assembly ${JSON.stringify(payload)}`);
      };
    case "malformed":
      return () => ({ malformed: true });
    case "secret-data":
      return () => ({ data: descriptor.data === undefined ? {} : descriptor.data });
    case "secret-failure":
      return () => {
        throw { kind: "input", summary: descriptor.summary ?? "planted-fake-secret-0002" };
      };
    default:
      throw new Error(`unknown program kind: ${String(descriptor.kind)}`);
  }
};

export const programFor = (descriptor: ProgramDescriptor): CommandProgram => {
  const definition: CommandDefinition = {
    handler: handlerFor(descriptor),
    ...(descriptor.flags === undefined ? {} : { flags: descriptor.flags }),
    ...(descriptor.requiresValue === undefined ? {} : { requiresValue: descriptor.requiresValue }),
    ...(descriptor.conflicts === undefined ? {} : { conflicts: descriptor.conflicts }),
  };
  return { commands: { [descriptor.command]: definition } };
};

export type BufferSink = { write(chunk: string): void; readonly value: string };

export const bufferSink = (): BufferSink => {
  let text = "";
  return {
    write(chunk: string): void {
      text += chunk;
    },
    get value(): string {
      return text;
    },
  };
};

export type CaseRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export const runCase = async (
  testCase: GoldenCase,
  overrides: { readonly ticks?: readonly [number, number] } = {},
): Promise<CaseRun> => {
  const descriptor = loadProgram(testCase.injected.program);
  const program = programFor(descriptor);
  const stdout = bufferSink();
  const stderr = bufferSink();
  const streams: CliStreams = { stdout, stderr };
  const ticks = overrides.ticks ?? testCase.injected.ticks;
  let tickIndex = 0;
  const clock = {
    now: (): number => {
      const value = ticks[Math.min(tickIndex, 1)] as number;
      tickIndex += 1;
      return value;
    },
  };
  const deps: CliDependencies = {
    brand: testCase.injected.brand,
    clock,
    newRunId: () => testCase.injected.runId,
    secrets: testCase.injected.secrets ?? [],
    program,
  };
  const exitCode = await runCli(testCase.argv, streams, deps);
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

export const isSingleJsonDocument = (text: string): boolean => {
  if (!text.endsWith("\n")) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
};

export const hasStackLeak = (text: string): boolean =>
  [" at ", ".ts:", ".js:", "Error:", "TypeError:"].some((marker) => text.includes(marker));

export type DescriptorRun = CaseRun;

export const runDescriptor = async (
  descriptorId: string,
  argv: readonly string[],
  ticks: readonly [number, number],
  runId: string,
  secrets: readonly string[] = [],
): Promise<DescriptorRun> => {
  const descriptor = loadProgram(descriptorId);
  const program = programFor(descriptor);
  const stdout = bufferSink();
  const stderr = bufferSink();
  let tickIndex = 0;
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: {
      now: (): number => {
        const value = ticks[Math.min(tickIndex, 1)] as number;
        tickIndex += 1;
        return value;
      },
    },
    newRunId: () => runId,
    secrets,
    program,
  };
  const exitCode = await runCli(argv, { stdout, stderr }, deps);
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};
