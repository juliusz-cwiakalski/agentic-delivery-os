/**
 * The GH-290 reference-surface harness (TC-EVT-010..016, TC-EVT-051, TC-EVT-080).
 *
 * Composes the delivered `runCli` over only the `events` definition: no store,
 * no configuration, no transport, no git, and no filesystem read is available
 * to the surface, which is the property the purity cases assert. The brand, the
 * clock, and the run-id factory are the only injected facts.
 */

import {
  createEventsCommandDefinition,
  type EventsData,
} from "../../../packages/cli/src/commands/events";
import { type CliMode, type CliStreams, runCli } from "../../../packages/cli/src/index";
import type { TaxonomyDeclaration } from "../../../packages/core/src/contracts/taxonomy";
import { SYNTHETIC_BRAND } from "../../golden/helpers";

export type SurfaceRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
  readonly data?: EventsData;
};

export type SurfaceHarness = {
  readonly run: (argv: readonly string[]) => Promise<SurfaceRun>;
  /** The definition the harness composes, for direct-handler cases. */
  readonly definition: ReturnType<typeof createEventsCommandDefinition>;
};

export const createSurfaceHarness = (
  options: { readonly taxonomy?: TaxonomyDeclaration; readonly mode?: CliMode } = {},
): SurfaceHarness => {
  const definition = createEventsCommandDefinition(
    options.taxonomy === undefined ? {} : { taxonomy: options.taxonomy },
  );
  let ordinal = 0;
  const run = async (argv: readonly string[]): Promise<SurfaceRun> => {
    const out: string[] = [];
    const err: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    };
    ordinal += 1;
    const exitCode = await runCli(argv, streams, {
      brand: SYNTHETIC_BRAND,
      clock: { now: () => Date.parse("2026-11-12T00:00:00.000Z") },
      newRunId: () => `run-gh290-${ordinal}`,
      secrets: [],
      program: { commands: { events: definition } },
      ...(options.mode === undefined ? {} : { mode: options.mode }),
    });
    const stdout = out.join("");
    const stderr = err.join("");
    const trimmed = stdout.trim();
    let envelope: Record<string, unknown> | undefined;
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      envelope = JSON.parse(trimmed) as Record<string, unknown>;
    }
    const data = envelope === undefined ? undefined : (envelope.data as EventsData | undefined);
    return {
      exitCode,
      stdout,
      stderr,
      ...(envelope === undefined ? {} : { envelope }),
      ...(data === undefined ? {} : { data }),
    };
  };
  return { run, definition };
};
