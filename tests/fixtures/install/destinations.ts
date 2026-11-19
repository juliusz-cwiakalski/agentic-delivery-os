/**
 * Destination-state fixtures (GH-346 Appendix C.2).
 *
 * The four declared states — a compiled artifact whose content differs, a
 * delivered bash launcher, a symlink to another artifact, and nothing — plus the
 * agreement case (the destination holds the running artifact's bytes).
 */

import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

export type DestinationState = "absent" | "agreeing" | "differing" | "launcher" | "symlink";

/** Materialise one destination state at `path` and answer the digest written. */
export const placeDestination = (input: {
  readonly state: DestinationState;
  readonly destination: string;
  readonly runningArtifactPath: string;
  readonly otherArtifactPath: string;
  readonly launcherTarget?: string;
}): string | undefined => {
  mkdirSync(dirname(input.destination), { recursive: true });
  rmSync(input.destination, { force: true, recursive: true });
  switch (input.state) {
    case "absent":
      return undefined;
    case "agreeing": {
      copyFileSync(input.runningArtifactPath, input.destination);
      chmodSync(input.destination, 0o755);
      return createHash("sha256").update(readFileSync(input.destination)).digest("hex");
    }
    case "differing": {
      copyFileSync(input.otherArtifactPath, input.destination);
      chmodSync(input.destination, 0o755);
      return createHash("sha256").update(readFileSync(input.destination)).digest("hex");
    }
    case "launcher": {
      writeFileSync(
        input.destination,
        `#!/usr/bin/env bash\nreadonly TARGET=${input.launcherTarget ?? "/checkout/packages/cli/bin/jaiship.ts"}\nexec bun "$TARGET" "$@"\n`,
        { mode: 0o755 },
      );
      return createHash("sha256").update(readFileSync(input.destination)).digest("hex");
    }
    default: {
      symlinkSync(input.otherArtifactPath, input.destination);
      return undefined;
    }
  }
};
