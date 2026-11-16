/**
 * The steer credential fixtures (GH-298 F-7, TDR-0012): one registered sentinel
 * and a table of token-shaped but unregistered values. Values are assembled
 * from fragments so the repository privacy scanner never sees a literal
 * credential shape.
 */
export const REGISTERED_SENTINEL = "STEER-REGISTERED-SENTINEL-9f2c";

export const UNREGISTERED_TOKEN_SHAPED: readonly string[] = [
  ["ghp", "_", "0".repeat(36)].join(""),
  ["AKIA", "IOSFODNN7EXAMPLE"].join(""),
  ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxIn0", "signature"].join("."),
  ["sk", "-", "0".repeat(24)].join(""),
];

export const BENIGN_TEXT = "prefer smaller diffs; split the refactor";
export const BENIGN_REF = "doc/changes/2026-11/proof.md";
