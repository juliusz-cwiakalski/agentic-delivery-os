/** Mutant D: append and spawn without the shared admission gate. */
export const MUTANT_ID = "d-gate-bypass";
export const EXPECTED_FAILURE = "gate-bypass";
export type BypassDeps = {
  readonly appendRestartEvent: (ordinal: number) => void;
  readonly spawn: () => void;
};
export const attempt = (deps: BypassDeps): void => {
  deps.appendRestartEvent(1);
  deps.spawn();
};
