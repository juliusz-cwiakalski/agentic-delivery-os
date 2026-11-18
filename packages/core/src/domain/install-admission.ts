/**
 * The install-target admission predicate (F-5, F-6; Appendix C.1).
 *
 * One pure predicate governs every executed path: a linked worktree is refused
 * with one typed identity, an unreadable git state is admitted as `unverified`,
 * a stable checkout is admitted as `verified`, and a run that carries no
 * injected identity is the development run the dev gate refuses. The dirty flag
 * of the target's checkout is never an admission question, and detection is
 * repository metadata rather than a path comparison.
 */
import type {
  InstallArtifactIdentity,
  InstallGitRead,
  InstallProvenance,
  InstallTargetStability,
} from "../contracts/install.js";

/** The admission decision, as data the handler maps to an outcome. */
export type InstallAdmission =
  | {
      readonly ok: true;
      readonly provenance: InstallProvenance;
      readonly checkoutPath?: string;
    }
  | { readonly ok: false; readonly code: "install.dev-build" }
  | {
      readonly ok: false;
      readonly code: "install.target.worktree";
      readonly target: string;
      readonly gitDir: string;
      readonly commonDir: string;
    };

/**
 * Evaluate one admission decision over the delivered worktree-topology read.
 *
 * The artifact's own directory is the target the read runs over, so an artifact
 * anywhere inside a checkout is detected through the repository's own
 * resolution. `S-4` cannot fail: the destination is never an input.
 */
export const evaluateInstallAdmission = (input: {
  readonly artifactDirectory: string;
  readonly identity?: InstallArtifactIdentity;
  readonly git: InstallGitRead;
}): InstallAdmission => {
  if (input.identity === undefined) return { ok: false, code: "install.dev-build" };
  if (input.git.kind === "resolved") {
    if (input.git.gitDir !== input.git.commonDir) {
      return {
        ok: false,
        code: "install.target.worktree",
        target: input.artifactDirectory,
        gitDir: input.git.gitDir,
        commonDir: input.git.commonDir,
      };
    }
    return { ok: true, provenance: "verified", checkoutPath: input.git.checkoutRoot };
  }
  // An unreadable git state is admitted and recorded unverified; the rule is
  // about where the target lives, never about what the tree contains.
  return { ok: true, provenance: "unverified" };
};

/** The target-stability finding the status payload reports as data (DM-4). */
export const installTargetStability = (git: InstallGitRead): InstallTargetStability => {
  if (git.kind !== "resolved") return "unverified";
  return git.gitDir === git.commonDir ? "verified" : "linked-worktree";
};
