/**
 * The bounded simulation-fixture read (GH-350 F-5, DM-5; TDR-0058 D5).
 *
 * One read of one regular file, measured against the declared byte cap before
 * any parse. A missing, unreadable, or oversize document is a classified
 * `input.value.rejected` that names the field and never echoes the document's
 * content. This module is the only reader of a simulation fixture; the boundary
 * rule `provider-fixture-read-only-simulate` keeps it out of every other
 * composition.
 */
import { PROVIDER_SIMULATE_FIXTURE_MAX_BYTES } from "@delivery-os/core/contracts";
import type { FileSystemFacts } from "./config-source.js";

export type ProviderSimulateFixtureRead =
  | {
      readonly ok: true;
      readonly document: { readonly text: string; readonly byteLength: number };
    }
  | {
      readonly ok: false;
      readonly code: "input.value.rejected";
      readonly field: "fixture" | "size";
      readonly summary: string;
    };

const MAX_PATH_IN_SUMMARY = 200;

const pathLabel = (path: string): string =>
  path.length <= MAX_PATH_IN_SUMMARY ? path : `${path.slice(0, MAX_PATH_IN_SUMMARY)}…`;

const refuse = (field: "fixture" | "size", summary: string): ProviderSimulateFixtureRead => ({
  ok: false,
  code: "input.value.rejected",
  field,
  summary,
});

/**
 * Read the fixture once. The cap is measured in UTF-8 bytes, as declared, and is
 * checked before the text is handed to the pure parser.
 */
export const readProviderSimulateFixture = (input: {
  readonly path: string;
  readonly fs: FileSystemFacts;
  readonly maxBytes?: number;
}): ProviderSimulateFixtureRead => {
  const maxBytes = input.maxBytes ?? PROVIDER_SIMULATE_FIXTURE_MAX_BYTES;
  const label = pathLabel(input.path);
  if (!input.fs.exists(input.path)) {
    return refuse("fixture", `simulate fixture ${label} does not exist`);
  }
  // Size first: an oversized path is refused from its stat entry and its text is
  // never allocated. The post-read check below stays as defence in depth for
  // injected facts that cannot supply a size.
  const declaredSize = input.fs.size?.(input.path);
  if (declaredSize !== undefined && declaredSize > maxBytes) {
    return refuse(
      "size",
      `simulate fixture ${label} is ${declaredSize} bytes; the declared maximum is ${maxBytes}`,
    );
  }
  let text: string;
  try {
    text = input.fs.readText(input.path);
  } catch {
    return refuse("fixture", `simulate fixture ${label} is unreadable`);
  }
  const byteLength = Buffer.byteLength(text, "utf8");
  if (byteLength > maxBytes) {
    return refuse(
      "size",
      `simulate fixture ${label} is ${byteLength} bytes; the declared maximum is ${maxBytes}`,
    );
  }
  return { ok: true, document: { text, byteLength } };
};
