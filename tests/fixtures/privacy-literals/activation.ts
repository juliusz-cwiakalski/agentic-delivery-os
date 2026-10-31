/**
 * Synthetic hashed-entry activation fixtures. Every digest is computed at test
 * time from a fabricated literal through the production normalization helpers;
 * no digest for a real value is committed.
 */
import { createHash } from "node:crypto";
import {
  normalizeLiteral,
  privacyDigestInput,
} from "../../../packages/adapters/src/io/privacy-rules";

export type FixtureClassId = "private-literal" | "cloud-term";

export type FixtureEntry = {
  readonly id: string;
  readonly class: FixtureClassId;
  readonly algorithm: "sha256";
  readonly hash: string;
  readonly length: number;
  readonly reason: string;
};

export const PRIVATE_LITERAL = "privateliteralzq7x9m2p4r6t8v0";
export const CLOUD_TERM = "zq7xhostedterm9m2p4r6t8v0";
export const AUTHORING_LITERAL = "authoringcanaryzq7x9m2p4r6t8v0";

export const hashLiteral = (literal: string): string =>
  createHash("sha256").update(privacyDigestInput(literal), "utf8").digest("hex");

export const entryFor = (literal: string, id: string, className: FixtureClassId): FixtureEntry => ({
  id,
  class: className,
  algorithm: "sha256",
  hash: hashLiteral(literal),
  length: normalizeLiteral(literal).length,
  reason: `Synthetic ${className} activation fixture computed at test time.`,
});

export const PRIVATE_LITERAL_ENTRY = entryFor(
  PRIVATE_LITERAL,
  "fixture-private-literal",
  "private-literal",
);

export const CLOUD_TERM_ENTRY = entryFor(CLOUD_TERM, "fixture-cloud-term", "cloud-term");
