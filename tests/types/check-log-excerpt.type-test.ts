/**
 * TC-CHECK-012 / TC-CHECK-003 type probes (DM-4, AC-F4-2, NFR-6).
 *
 * The excerpt shape is closed and the cap is one exported constant: no per-read
 * byte cap is representable, and no fifth field (duration, page, archive) can be
 * added to the result without failing this probe.
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it;
 * `tests/types/tsconfig.json` compiles it through the root `typecheck` script.
 */
import {
  GITHUB_LOG_EXCERPT_MAX_BYTES,
  type GithubLogExcerpt,
  type GithubLogExcerptOptions,
  type GithubLogExcerptReader,
} from "../../packages/adapters/src/github/log-excerpt";

declare const reader: GithubLogExcerptReader;

export const cap: number = GITHUB_LOG_EXCERPT_MAX_BYTES;

export const read = (): ReturnType<GithubLogExcerptReader["readLogExcerpt"]> =>
  reader.readLogExcerpt("9002");

// @ts-expect-error the read takes only a job identity; no cap is caller-tunable
export const withCap = (): unknown => reader.readLogExcerpt("9002", { maxBytes: 1024 });

type HasMaxBytes = "maxBytes" extends keyof GithubLogExcerptOptions ? true : false;
export const hasMaxBytes: HasMaxBytes = false;

export const keys: (keyof GithubLogExcerpt)[] = ["jobId", "excerpt", "truncated", "byteLength"];

export const example: GithubLogExcerpt = {
  jobId: "9002",
  excerpt: "prefix",
  truncated: false,
  byteLength: 6,
};

// @ts-expect-error no derived duration is part of the excerpt shape
export const withDuration: GithubLogExcerpt = { ...example, durationMs: 1000 };

// @ts-expect-error no archive or page identity is representable
export const withArchive: GithubLogExcerpt = { ...example, archiveUrl: "https://example.test/a" };
