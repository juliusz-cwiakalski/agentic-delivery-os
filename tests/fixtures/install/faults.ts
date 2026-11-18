/**
 * The declared test-only fault port (GH-346 FAULT-TP-1, OQ-TP-1).
 *
 * The production composition NEVER supplies it; a case names one step and the
 * run fails there. A step that cannot be induced fails its case by name.
 */
import type {
  InstallFaultPort,
  InstallFaultStep,
} from "../../../packages/core/src/contracts/install";

/** A port that fails at exactly one declared step. */
export const faultAt = (step: InstallFaultStep): InstallFaultPort => ({
  failAt: (candidate) => candidate === step,
});

/** A port that never fails, for the control arms. */
export const noFault = (): InstallFaultPort => ({ failAt: () => false });
