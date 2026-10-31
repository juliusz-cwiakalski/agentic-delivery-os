/**
 * TC-CONF-026 / TC-CONF-027 — the scheduled live-evidence workflow contract.
 *
 * `validateWorkflow(text)` is the pure text contract; `validateWorkflowRoot`
 * additionally reads `.bun-version` and the committed workflow file. Mutation
 * controls build in-memory/temp copies, never touching the live workflow.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parse } from "yaml";

export const WORKFLOW_PATH = ".github/workflows/conformance-live.yml";
const BUN_VERSION_PATH = ".bun-version";
const EXPECTED_BUN = "1.4.4";
const SHA_PINNED = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/;
const TOKEN_KEYS = [
  "CONFORMANCE_LIVE_GITHUB_TOKEN",
  "CONFORMANCE_LIVE_GITLAB_TOKEN",
  "CONFORMANCE_LIVE_JIRA_TOKEN",
] as const;

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const normalizePath = (value: string): string =>
  value
    .replace(/\$\{\{\s*runner\.temp\s*\}\}/g, "$RUNNER_TEMP")
    .replace(/\$\{RUNNER_TEMP\}/g, "$RUNNER_TEMP")
    .replace(/\$RUNNER_TEMP\b/g, "$RUNNER_TEMP");

const extractOut = (run: string): string | undefined => {
  const match = /--out\s+(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(run);
  return match?.[1] ?? match?.[2] ?? match?.[3];
};

const writeBlock = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

/** Validate the workflow text against every contract clause. */
export const validateWorkflow = (text: string): string[] => {
  const failures: string[] = [];
  let parsed: unknown;
  try {
    parsed = parse(text);
  } catch {
    return ["workflow: invalid YAML"];
  }
  if (!isRecord(parsed)) return ["workflow: root is not a mapping"];

  const on = parsed.on;
  if (!isRecord(on)) {
    failures.push("triggers: on must be a mapping");
  } else {
    const triggers = Object.keys(on).sort();
    if (triggers.join(",") !== "schedule,workflow_dispatch") {
      failures.push(
        `triggers: expected only schedule and workflow_dispatch, found ${triggers.join(",")}`,
      );
    }
    const schedule = on.schedule;
    if (!Array.isArray(schedule) || schedule.length !== 1) {
      failures.push("triggers: exactly one schedule entry is required");
    } else {
      const entry = schedule[0];
      if (!isRecord(entry) || entry.cron !== "17 5 * * 1") {
        failures.push("triggers: cron must be 17 5 * * 1");
      }
    }
  }
  const triggerText = writeBlock(on);
  if (triggerText.includes("secrets.")) failures.push("triggers: must not expose secrets");
  for (const token of TOKEN_KEYS) {
    if (triggerText.includes(token)) failures.push(`triggers: must not mention ${token}`);
  }

  const permissions = parsed.permissions;
  if (!isRecord(permissions) || permissions.contents !== "read") {
    failures.push("workflow: permissions.contents must be read");
  } else {
    for (const [key, value] of Object.entries(permissions)) {
      if (value === "write") failures.push(`workflow: permissions.${key} must not be write`);
    }
  }

  const jobs = parsed.jobs;
  if (!isRecord(jobs)) {
    failures.push("jobs: missing jobs mapping");
    return failures;
  }
  const jobNames = Object.keys(jobs);
  if (jobNames.join(",") !== "live") {
    failures.push(`jobs: expected exactly one live job, found ${jobNames.join(",")}`);
  }
  const job = jobs.live;
  if (!isRecord(job)) {
    failures.push("jobs: live job is missing");
    return failures;
  }
  const jobPermissions = job.permissions;
  if (!isRecord(jobPermissions) || jobPermissions.contents !== "read") {
    failures.push("job live: permissions.contents must be read");
  } else {
    for (const [key, value] of Object.entries(jobPermissions)) {
      if (value === "write") failures.push(`job live: permissions.${key} must not be write`);
    }
  }
  if (job["timeout-minutes"] !== 10) failures.push("job live: timeout-minutes must be 10");
  if (Object.hasOwn(job, "continue-on-error")) {
    failures.push("job live: must not set continue-on-error");
  }

  const steps = job.steps;
  if (!Array.isArray(steps)) {
    failures.push("job live: steps must be an array");
    return failures;
  }
  let liveStep: JsonRecord | undefined;
  let uploadStep: JsonRecord | undefined;
  let liveStepIndex = -1;
  for (const [index, rawStep] of steps.entries()) {
    const label = `job live step ${index + 1}`;
    if (!isRecord(rawStep)) {
      failures.push(`${label}: not a mapping`);
      continue;
    }
    if (Object.hasOwn(rawStep, "continue-on-error")) {
      failures.push(`${label}: must not set continue-on-error`);
    }
    const uses = asString(rawStep.uses);
    if (uses !== undefined && !SHA_PINNED.test(uses)) {
      failures.push(`${label}: uses ${uses} is not pinned to a full commit SHA`);
    }
    if (uses?.startsWith("oven-sh/setup-bun@") === true) {
      const withInput = rawStep.with;
      if (!isRecord(withInput) || withInput["bun-version-file"] !== ".bun-version") {
        failures.push(`${label}: setup-bun must use bun-version-file: .bun-version`);
      }
      if (isRecord(withInput) && Object.hasOwn(withInput, "bun-version")) {
        failures.push(`${label}: setup-bun must not hardcode bun-version`);
      }
    }
    const run = asString(rawStep.run);
    if (run !== undefined && run.includes("run-live.ts")) {
      liveStep = rawStep;
      liveStepIndex = index;
      if (extractOut(run) === undefined) failures.push(`${label}: missing --out argument`);
    }
    if (uses?.startsWith("actions/upload-artifact@") === true) {
      uploadStep = rawStep;
    }
  }

  if (liveStep === undefined) failures.push("job live: no step runs run-live.ts");
  if (uploadStep === undefined) {
    failures.push("job live: no artifact upload step");
  } else {
    const uploadText = writeBlock(uploadStep);
    if (uploadStep.if !== "always()") {
      failures.push("upload step: must use if: always()");
    }
    const withInput = uploadStep.with;
    if (!isRecord(withInput)) {
      failures.push("upload step: missing with mapping");
    } else {
      if (withInput.name !== "conformance-live") {
        failures.push("upload step: artifact name must be conformance-live");
      }
      if (withInput["retention-days"] !== 90) {
        failures.push("upload step: retention-days must be 90");
      }
      if (withInput["if-no-files-found"] !== "error") {
        failures.push("upload step: if-no-files-found must be error");
      }
      const path = withInput.path;
      if (typeof path !== "string" || path.trim().length === 0) {
        failures.push("upload step: path is missing or empty");
      }
    }
    if (uploadText.includes("secrets.")) failures.push("upload step: must not expose secrets");
  }

  const liveRun = liveStep !== undefined ? asString(liveStep.run) : undefined;
  const out = liveRun !== undefined ? extractOut(liveRun) : undefined;
  const uploadWith = uploadStep !== undefined ? uploadStep.with : undefined;
  const uploadPath = isRecord(uploadWith) ? asString(uploadWith.path) : undefined;
  if (liveRun === undefined) {
    failures.push("entrypoint: no live run command");
  } else if ((text.match(/--out/g) ?? []).length !== 1) {
    failures.push("entrypoint: exactly one --out flag is required");
  }
  if (out !== undefined && uploadPath !== undefined && uploadPath.trim().length > 0) {
    const normalizedOut = normalizePath(out);
    const normalizedPath = normalizePath(uploadPath);
    if (normalizedOut !== normalizedPath) {
      failures.push(
        `upload step: path ${normalizedPath} does not match entrypoint --out ${normalizedOut}`,
      );
    }
    if (!normalizedPath.endsWith("/conformance-live.json")) {
      failures.push("upload step: path must resolve to conformance-live.json");
    }
  }

  for (const token of TOKEN_KEYS) {
    const referencing = steps
      .map((step, index) => (writeBlock(step).includes(`secrets.${token}`) ? index + 1 : undefined))
      .filter((value): value is number => value !== undefined);
    if (referencing.length === 0) {
      failures.push(`secrets: ${token} is not referenced`);
    } else if (!referencing.includes(liveStepIndex + 1)) {
      failures.push(`secrets: ${token} must be scoped to the live step`);
    }
    for (const index of referencing) {
      if (index !== liveStepIndex + 1) {
        failures.push(`secrets: ${token} is referenced by unrelated step ${index}`);
      }
    }
  }

  if ((text.match(/if:\s*always\(\)/g) ?? []).length !== 1) {
    failures.push("upload step: if: always() must appear exactly once");
  }
  if (!/timeout-minutes:\s*10\b/.test(text)) failures.push("job live: missing timeout-minutes: 10");
  if (/continue-on-error/.test(text)) failures.push("workflow: continue-on-error is forbidden");
  if (/\|\|\s*true/.test(text)) failures.push("workflow: || true is forbidden");
  if (/set \+e/.test(text)) failures.push("workflow: set +e is forbidden");
  if (/secrets:\s*inherit/.test(text)) failures.push("workflow: secrets: inherit is forbidden");
  if (/bun-version:\s/.test(text)) failures.push("workflow: literal bun-version is forbidden");
  if (/gh issue create/.test(text)) failures.push("workflow: ticket creation is forbidden");

  return failures;
};

