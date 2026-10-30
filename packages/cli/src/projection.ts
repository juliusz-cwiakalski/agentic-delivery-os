/**
 * Exit-code projection (F-4, Appendix C).
 *
 * This is the only module in the repository permitted to contain exit-code
 * digit literals; the numeric value is derived from a projection class, never
 * read from a table entry.
 */
import type { ProjectionClass } from "@delivery-os/core/contracts";

const PROJECTION: Readonly<Record<ProjectionClass, number>> = {
  success: 0,
  "user-validation": 1,
  "platform-provider": 2,
};

/** Project a class to its fixed code; unknown input is rejected, never defaulted. */
export function projectExitCode(projectionClass: ProjectionClass): number {
  if (!Object.hasOwn(PROJECTION, projectionClass)) {
    throw new Error(`unknown projection class: ${String(projectionClass)}`);
  }
  return PROJECTION[projectionClass];
}
