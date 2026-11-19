/**
 * The planted shell artifacts and their fingerprints (GH-354 §6.1, §6.2).
 *
 * Five files the shell lane owns, with contents engineered to LOOK like typed
 * answers, planted inside a temporary checkout only. The fingerprint (bytes,
 * mode, mtimeMs) makes "never read, never written, never repaired" a
 * measurement, and the canaries make content provenance observable.
 */
import { mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const SHELL_PM_OUT_CANARY = "SHELL-PM-OUT-CANARY";
export const SHELL_LOG_CANARY = "SHELL-LOG-CANARY";
export const SHELL_LAST_MESSAGE_CANARY = "SHELL-DECOY-MESSAGE";
export const SHELL_DECOY_LINE = "SHELL-DECOY-LINE";

export type PlantedFile = {
  /** The repository-relative path under the temp checkout. */
  readonly path: string;
  readonly text: string;
};

export type DecoyFingerprint = {
  readonly path: string;
  readonly bytes: number;
  readonly mode: number;
  readonly mtimeMs: number;
};

/** The five planted artifacts, with the declared canaries. */
export const decoyFiles = (ref: string): readonly PlantedFile[] => [
  { path: ".ai/local/delivery/delivering", text: `${ref}\n` },
  { path: `.ai/local/delivery/${ref}.pid`, text: "4242\n" },
  { path: `tmp/deliver-ticket/${ref}.pm.out`, text: `${SHELL_PM_OUT_CANARY}\n` },
  {
    path: `tmp/deliver-ticket/${ref}.log`,
    text: `${Array.from({ length: 50 }, (_, index) => `${SHELL_DECOY_LINE}-${index}`).join("\n")}\n`,
  },
  { path: `.ai/local/delivery/${ref}.last-message`, text: `${SHELL_LAST_MESSAGE_CANARY}\n` },
];

/** Plant the five artifacts inside a checkout; returns their absolute paths. */
export const plantShellArtifacts = (checkout: string, ref: string): readonly DecoyFingerprint[] => {
  const planted: DecoyFingerprint[] = [];
  for (const file of decoyFiles(ref)) {
    const path = join(checkout, file.path);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, file.text, { mode: 0o600 });
    planted.push(fingerprint(checkout, file.path));
  }
  return planted;
};

/** One file's bytes, mode, and mtime. */
export const fingerprint = (checkout: string, path: string): DecoyFingerprint => {
  const absolute = join(checkout, path);
  const stat = statSync(absolute);
  return {
    path,
    bytes: readFileSync(absolute).byteLength,
    mode: stat.mode & 0o777,
    mtimeMs: stat.mtimeMs,
  };
};

/** Re-fingerprint the declared paths and compare with the pre-run snapshot. */
export const fingerprintDrift = (
  checkout: string,
  before: readonly DecoyFingerprint[],
): readonly string[] => {
  const drift: string[] = [];
  for (const entry of before) {
    let after: DecoyFingerprint;
    try {
      after = fingerprint(checkout, entry.path);
    } catch {
      drift.push(`${entry.path}: removed`);
      continue;
    }
    if (after.bytes !== entry.bytes) drift.push(`${entry.path}: bytes changed`);
    if (after.mode !== entry.mode) drift.push(`${entry.path}: mode changed`);
    if (after.mtimeMs !== entry.mtimeMs) drift.push(`${entry.path}: mtime changed`);
  }
  return drift;
};

/** Set a deliberately old mtime (the name-order proof for the family reader). */
export const backdate = (path: string, secondsAgo: number): void => {
  const when = new Date(Date.now() - secondsAgo * 1000);
  utimesSync(path, when, when);
};

/** Remove the planted artifacts (fixture disposal). */
export const removeShellArtifacts = (checkout: string, ref: string): void => {
  for (const file of decoyFiles(ref)) {
    rmSync(join(checkout, file.path), { force: true });
  }
};