/** Validate the committed workflow plus its single Bun pin source. */
export const validateWorkflowRoot = (root: string): string[] => {
  const path = join(root, WORKFLOW_PATH);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return [`workflow: ${WORKFLOW_PATH} is missing`];
  }
  const failures = validateWorkflow(text);
  try {
    const bunVersion = readFileSync(join(root, BUN_VERSION_PATH), "utf8").trim();
    if (bunVersion !== EXPECTED_BUN) {
      failures.push(`bun pin: .bun-version must be ${EXPECTED_BUN}`);
    }
  } catch {
    failures.push("bun pin: .bun-version is missing");
  }
  return failures;
};

const writeTempRoot = (workflowText: string): string => {
  const root = mkdtempSync(join(tmpdir(), "gh189-workflow-"));
  const path = join(root, WORKFLOW_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, workflowText);
  writeFileSync(join(root, BUN_VERSION_PATH), `${EXPECTED_BUN}\n`);
  return root;
};

const baseText = (): string => readFileSync(join(process.cwd(), WORKFLOW_PATH), "utf8");

const expectFailure = (mutated: string, fragment: string): void => {
  const failures = validateWorkflow(mutated);
  expect(
    failures.some((message) => message.includes(fragment)),
    failures.join("\n"),
  ).toBe(true);
};

