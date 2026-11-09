/**
 * The shared supervisor-regime descriptor projection (GH-241 F-8, DM-8, DEC-1,
 * DEC-6; AC-F8-2).
 *
 * The descriptor declares state-dir scope, the single-instance lease, a unit
 * identity derived from the state directory and the coordinator identity, a
 * distinct process kind, a distinct budget store, `supervisorMode` `foreground`
 * (the only v1 value), `externalUnit` `absent`, and the delivered M1-S18
 * install seam. It creates no unit and ships no installer.
 */
import {
  COORDINATOR_REGIME,
  COORDINATOR_V1_SUPERVISOR_MODE,
  type CoordinatorRegime,
} from "#contracts";

/** The deterministic unit identity derived from the state dir and coordinator. */
export const coordinatorUnitIdentity = (
  stateDirectory: string,
  coordinatorId: string,
): string => `${COORDINATOR_REGIME.processKind}@${stateDirectory}#${coordinatorId}`;

/** Project the regime descriptor for one state-dir scope. */
export const projectCoordinatorRegime = (input: {
  readonly stateDirectory: string;
  readonly coordinatorId: string;
}): CoordinatorRegime => ({
  scope: COORDINATOR_REGIME.scope,
  stateDirectory: input.stateDirectory,
  unitIdentity: coordinatorUnitIdentity(input.stateDirectory, input.coordinatorId),
  processKind: COORDINATOR_REGIME.processKind,
  budgetStore: COORDINATOR_REGIME.budgetStore,
  supervisorMode: COORDINATOR_V1_SUPERVISOR_MODE,
  externalUnit: COORDINATOR_REGIME.externalUnit,
  daemonInstallSeam: COORDINATOR_REGIME.daemonInstallSeam,
});
