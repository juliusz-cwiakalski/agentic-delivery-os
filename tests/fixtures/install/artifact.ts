/**
 * The fixture artifact tier (GH-346 D7, SEAM-TP-1).
 *
 * Steps 2 and 3 stage and verify the RUNNING artifact's bytes, so an in-process
 * case supplies this fixture's path through the same injected-facts object that
 * carries the identity. No in-process case stages or compares the ~107 MB Bun
 * binary: the fixture is a small executable whose first bytes are a compiled
 * binary's, not a script's.
 */
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";

const ROOT = process.cwd();

const MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);

export type FixtureArtifact = {
  readonly path: string;
  readonly digest: string;
  readonly size: number;
};

/** Build one fixture artifact whose bytes are distinct per `label`. */
export const createFixtureArtifact = (
  label: string,
  options: { readonly executable?: boolean } = {},
): FixtureArtifact => {
  const directory = mkdtempSync(join(ROOT, "tmp/tmpdir/gh346-artifact-"));
  const path = join(directory, `artifact-${label}`);
  const payload = Buffer.concat([
    MAGIC,
    Buffer.from(`gh346 fixture artifact ${label}\n`),
    Buffer.alloc(256, label.charCodeAt(0) % 251),
  ]);
  writeFileSync(path, payload);
  chmodSync(path, options.executable === false ? 0o644 : 0o755);
  return {
    path,
    digest: createHash("sha256").update(readFileSync(path)).digest("hex"),
    size: payload.length,
  };
};

/** Write a delivered bash launcher at `path` and answer its recorded target. */
export const writeFixtureLauncher = (path: string, target: string): string => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(
    path,
    `#!/usr/bin/env bash\n# fixture launcher\nreadonly TARGET=${target}\nexec bun "$TARGET" "$@"\n`,
    { mode: 0o755 },
  );
  return target;
};

/** Remove one fixture artifact directory. */
export const removeFixtureArtifact = (artifact: FixtureArtifact): void => {
  rmSync(join(artifact.path, ".."), { recursive: true, force: true });
};