describe("TC-CONF-026 scheduled workflow contract", () => {
  test("the committed workflow passes and the Bun pin resolves once", () => {
    expect(validateWorkflowRoot(process.cwd())).toEqual([]);
  });

  test("triggers are weekly and dispatch-only", () => {
    const text = baseText();
    expect(text).toContain('cron: "17 5 * * 1"');
    expect(text).not.toContain("pull_request");
    expect(text).not.toContain("push:");
  });
});

describe("TC-CONF-027 workflow mutation controls", () => {
  test("trigger mutations fail by trigger block", () => {
    const base = baseText();
    expectFailure(base.replace('  schedule:\n    - cron: "17 5 * * 1"\n', ""), "triggers:");
    expectFailure(
      base.replace("  workflow_dispatch:", "  workflow_dispatch:\n  pull_request:"),
      "triggers:",
    );
    expectFailure(
      base.replace("  workflow_dispatch:", "  workflow_dispatch:\n  push:"),
      "triggers:",
    );
    expectFailure(base.replace('"17 5 * * 1"', '"0 0 * * 1"'), "cron");
  });

  test("action pin and bypass mutations fail by step", () => {
    const base = baseText();
    expectFailure(
      base.replace(
        "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
        "actions/checkout@v4",
      ),
      "not pinned",
    );
    expectFailure(
      base.replace(
        "pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320",
        "pnpm/action-setup@v4",
      ),
      "not pinned",
    );
    expectFailure(
      base.replace(
        "    timeout-minutes: 10",
        "    timeout-minutes: 10\n    continue-on-error: true",
      ),
      "continue-on-error",
    );
  });

  test("permission mutations fail by job", () => {
    const base = baseText();
    expectFailure(
      base.replace("permissions:\n  contents: read", "permissions:\n  contents: write"),
      "contents",
    );
    expectFailure(
      base.replace(
        "    permissions:\n      contents: read",
        "    permissions:\n      contents: read\n      id-token: write",
      ),
      "id-token",
    );
  });

  test("upload mutations fail naming the upload step", () => {
    const base = baseText();
    expectFailure(base.replace("        if: always()\n", ""), "if: always()");
    expectFailure(base.replace("retention-days: 90", "retention-days: 0"), "retention-days");
    expectFailure(base.replace("name: conformance-live", "name: other"), "artifact name");
    expectFailure(
      base.replace("if-no-files-found: error", "if-no-files-found: warn"),
      "if-no-files-found",
    );
    expectFailure(
      base.replace('--out "$RUNNER_TEMP/conformance-live.json"', '--out "$RUNNER_TEMP/other.json"'),
      "does not match",
    );
  });

  test("missing, empty and unresolvable upload paths fail in validateWorkflowRoot", () => {
    const base = baseText();
    const missing = base.replace("          path: ${{ runner.temp }}/conformance-live.json\n", "");
    const empty = base.replace(
      "          path: ${{ runner.temp }}/conformance-live.json",
      '          path: ""',
    );
    const unresolvable = base.replace(
      "          path: ${{ runner.temp }}/conformance-live.json",
      "          path: ${{ runner.temp }}/other.json",
    );
    for (const [label, text] of [
      ["missing", missing],
      ["empty", empty],
      ["unresolvable", unresolvable],
    ] as const) {
      const root = writeTempRoot(text);
      try {
        const failures = validateWorkflowRoot(root);
        expect(failures.length, label).toBeGreaterThan(0);
        expect(
          failures.some((message) => message.includes("path")),
          label,
        ).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("a literal Bun version and secret-scope mutations fail", () => {
    const base = baseText();
    expectFailure(
      base.replace("bun-version-file: .bun-version", 'bun-version: "1.4.4"'),
      "bun-version",
    );
    expectFailure(
      base.replace(
        "        run: pnpm build",
        "        run: pnpm build\n        with:\n          secrets: inherit",
      ),
      "secrets: inherit",
    );
    const token = "CONFORMANCE_LIVE_GITHUB_TOKEN";
    const unrelated = base.replace(
      "      - name: Checkout\n        uses:",
      `      - name: Checkout\n        env:\n          ${token}: \${{ secrets.${token} }}\n        uses:`,
    );
    expectFailure(unrelated, "unrelated step");
    expectFailure(
      base.replace(
        "        run: pnpm build",
        "        run: |\n          pnpm build\n          gh issue create --title x",
      ),
      "ticket creation",
    );
  });
});
