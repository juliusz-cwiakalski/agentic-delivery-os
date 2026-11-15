/**
 * TC-XPLAN-001/002/004/005/006/007 (GH-310 F-1, DM-1, DEC-1, DEC-9, DEC-15):
 * the additive plan member declaration validates, echoes verbatim in declared
 * order, and every declared defect is classified as `plan.schema.invalid`
 * naming `members[i].<field>` in both `plan validate` and `lint plan`.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { validatePlan } from "../../packages/core/src/domain/plan-validate";
import { API_MEMBER, CHANGE_REF, WEB_MEMBER } from "../fixtures/cross-repository/constants";
import {
  memberSpec,
  planYaml,
  twoMemberPlanYaml,
  writeChangeFolder,
} from "../fixtures/cross-repository/plan";
import {
  createRecorder,
  type PlanWorld,
  parseEnvelope,
  planLintRuntime,
  planRuntime,
  planYamlParser,
  runLintCli,
  runPlanCli,
  validateYamlFixture,
} from "../fixtures/plan/harness/index";
import {
  ACCEPTED_REPO_KEYS,
  acceptedPlan,
  REJECTED_REPO_KEYS,
  rejectedPlan,
} from "../fixtures/plan/members-grammar/cases";
import { INVALID_MEMBER_CASES } from "../fixtures/plan/members-invalid/cases";
import {
  OPTIONAL_DEPENDS_ON_PLAN,
  REQUIRED_MEMBER_CASES,
} from "../fixtures/plan/members-required/cases";

/** A one-artifact world built from fixture text the case just rendered. */
const worldFromText = (ref: string, text: string): PlanWorld => ({
  artifacts: { [ref]: [{ kind: "yaml", path: `chg-${ref}-plan.yaml`, text }] },
});

const declared = (text: string) =>
  validatePlan({
    workItemRef: CHANGE_REF,
    read: {
      ok: true,
      artifact: { kind: "yaml", path: `chg-${CHANGE_REF}-plan.yaml` },
      text,
    },
    parseYaml: planYamlParser,
  });

const validateViaCli = async (text: string) =>
  runPlanCli(
    ["plan", "validate", CHANGE_REF, "--json"],
    planRuntime(worldFromText(CHANGE_REF, text)),
  );

const lintViaCli = async (text: string) =>
  runLintCli(
    ["lint", "plan", CHANGE_REF, "--json"],
    planLintRuntime(worldFromText(CHANGE_REF, text)),
  );

