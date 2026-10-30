/**
 * GH-172 CI parity — exports gate: every publishable package must pass
 * `attw --pack . --profile esm-only` against its built `dist`, the way the
 * ts-exports job runs it. Catches declaration files whose relative imports do
 * not resolve inside the packed tarball under node16 ESM while the workspace
 * (unpacked) tree still resolves them.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PUBLISHABLE } from "./exports-discipline";

const PROFILE = "esm-only";
const DETAIL_MARKERS = ["💀", "🥴", "⚠️"];
const DETAIL_LINE_LIMIT = 8;

const detailExcerpt = (output: string): string => {
  const lines = output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  const marked = lines.filter((line) => DETAIL_MARKERS.some((marker) => line.includes(marker)));
  const excerpt = (marked.length > 0 ? marked : lines).slice(-DETAIL_LINE_LIMIT);
  return excerpt.join(" | ").slice(0, 600);
};

export const checkPackage = (root: string, packageName: string): string[] => {
  const label = `packages/${packageName}`;
  if (!existsSync(join(root, "packages", packageName, "dist"))) {
    return [`${label}: dist/ missing — run pnpm build before the attw parity check`];
  }
  const result = spawnSync("pnpm", ["exec", "attw", "--pack", ".", "--profile", PROFILE], {
    cwd: join(root, "packages", packageName),
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.status === 0) return [];
  const detail = detailExcerpt(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  return [
    `${label}: attw --pack --profile ${PROFILE} failed (exit ${String(result.status)}): ${detail}`,
  ];
};

export const validate = (root: string): string[] =>
  PUBLISHABLE.flatMap((packageName) => checkPackage(root, packageName));

if (import.meta.main) {
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL exports-parity: ${message}`);
    process.exit(1);
  }
  console.log(
    `OK exports-parity: ${PUBLISHABLE.length} publishables pass attw --pack --profile ${PROFILE}`,
  );
}
