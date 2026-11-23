/**
 * The seam manifest and the reimplementation detector (GH-347 AC-F9-2, §7.1).
 *
 * Three independent mechanisms, all asserted by TC-PARITY-002:
 *  1. import identity — each seam symbol is exported by the ONE production
 *     module that owns it, and the production composition mounts it;
 *  2. a forbidden-signature scan over the dispatch battery's test surface for a
 *     locally re-expressed seam (the old pre-read + claim pair, a local timer
 *     retry, a local kill sequence, a local token ladder);
 *  3. a planted control that must be rejected BY NAME.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type SeamManifestEntry = {
  readonly seam: string;
  readonly symbol: string;
  /** The production module, repository-relative without the extension. */
  readonly module: string;
  /** The production file that mounts the seam at its composition edge. */
  readonly mountedIn: string;
};

export const SEAM_MANIFEST: readonly SeamManifestEntry[] = [
  {
    seam: "claim",
    symbol: "claimDispatchLease",
    module: "packages/core/src/app/queue",
    mountedIn: "packages/cli/src/production.ts",
  },
  {
    seam: "lane",
    symbol: "resolveDispatchLane",
    module: "packages/core/src/app/dispatch-lane",
    mountedIn: "packages/cli/src/production.ts",
  },
  {
    seam: "ladder",
    symbol: "runDispatchTrackerLadder",
    module: "packages/core/src/domain/dispatch-tracker",
    mountedIn: "packages/cli/src/production.ts",
  },
  {
    seam: "spawn",
    symbol: "spawnTitleFor",
    module: "packages/core/src/domain/dispatch-identity",
    mountedIn: "packages/cli/src/production.ts",
  },
  {
    // GH-347 AC-F9-2 / review M5: the terminate seam is the opencode adapter the
    // production composition mounts, so its "real production seam" membership is
    // proven by import identity and not only asserted in prose.
    seam: "terminate",
    symbol: "createOpencodeSession",
    module: "packages/adapters/src/harness/opencode",
    mountedIn: "packages/cli/src/production.ts",
  },
  {
    // GH-386: the push seam is the typed stack's first remote-write act; its
    // membership is proven by import identity over the one adapters module.
    seam: "push",
    symbol: "createGitPushSeam",
    module: "packages/adapters/src/git/push",
    mountedIn: "packages/cli/src/production.ts",
  },
  {
    seam: "derive",
    symbol: "deriveDispatchResult",
    module: "packages/core/src/domain/dispatch-result",
    mountedIn: "packages/core/src/app/dispatch.ts",
  },
  {
    seam: "loop",
    symbol: "runDispatch",
    module: "packages/core/src/app/dispatch",
    mountedIn: "packages/cli/src/edge.ts",
  },
  {
    // GH-354 S-laneview: the repository-filtered newest-per-ref fold.
    seam: "lane-view",
    symbol: "readOperatorStatus",
    module: "packages/core/src/app/dispatch-lane-view",
    mountedIn: "packages/cli/src/edge.ts",
  },
  {
    // GH-354 S-fold: the delivering fold over the same lane view.
    seam: "delivering-fold",
    symbol: "readOperatorDelivering",
    module: "packages/core/src/app/dispatch-lane-view",
    mountedIn: "packages/cli/src/edge.ts",
  },
  {
    // GH-354 S-tail: the addressed-directory stitched tail reader.
    seam: "artifact-tail",
    symbol: "readDispatchLog",
    module: "packages/core/src/app/dispatch-log-tail",
    mountedIn: "packages/cli/src/edge.ts",
  },
  {
    // GH-354 S-transcript: the adapter-owned read-only transcript reader.
    seam: "transcript-read",
    symbol: "createOpencodeTranscriptReader",
    module: "packages/adapters/src/harness/opencode-transcript",
    mountedIn: "packages/cli/src/production.ts",
  },
  {
    // GH-354 S-sink: the per-stream stdout artifact sink.
    seam: "log-sink",
    symbol: "createDispatchLogSink",
    module: "packages/core/src/app/dispatch-log-sink",
    mountedIn: "packages/cli/src/production.ts",
  },
];