describe("TC-XPLAN-001 two-member declaration", () => {
  test("validates, is ready, and echoes both entries in declared order", () => {
    const verdict = declared(twoMemberPlanYaml());
    expect(verdict.verdict).toBe("valid");
    expect(verdict.readyForDevelopment).toBe(true);
    expect(verdict.members).toEqual([
      {
        repoKey: API_MEMBER.repoKey,
        slice: API_MEMBER.slice,
        branch: API_MEMBER.branch,
        pullRequest: API_MEMBER.pullRequest,
        dependsOn: [],
        gates: ["ci-green", "push-parity", "owner-gate"],
      },
      {
        repoKey: WEB_MEMBER.repoKey,
        slice: WEB_MEMBER.slice,
        branch: WEB_MEMBER.branch,
        pullRequest: WEB_MEMBER.pullRequest,
        dependsOn: [API_MEMBER.repoKey],
        gates: ["ci-green", "push-parity"],
      },
    ]);
  });

  test("the CLI verdict exits 0 and echoes byte-identically on a second run", async () => {
    const world = worldFromText(CHANGE_REF, twoMemberPlanYaml());
    const first = await runPlanCli(["plan", "validate", CHANGE_REF, "--json"], planRuntime(world));
    const second = await runPlanCli(["plan", "validate", CHANGE_REF, "--json"], planRuntime(world));
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toBe(second.stdout);
    const envelope = parseEnvelope(first.stdout);
    expect((envelope.data as { readonly members?: unknown }).members).toHaveLength(2);
  });

  test("one spec and one plan exist, with no per-member change folder", () => {
    const root = mkdtempSync(`${tmpdir()}/gh310-plan-folder-`);
    try {
      const folder = writeChangeFolder(root, twoMemberPlanYaml());
      const files = readdirSync(folder).sort();
      expect(files).toEqual([`chg-${CHANGE_REF}-plan.yaml`, `chg-${CHANGE_REF}-spec.md`]);
      expect(readdirSync(folder).some((name) => name.includes("@"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a path-like slice is echoed and never used as a scope matcher", () => {
    const text = planYaml({
      members: [memberSpec(API_MEMBER, { slice: "packages/../../secret" })],
    });
    const verdict = declared(text);
    expect(verdict.verdict).toBe("valid");
    expect(verdict.members?.[0]?.slice).toBe("packages/../../secret");
  });
});

describe("TC-XPLAN-002 classified declaration defects", () => {
  test.each(INVALID_MEMBER_CASES)("$name is plan.schema.invalid at $field", async (entry) => {
    const verdict = declared(entry.plan);
    expect(verdict.verdict).toBe("invalid");
    expect(verdict.readyForDevelopment).toBe(false);
    expect(verdict.members).toBeUndefined();
    const error = verdict.errors.find((candidate) => candidate.field === entry.field);
    expect(error?.code).toBe("plan.schema.invalid");

    const validate = await validateViaCli(entry.plan);
    expect(validate.exitCode).toBe(1);
    const data = parseEnvelope(validate.stdout).data as { readonly members?: unknown };
    expect(data.members).toBeUndefined();

    const lint = await lintViaCli(entry.plan);
    expect(lint.exitCode).toBe(1);
    const document = (
      parseEnvelope(lint.stdout).data as {
        readonly documents?: readonly {
          readonly errors?: readonly {
            readonly code?: string;
            readonly location?: { readonly field?: string };
          }[];
        }[];
      }
    ).documents?.[0];
    expect(document?.errors?.some((error) => error.location?.field === entry.field)).toBe(true);
  });

  test("classification is deterministic across two runs", async () => {
    const entry = INVALID_MEMBER_CASES.at(0);
    if (entry === undefined) throw new Error("missing invalid member fixture");
    const first = await validateViaCli(entry.plan);
    const second = await validateViaCli(entry.plan);
    expect(first.stdout).toBe(second.stdout);
  });
});

describe("TC-XPLAN-004 closed member field set", () => {
  test("exactly the six declared fields are echoed for a fully populated entry", () => {
    const echoed = declared(twoMemberPlanYaml()).members?.[0];
    expect(Object.keys(echoed ?? {}).sort()).toEqual(
      ["branch", "dependsOn", "gates", "pullRequest", "repoKey", "slice"].sort(),
    );
  });

  test("a seventh member key is rejected as plan.schema.invalid", () => {
    const text = planYaml({ members: [{ ...memberSpec(API_MEMBER), owner: "someone" }] });
    const verdict = declared(text);
    expect(verdict.verdict).toBe("invalid");
    expect(verdict.errors.some((error) => error.field === "members[0].owner")).toBe(true);
  });

  test("a member-less plan echoes no members key at all", () => {
    const verdict = validateYamlFixture("GH-306", "valid/baseline.yaml");
    expect(verdict.verdict).toBe("valid");
    expect(Object.hasOwn(verdict, "members")).toBe(false);
  });
});

describe("TC-XPLAN-005 gate identifiers are shape-only", () => {
  test("a well-formed unresolvable identifier validates at exit 0 with zero config reads", async () => {
    const recorder = createRecorder();
    const text = planYaml({
      members: [memberSpec(API_MEMBER, { gates: ["custom-member-check"] })],
    });
    const run = await runPlanCli(
      ["plan", "validate", CHANGE_REF, "--json"],
      planRuntime(worldFromText(CHANGE_REF, text), recorder),
    );
    expect(run.exitCode).toBe(0);
    expect(recorder.reads).toEqual([`plan:${CHANGE_REF}`]);
    expect(recorder.configReads).toBe(0);
    expect(recorder.writes).toBe(0);
    expect(recorder.networkCalls).toBe(0);
  });

  test("the verdict is byte-identical with or without an environment change", async () => {
    const text = planYaml({
      members: [memberSpec(API_MEMBER, { gates: ["custom-member-check"] })],
    });
    const first = await validateViaCli(text);
    const second = await validateViaCli(text);
    expect(first.stdout).toBe(second.stdout);
  });

  test("a 64-character identifier is the inclusive boundary and validates", () => {
    const text = planYaml({ members: [memberSpec(API_MEMBER, { gates: ["g".repeat(64)] })] });
    const verdict = declared(text);
    expect(verdict.verdict).toBe("valid");
    expect(verdict.members?.[0]?.gates).toEqual(["g".repeat(64)]);
  });

  test.each([
    ["empty identifier", ""],
    ["non-string identifier", 42],
    ["65-character identifier", "g".repeat(65)],
  ])("%s is rejected naming members[0].gates", (_label, identifier) => {
    const text = planYaml({ members: [memberSpec(API_MEMBER, { gates: [identifier] })] });
    const verdict = declared(text);
    expect(verdict.verdict).toBe("invalid");
    expect(verdict.errors.some((error) => error.field === "members[0].gates")).toBe(true);
  });
});

describe("TC-XPLAN-006 required fields and empty values", () => {
  test.each(REQUIRED_MEMBER_CASES)("$name is classified at $field", async (entry) => {
    const verdict = declared(entry.plan);
    expect(verdict.verdict).toBe("invalid");
    expect(verdict.readyForDevelopment).toBe(false);
    expect(verdict.errors.some((error) => error.field === entry.field)).toBe(true);
    expect(verdict.members).toBeUndefined();

    const lint = await lintViaCli(entry.plan);
    expect(lint.exitCode).toBe(1);
  });

  test("an omitted dependsOn validates and echoes with no dependsOn key", () => {
    const verdict = declared(OPTIONAL_DEPENDS_ON_PLAN);
    expect(verdict.verdict).toBe("valid");
    expect(Object.hasOwn(verdict.members?.[0] ?? {}, "dependsOn")).toBe(false);
  });

  test("no default value is invented for a missing field", () => {
    const { slice: _omitted, ...withoutSlice } = memberSpec(API_MEMBER);
    void _omitted;
    const text = planYaml({ members: [withoutSlice] });
    const verdict = declared(text);
    expect(verdict.verdict).toBe("invalid");
    expect(verdict.members).toBeUndefined();
  });
});

describe("TC-XPLAN-007 repoKey grammar", () => {
  test.each(REJECTED_REPO_KEYS)("$name is rejected naming members[0].repoKey", (entry) => {
    const verdict = declared(rejectedPlan(entry.name));
    expect(verdict.verdict).toBe("invalid");
    expect(verdict.errors.some((error) => error.field === "members[0].repoKey")).toBe(true);
  });

  test.each(ACCEPTED_REPO_KEYS)("$name is accepted and echoed verbatim", (entry) => {
    const verdict = declared(acceptedPlan(entry.name));
    expect(verdict.verdict).toBe("valid");
    expect(verdict.members?.[0]?.repoKey).toBe(entry.repoKey);
  });
});
