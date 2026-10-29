/**
 * TC-SCAFFOLD-031 — pre-freeze publish guard.
 *
 * Fails when any intended-publishable is still `private: true` OR when the
 * branded scope has not been applied. Passes only in the freeze configuration.
 * The release job runs this before any publish step.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const PUBLISHABLE = ["core", "adapters", "cli", "mcp", "opencode"];
export const NEUTRAL_SCOPE = "@delivery-os";

type Manifest = { name?: string; private?: boolean };
export type GuardReason = { package: string; reason: string };
export type GuardResult = { ok: boolean; reasons: GuardReason[] };

export const evaluate = (root: string): GuardResult => {
  const reasons: GuardReason[] = [];
  const rootManifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    publishScope?: unknown;
  };
  const scope = rootManifest.publishScope;

  if (typeof scope !== "string" || scope.length === 0 || scope === NEUTRAL_SCOPE) {
    reasons.push({
      package: "root",
      reason: "branded scope not applied: root publishScope is unset or still neutral",
    });
  }

  for (const packageName of PUBLISHABLE) {
    const manifest = JSON.parse(
      readFileSync(join(root, "packages", packageName, "package.json"), "utf8"),
    ) as Manifest;
    const label = String(manifest.name ?? packageName);
    if (manifest.private !== false) {
      reasons.push({ package: label, reason: "still private: true (pre-freeze)" });
    }
    if (typeof scope === "string" && scope.length > 0 && !label.startsWith(`${scope}/`)) {
      reasons.push({
        package: label,
        reason: "branded scope not applied: package name is neutral",
      });
    }
  }

  return { ok: reasons.length === 0, reasons };
};

if (import.meta.main) {
  const result = evaluate(process.cwd());
  if (!result.ok) {
    for (const entry of result.reasons) {
      console.error(`FAIL publish-guard: ${entry.package}: ${entry.reason}`);
    }
    process.exit(1);
  }
  console.log("OK publish-guard: five publishables are public and branded; publish allowed");
}