/** The dispatch battery's test surface (the scan's declared scope). */
export const REIMPLEMENTATION_SCAN_ROOTS = [
  "tests/fixtures/dispatch/parity",
  "tests/conformance/dispatch",
  "tests/behaviour/dispatch",
] as const;

/** The import-identity check: each seam is exported by its module and mounted. */
export const importIdentityViolations = async (root: string): Promise<string[]> => {
  const failures: string[] = [];
  for (const entry of SEAM_MANIFEST) {
    try {
      const module = (await import(join(root, `${entry.module}.ts`))) as Record<string, unknown>;
      if (typeof module[entry.symbol] !== "function") {
        failures.push(`${entry.module}: ${entry.symbol} is not exported as the seam`);
      }
    } catch {
      failures.push(`${entry.module}: the seam module could not be imported`);
    }
    const mount = readFileSync(join(root, entry.mountedIn), "utf8");
    if (!mount.includes(entry.symbol)) {
      failures.push(`${entry.mountedIn}: ${entry.symbol} is not mounted`);
    }
  }
  return failures;
};

/** The forbidden signatures: a seam's decision logic re-expressed in tests. */
export const REIMPLEMENTATION_SIGNATURES: readonly {
  readonly seam: string;
  readonly test: (source: string) => boolean;
}[] = [
  {
    seam: "claim",
    // The old non-atomic admission: BOTH the pre-read and the claim primitive
    // are CALLED in one file (a quoted inventory entry is not a call).
    test: (source) =>
      source.includes("dispatchAdmissionRefusal(") && source.includes("claimQueueLease("),
  },
  {
    seam: "ladder",
    test: (source) => /setTimeout\([^)]*\)[\s\S]{0,160}retry/iu.test(source),
  },
  {
    seam: "terminate",
    test: (source) => /process\.kill\(|child\.kill\("SIG/iu.test(source),
  },
  {
    seam: "loop",
    test: (source) => /const TOKEN_LADDER|function deriveToken\(/iu.test(source),
  },
  {
    // GH-354: a test-local stitch/split/tail loop, a local 1 048 576 cap, or a
    // local 512-character message bound re-expresses a read decision.
    seam: "artifact-tail",
    test: (source) =>
      /1_048_576|1048576/u.test(source) &&
      !source.includes("DISPATCH_LOG_FILE_CAP_BYTES") &&
      !source.includes("capBytes"),
  },
  {
    seam: "transcript-read",
    test: (source) => /slice\(0,\s*512\)|substring\(0,\s*512\)/u.test(source),
  },
];

const listFiles = (path: string): string[] => {
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(path);
  } catch {
    return [];
  }
  if (!stat.isDirectory()) return path.endsWith(".ts") ? [path] : [];
  const results: string[] = [];
  for (const entry of readdirSync(path)) {
    results.push(...listFiles(join(path, entry)));
  }
  return results;
};

/**
 * Scan the declared dispatch-battery roots for the forbidden signatures. Each
 * hit names the seam and the file; the manifest module itself is excluded.
 */
export const reimplementationViolations = (root: string): string[] => {
  const failures: string[] = [];
  const self = join(root, "tests/fixtures/dispatch/parity/seams.ts");
  for (const relative of REIMPLEMENTATION_SCAN_ROOTS) {
    let files: string[];
    const path = join(root, relative);
    try {
      files = listFiles(path);
    } catch {
      // A declared PREFIX (e.g. `tests/behaviour/dispatch`) scans its parent for
      // the matching file-name prefix.
      const directory = relative.slice(0, relative.lastIndexOf("/"));
      const prefix = relative.slice(relative.lastIndexOf("/") + 1);
      files = listFiles(join(root, directory)).filter((file) =>
        (file.split("/").pop() ?? "").startsWith(prefix),
      );
    }
    for (const path of files) {
      if (path === self) continue;
      const source = readFileSync(path, "utf8");
      for (const signature of REIMPLEMENTATION_SIGNATURES) {
        if (signature.test(source)) {
          failures.push(`reimplementation of ${signature.seam} in ${path}`);
        }
      }
    }
  }
  return failures;
};
