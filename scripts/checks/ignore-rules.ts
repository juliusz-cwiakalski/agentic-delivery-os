/**
 * TC-SCAFFOLD-034 — ignore rules incl. the brand-free project-local config glob.
 *
 * Asserts the four coverage classes, the absence of product-name literals in the
 * ignore rules, rename survival of the config glob, and real `git check-ignore`
 * behaviour on representative paths.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const failures: string[] = [];
const fail = (message: string): void => {
  failures.push(message);
};

const ignoreText = readFileSync(join(ROOT, ".gitignore"), "utf8");
const lines = ignoreText
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"));

const hasPattern = (pattern: string): boolean => lines.includes(pattern);

// 1. Four coverage classes.
const coverage: Array<{ label: string; patterns: string[] }> = [
  { label: "workspace dependency dirs", patterns: ["node_modules/"] },
  { label: "build output", patterns: ["dist/", "packages/*/dist/"] },
  { label: "local ephemeral state", patterns: [".ai/local/"] },
  { label: "project-local config", patterns: [".*/config.local.yaml"] },
];
for (const entry of coverage) {
  for (const pattern of entry.patterns) {
    if (!hasPattern(pattern)) fail(`.gitignore is missing the ${entry.label} pattern ${pattern}`);
  }
}

// 2. Brand-free glob + no product-name literals in the ignore rules.
const configPattern = ".*/config.local.yaml";
if (!configPattern.includes("*")) {
  fail(`project-local config pattern ${configPattern} must be a glob, not a literal path`);
}
const productTokens = ["ados", "ADOS_", "~/.ados"];
for (const line of lines) {
  for (const token of productTokens) {
    if (line.toLowerCase().includes(token.toLowerCase())) {
      fail(`.gitignore line ${JSON.stringify(line)} contains product-name token ${token}`);
    }
  }
}

// 3. Rename simulation: a synthetic product name still matches the same path shape.
const globToRegExp = (glob: string): RegExp => {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
};
const configRegExp = globToRegExp(configPattern);
const syntheticNames = [".renamed-product", ".alt-brand", ".synthetic"];
for (const name of syntheticNames) {
  const probe = `${name}/config.local.yaml`;
  if (!configRegExp.test(probe)) {
    fail(`rename simulation failed: ${configPattern} does not match ${probe}`);
  }
}
if (configRegExp.test("packages/core/.nested/config.local.yaml")) {
  fail("project-local config glob must be anchored to the repository root (embedded slash)");
}

// 4. Real ignore behaviour.
const expectIgnored = (path: string, ignored: boolean): void => {
  let actual = false;
  try {
    execFileSync("git", ["check-ignore", "-q", "--no-index", path], { cwd: ROOT, stdio: "ignore" });
    actual = true;
  } catch {
    actual = false;
  }
  if (actual !== ignored) {
    fail(`git check-ignore reports ${path} ignored=${actual}; expected ignored=${ignored}`);
  }
};
expectIgnored("node_modules/@delivery-os/core/index.js", true);
expectIgnored("packages/core/dist/index.js", true);
expectIgnored("dist/index.js", true);
expectIgnored(".ai/local/state.json", true);
expectIgnored(".example-app/config.local.yaml", true);
expectIgnored("packages/core/.nested/config.local.yaml", false);

if (failures.length > 0) {
  for (const message of failures) console.error(`FAIL ignore-rules: ${message}`);
  process.exit(1);
}
console.log(
  "OK ignore-rules: four coverage classes, brand-free glob, rename-safe, git probes green",
);
