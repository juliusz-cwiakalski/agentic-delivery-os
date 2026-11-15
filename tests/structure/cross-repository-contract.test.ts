/**
 * Cross-repository contract suite (GH-310). Phase 1 lands the closed member
 * field set (TC-XPLAN-004); phase 5 extends the same file with the envelope,
 * vocabulary, bounds, identity-reuse, consumer-tolerance, and report-type
 * continuity cases (TC-XCTR-001, 003, 004, 005, 007).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveAppErrorCode } from "../../packages/cli/src/classify";
import {
  CLOSEOUT_MAX_MEMBERS,
  CLOSEOUT_MEMBER_CLEANUP_APPLY_OUTCOMES,
  CLOSEOUT_MEMBER_CLEANUP_PLAN_OUTCOMES,
  CLOSEOUT_MEMBER_ISSUE_APPLY_OUTCOMES,
  CLOSEOUT_MEMBER_ISSUE_PLAN_OUTCOMES,
  type CloseoutMemberReport,
  DOMAIN_KINDS,
  ERROR_TABLE,
  type ErrorTableEntry,
  PLAN_MAX_MEMBER_DEPENDS_ON,
  PLAN_MAX_MEMBER_GATE_CHARS,
  PLAN_MAX_MEMBER_GATES,
  PLAN_MAX_MEMBERS,
  PLAN_MEMBER_FIELDS,
  PLAN_MEMBER_REQUIRED_FIELDS,
  QUEUE_MAX_REF_CHARS,
  QUEUE_MEMBER_REF_SEPARATOR,
  VERIFY_GATES_CI_READINGS,
  VERIFY_GATES_DEFINITION_OF_DONE_STATUSES,
  VERIFY_GATES_MAX_MEMBERS,
  VERIFY_GATES_MEMBER_VERDICTS,
  VERIFY_GATES_REVIEW_OBSERVATION_VERDICTS,
  VERIFY_GATES_REVIEW_VERDICTS,
} from "../../packages/core/src/contracts/index";
import { canonicalChangeRef, parseMemberRef } from "../../packages/core/src/domain/plan-members";
import {
  appendMergeGateVerification,
  readMergeGateVerifications,
} from "../../packages/core/src/state/index";
import {
  planDocumentFromValidateData,
  validatePlan,
} from "../../packages/core/src/domain/plan-validate";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { runCloseoutCli } from "../fixtures/closeout/cli";
import { consumeMemberCloseout, consumeMemberGates } from "../fixtures/closeout/legacy-consumer";
import {
  memberCloseoutFacts,
  memberCloseoutObservation,
  runMemberCloseout,
} from "../fixtures/cross-repository/closeout";
import {
  API_MEMBER,
  CHANGE_REF,
  DOCS_MEMBER,
  WEB_MEMBER,
} from "../fixtures/cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  memberGatesRuntime,
  type MemberGatesWorld,
  runMemberGates,
} from "../fixtures/cross-repository/facts";
import { memberSpec, planYaml, twoMemberPlanYaml } from "../fixtures/cross-repository/plan";
import { createMemberQueueHarness, MEMBER_REFS } from "../fixtures/cross-repository/queue";
import {
  type PlanWorld,
  planRuntime,
  planYamlParser,
  runPlanCli,
} from "../fixtures/plan/harness/index";
import { makeAuditStore, removeRoot } from "../fixtures/state/harness";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";

const ROOT = process.cwd();

const contractFiles = (): readonly string[] =>
  readdirSync(join(ROOT, "packages/core/src/contracts"))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => readFileSync(join(ROOT, "packages/core/src/contracts", file), "utf8"));

const parseJson = (text: string): unknown => JSON.parse(text) as unknown;

/** An in-memory member plan world (one YAML plan inside the change folder). */
const memberPlanWorld = (planText: string): PlanWorld => ({
  artifacts: {
    [CHANGE_REF]: [{ kind: "yaml", path: `chg-${CHANGE_REF}-plan.yaml`, text: planText }],
  },
});

describe("TC-XPLAN-004 closed member field set", () => {
  test("the six declared member fields are the only fields", () => {
    expect([...PLAN_MEMBER_FIELDS].sort()).toEqual(
      ["branch", "dependsOn", "gates", "pullRequest", "repoKey", "slice"].sort(),
    );
  });

  test("the required set is repoKey, slice, branch and gates", () => {
    expect([...PLAN_MEMBER_REQUIRED_FIELDS].sort()).toEqual(
      ["branch", "gates", "repoKey", "slice"].sort(),
    );
  });
});

describe("TC-XPLAN-001 members are declaration data only", () => {
  test("planDocumentFromValidateData carries members and never widens phase scope", () => {
    const verdict = validatePlan({
      workItemRef: "GH-310",
      read: {
        ok: true,
        artifact: { kind: "yaml", path: "chg-GH-310-plan.yaml" },
        text: twoMemberPlanYaml(),
      },
      parseYaml: planYamlParser,
    });
    const document = planDocumentFromValidateData(verdict);
    if (document === undefined) throw new Error("the two-member plan must validate");
    expect(document.members?.map((member) => member.repoKey)).toEqual(
      verdict.members?.map((member) => member.repoKey),
    );
    expect(document.phases[0]?.scope.files).toEqual(["doc/changes/chg-GH-310-plan.yaml"]);
    expect(document.phases[1]?.scope.files).toEqual(["packages/core/src/index.ts"]);
  });

  test("a member-less verdict produces a document with no members key", () => {
    const verdict = validatePlan({
      workItemRef: "GH-310",
      read: {
        ok: true,
        artifact: { kind: "yaml", path: "chg-GH-310-plan.yaml" },
        text: planYaml(),
      },
      parseYaml: planYamlParser,
    });
    expect(verdict.verdict).toBe("valid");
    expect(Object.hasOwn(planDocumentFromValidateData(verdict), "members")).toBe(false);
  });
});

const twoMemberGatesWorld = (): MemberGatesWorld => ({
  members: [declaredMember(API_MEMBER), declaredMember(WEB_MEMBER)],
  reads: {
    [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
    [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
  },
  reviews: [],
});

const MEMBER_KEYS = [
  '"members"',
  '"definitionOfDone"',
  '"blockingMembers"',
  '"reviewFlow"',
] as const;

/** The five-field envelope keys: four mandatory plus exactly one of data/error. */
const expectEnvelope = (value: unknown): Record<string, unknown> => {
  expect(assertEnvelopeContract(value)).toEqual([]);
  const envelope = value as Record<string, unknown>;
  const keys = Object.keys(envelope).sort();
  const expected =
    envelope.data === undefined
      ? ["error", "exitCode", "runId", "schemaVersion", "timing"]
      : ["data", "exitCode", "runId", "schemaVersion", "timing"];
  expect(keys).toEqual(expected);
  expect(envelope.ok).toBeUndefined();
  expect(envelope.command).toBeUndefined();
  return envelope;
};

describe("TC-XCTR-001 every touched surface keeps the five-field envelope", () => {
  test("the member plan, gates, closeout and queue envelopes are contract-valid", async () => {
    const plan = await runPlanCli(
      ["plan", "validate", CHANGE_REF, "--json"],
      planRuntime(
        memberPlanWorld(planYaml({ members: [memberSpec(API_MEMBER), memberSpec(WEB_MEMBER)] })),
      ),
    );
    const planEnvelope = expectEnvelope(parseJson(plan.stdout));
    expect(planEnvelope.data).toBeDefined();

    const gates = await runMemberGates(twoMemberGatesWorld());
    const gatesEnvelope = expectEnvelope(parseJson(gates.stdout));
    const gatesData = gatesEnvelope.data as Record<string, unknown>;
    for (const key of ["definitionOfDone", "blockingMembers", "reviewFlow"]) {
      expect(gatesData, key).toHaveProperty(key);
    }

    const observations = [
      memberCloseoutObservation(API_MEMBER),
      memberCloseoutObservation(WEB_MEMBER),
      memberCloseoutObservation(DOCS_MEMBER, { merged: false }),
    ];
    const closeout = await runCloseoutCli(["closeout", CHANGE_REF, "--json"], {
      facts: memberCloseoutFacts(observations, { injectMembers: false }),
      members: observations,
    });
    const closeoutEnvelope = expectEnvelope(closeout.envelope);
    expect(closeoutEnvelope.data as Record<string, unknown>).toHaveProperty("members");

    const world = createMemberQueueHarness("contract-envelope");
    const queue = await world.harness.run(["queue", "add", CHANGE_REF, "--json"]);
    const queueEnvelope = expectEnvelope(parseJson(queue.stdout));
    expect(queueEnvelope.data as Record<string, unknown>).toHaveProperty("members");
  });

  test("a data-bearing negative cross-repository verdict carries data and no error", async () => {
    const blocked = await runMemberGates({
      ...twoMemberGatesWorld(),
      reads: {
        [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
        [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER, {
          checkRuns: { ok: true, value: { items: [], pageItemCount: 0 } },
        }),
      },
    });
    expect(blocked.exitCode).toBe(1);
    const envelope = expectEnvelope(parseJson(blocked.stdout));
    expect(envelope.error).toBeUndefined();
    expect((envelope.data as Record<string, unknown>).overall).toBe("fail");

    const invalidPlan = await runPlanCli(
      ["plan", "validate", CHANGE_REF, "--json"],
      planRuntime(
        memberPlanWorld(planYaml({ members: [memberSpec(API_MEMBER), memberSpec(API_MEMBER)] })),
      ),
    );
    const invalidEnvelope = expectEnvelope(parseJson(invalidPlan.stdout));
    expect(invalidEnvelope.error).toBeUndefined();
    expect(invalidEnvelope.data as Record<string, unknown>).toHaveProperty("verdict", "invalid");
  });
});

describe("TC-XCTR-003 exercised refusals resolve to delivered identities only", () => {
  const codes = async (): Promise<readonly string[]> => {
    const emitted: string[] = [];
    const plan = await runPlanCli(
      ["plan", "validate", CHANGE_REF, "--json"],
      planRuntime(
        memberPlanWorld(planYaml({ members: [memberSpec(API_MEMBER), memberSpec(API_MEMBER)] })),
      ),
    );
    const data = (parseJson(plan.stdout) as { readonly data: Record<string, unknown> }).data as {
      readonly errors?: readonly { readonly code?: string }[];
    };
    for (const error of data.errors ?? []) if (error.code !== undefined) emitted.push(error.code);

    const queueWorld = createMemberQueueHarness("contract-identities");
    expect((await queueWorld.harness.run(["queue", "add", CHANGE_REF, "--json"])).exitCode).toBe(0);
    const unmet = await queueWorld.harness.run([
      "queue",
      "claim",
      MEMBER_REFS.web,
      "--holder",
      "holder-web",
      "--json",
    ]);
    const unmetCode = (parseJson(unmet.stdout) as { readonly error?: { readonly code?: string } })
      .error?.code;
    if (unmetCode !== undefined) emitted.push(unmetCode);
    const cycle = await queueWorld.harness.run([
      "queue",
      "dep",
      MEMBER_REFS.api,
      MEMBER_REFS.web,
      "--json",
    ]);
    const cycleCode = (parseJson(cycle.stdout) as { readonly error?: { readonly code?: string } })
      .error?.code;
    if (cycleCode !== undefined) emitted.push(cycleCode);
    return emitted;
  };

  test("the exercised refusal set is the delivered plan/queue vocabulary", async () => {
    const emitted = [...new Set(await codes())].sort();
    expect(emitted).toEqual(
      ["plan.schema.invalid", "queue.dependency-cycle", "queue.precondition.unmet"].sort(),
    );
    for (const code of emitted) expect(resolveAppErrorCode(code).ok, code).toBe(true);
  });

  test("no unavailable or absent CI reading becomes an invented error identity", async () => {
    const world: MemberGatesWorld = {
      ...twoMemberGatesWorld(),
      reads: {
        [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
        [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER, {
          checkRuns: {
            ok: false,
            reason: "read-failed",
            failureClass: "provider.payload.invalid",
          },
        }),
      },
    };
    const run = await runMemberGates(world);
    expect(run.exitCode).toBe(1);
    const envelope = parseJson(run.stdout) as {
      readonly data: {
        readonly overall: string;
        readonly definitionOfDone: { readonly status: string };
      };
    };
    expect(envelope.data.overall).toBe("fail");
    expect(envelope.data.definitionOfDone.status).toBe("blocked");
    expect(run.stdout).not.toContain('"error"');
  });

  test("the state-additivity baseline records no new kind, schema, or prefix", () => {
    const baseline = JSON.parse(
      readFileSync(join(ROOT, "tests/fixtures/events/state-additivity-baseline.json"), "utf8"),
    ) as { readonly constants: Readonly<Record<string, string>> };
    const pattern = /export const (\w+) = "([^"]*)" as const;/gu;
    const current: Record<string, string> = {};
    for (const file of readdirSync(join(ROOT, "packages/core/src/contracts")).sort()) {
      if (!file.endsWith(".ts") || file === "taxonomy.ts") continue;
      const text = readFileSync(join(ROOT, "packages/core/src/contracts", file), "utf8");
      for (const match of text.matchAll(pattern)) {
        const name = match[1] as string;
        if (
          name !== "STATE_SCHEMA_VERSION" &&
          !["_RECORD_KIND", "_SCHEMA", "_PAYLOAD_SCHEMA", "_KEY_PREFIX", "_SCHEMA_ID"].some(
            (suffix) => name.endsWith(suffix),
          )
        ) {
          continue;
        }
        current[`${file}:${name}`] = match[2] as string;
      }
    }
    expect(current).toEqual(baseline.constants);
  });
});

describe("TC-XCTR-004 additive member fields are consumable by key, never by position", () => {
  test("the closeout consumer resolves every member and step and ignores unknown fields", async () => {
    const observations = [
      memberCloseoutObservation(API_MEMBER),
      memberCloseoutObservation(WEB_MEMBER),
    ];
    const run = await runMemberCloseout({ observations, apply: true });
    if (!run.result.ok) throw new Error("closeout failed");
    const data = run.result.data;
    const withFuture = {
      ...data,
      members: (data.members ?? []).map((member) => ({ ...member, future: "ignored" })),
      steps: data.steps.map((step) => ({ ...step, future: "ignored" })),
    };
    const view = consumeMemberCloseout(withFuture, [API_MEMBER.repoKey, WEB_MEMBER.repoKey]);
    expect(view.violations).toEqual([]);
    expect(Object.keys(view.members).sort()).toEqual(
      [API_MEMBER.repoKey, WEB_MEMBER.repoKey].sort(),
    );
    expect(Object.keys(view.steps).sort()).toEqual(data.steps.map((step) => step.stepId).sort());
  });

  test("the shared-verdict consumer resolves each member by repoKey and tolerates additive fields", async () => {
    const run = await runMemberGates(twoMemberGatesWorld());
    const data = (
      parseJson(run.stdout) as {
        readonly data: {
          readonly definitionOfDone: {
            readonly members: readonly Record<string, unknown>[];
          };
        };
      }
    ).data;
    const withFuture = {
      definitionOfDone: {
        members: data.definitionOfDone.members.map((member) => ({ ...member, future: "ignored" })),
      },
    };
    const view = consumeMemberGates(withFuture, [API_MEMBER.repoKey, WEB_MEMBER.repoKey]);
    expect(view.violations).toEqual([]);
    expect(Object.keys(view.members).sort()).toEqual(
      [API_MEMBER.repoKey, WEB_MEMBER.repoKey].sort(),
    );
  });

  test("a reordered array is a declared-order violation while key lookup still resolves", async () => {
    const observations = [
      memberCloseoutObservation(API_MEMBER),
      memberCloseoutObservation(WEB_MEMBER),
    ];
    const run = await runMemberCloseout({ observations, apply: true });
    if (!run.result.ok) throw new Error("closeout failed");
    const data = run.result.data;
    const reversed = {
      ...data,
      members: [...(data.members ?? [])].reverse(),
      steps: data.steps,
    };
    const view = consumeMemberCloseout(reversed, [API_MEMBER.repoKey, WEB_MEMBER.repoKey]);
    expect(view.violations.some((violation) => violation.includes("member order"))).toBe(true);
    expect(Object.keys(view.members).sort()).toEqual(
      [API_MEMBER.repoKey, WEB_MEMBER.repoKey].sort(),
    );
  });

  test("a member missing a declared field is a violation, never defaulted", () => {
    const view = consumeMemberCloseout({
      steps: [],
      members: [
        { repoKey: API_MEMBER.repoKey, branch: API_MEMBER.branch },
      ] as unknown as readonly CloseoutMemberReport[],
    });
    expect(view.violations.some((violation) => violation.includes("missing"))).toBe(true);
  });
});

describe("TC-XCTR-005 closed vocabularies and bounds are exported once", () => {
  test("the member vocabularies are the pinned closed sets", () => {
    expect([...VERIFY_GATES_DEFINITION_OF_DONE_STATUSES]).toEqual([
      "green",
      "blocked",
      "incomplete",
    ]);
    expect([...VERIFY_GATES_CI_READINGS]).toEqual(["pass", "fail", "unavailable", "absent"]);
    expect([...VERIFY_GATES_MEMBER_VERDICTS]).toEqual(["pass", "fail", "unknown"]);
    expect([...VERIFY_GATES_REVIEW_VERDICTS]).toEqual(["pass", "fail", "unreviewed"]);
    expect([...VERIFY_GATES_REVIEW_OBSERVATION_VERDICTS]).toEqual(["pass", "fail"]);
    expect([...CLOSEOUT_MEMBER_CLEANUP_PLAN_OUTCOMES]).toEqual([
      "would-apply",
      "satisfied",
      "would-refuse",
      "skipped-gap",
    ]);
    expect([...CLOSEOUT_MEMBER_CLEANUP_APPLY_OUTCOMES]).toEqual([
      "applied",
      "satisfied",
      "refused",
      "skipped-gap",
    ]);
    expect([...CLOSEOUT_MEMBER_ISSUE_PLAN_OUTCOMES]).toEqual([
      "would-apply",
      "satisfied",
      "skipped-noop",
      "skipped-gap",
    ]);
    expect([...CLOSEOUT_MEMBER_ISSUE_APPLY_OUTCOMES]).toEqual([
      "applied",
      "satisfied",
      "skipped-noop",
      "skipped-gap",
    ]);
  });

  test("the member bounds are the pinned numbers with one shared member cap", () => {
    expect(PLAN_MAX_MEMBERS).toBe(8);
    expect(PLAN_MAX_MEMBER_DEPENDS_ON).toBe(8);
    expect(PLAN_MAX_MEMBER_GATES).toBe(16);
    expect(PLAN_MAX_MEMBER_GATE_CHARS).toBe(64);
    expect(VERIFY_GATES_MAX_MEMBERS).toBe(8);
    expect(CLOSEOUT_MAX_MEMBERS).toBe(8);
    expect(PLAN_MAX_MEMBERS).toBe(VERIFY_GATES_MAX_MEMBERS);
    expect(PLAN_MAX_MEMBERS).toBe(CLOSEOUT_MAX_MEMBERS);
  });

  test("the member ref is the only identity extension, bounded by QUEUE_MAX_REF_CHARS", () => {
    expect(QUEUE_MEMBER_REF_SEPARATOR).toBe("@");
    expect(QUEUE_MAX_REF_CHARS).toBe(64);
    const changeRef = canonicalChangeRef(CHANGE_REF) ?? CHANGE_REF;
    const repoKey = `${"a".repeat(48)}-0123abcd`;
    const fit = `${changeRef}@${repoKey}`;
    expect(fit.length).toBe(QUEUE_MAX_REF_CHARS);
    expect(parseMemberRef(fit)?.repoKey).toBe(repoKey);
    expect(parseMemberRef(`${fit}a`)).toBeUndefined();

    const declarations = contractFiles().flatMap((text) =>
      [...text.matchAll(/export const ([A-Z][A-Z0-9_]*) =/gu)]
        .map((match) => match[1] as string)
        .filter((name) => name.includes("MEMBER_REF") || name === "QUEUE_MAX_REF_CHARS"),
    );
    expect(declarations.sort()).toEqual(["QUEUE_MAX_REF_CHARS", "QUEUE_MEMBER_REF_SEPARATOR"]);
  });
});

describe("TC-XCTR-007 identity reuse and the distinct report types", () => {
  const baseline = JSON.parse(
    readFileSync(join(ROOT, "tests/fixtures/events/error-table-baseline.json"), "utf8"),
  ) as { readonly rows: readonly string[] };

  const entries = ERROR_TABLE as readonly ErrorTableEntry[];

  test("the error table equals the pre-change snapshot exactly (count and membership)", () => {
    const events = entries.filter((entry) => entry.domainKind === "events");
    expect(events.map((entry) => entry.code).sort()).toEqual([
      "events.taxonomy-unavailable",
      "events.topic-unknown",
      "events.verb-unknown",
    ]);
    const preChange = [
      ...baseline.rows.map((row) => JSON.parse(row) as Record<string, unknown>),
      ...events,
    ];
    expect(entries).toHaveLength(preChange.length);
    expect(entries.map((entry) => entry.code).sort()).toEqual(
      preChange.map((row) => String(row.code)).sort(),
    );
    for (const row of preChange) {
      expect(entries.find((entry) => entry.code === String(row.code))).toEqual(row);
    }
  });

  test("the domain-kind set is unchanged", () => {
    const preChangeKinds = new Set(
      baseline.rows
        .map((row) => (JSON.parse(row) as { readonly domainKind: string }).domainKind)
        .filter((kind) => kind !== "fallback"),
    );
    expect([...DOMAIN_KINDS].sort()).toEqual([...preChangeKinds, "events"].sort());
    expect(DOMAIN_KINDS).toHaveLength(preChangeKinds.size + 1);
  });

  test("no member-specific identity string is invented in the contracts", () => {
    const forbidden = [
      /"review\.(?!verdict\b)[a-z]/u,
      /"member\.[a-z]/u,
      /"gates\.member/u,
      /"dod\.[a-z]/u,
      /"xrep\.[a-z]/u,
      /"cross-repository\.[a-z]/u,
    ];
    for (const text of contractFiles()) {
      for (const pattern of forbidden) expect(text).not.toMatch(pattern);
    }
  });

  test("the ledger projection contract: the member record is never a ledger record", async () => {
    const fixture = makeAuditStore("gh310-contract-projection");
    try {
      const runtime = memberGatesRuntime(twoMemberGatesWorld());
      const gates = runtime.gates;
      if (gates === undefined) throw new Error("missing gates runtime");
      const captured: { readonly gates: readonly { readonly member?: string }[] }[] = [];
      const capturing = await runVerify(
        {
          ...runtime,
          gates: {
            ...gates,
            appendVerification: (record) => {
              captured.push(record);
              return { ok: true as const };
            },
          },
        },
        ["gates", CHANGE_REF],
      );
      expect(capturing.exitCode).toBe(0);
      const projected = captured[0];
      if (projected === undefined) throw new Error("the handler must append one record");
      for (const gate of projected.gates) expect(gate.member).toBeUndefined();

      // The projected record is accepted and reads back non-torn.
      const accepted = appendMergeGateVerification(fixture.store, {
        record: projected as never,
        fenceToken: "fixture-gh310-contract",
      });
      expect(accepted.ok).toBe(true);
      const read = readMergeGateVerifications(fixture.store, CHANGE_REF);
      expect(read.ok).toBe(true);

      // An unprojected record is refused, so the shape cannot be asserted valid.
      const unprojected = {
        ...projected,
        gates: projected.gates.map((gate) => ({ ...gate, member: API_MEMBER.repoKey })),
      };
      const refused = appendMergeGateVerification(fixture.store, {
        record: unprojected as never,
        fenceToken: "fixture-gh310-contract",
      });
      expect(refused.ok).toBe(false);
      if (refused.ok) return;
      expect(refused.error.code).toBe("state.store.torn");
      expect(refused.error.consequence).toBe("not_landed");
      const afterRefusal = readMergeGateVerifications(fixture.store, CHANGE_REF);
      expect(afterRefusal.ok).toBe(false);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("the emitted union is discriminated by definitionOfDone alone", async () => {
    const member = await runMemberGates(twoMemberGatesWorld());
    const memberData = (parseJson(member.stdout) as { readonly data: Record<string, unknown> })
      .data;
    expect(memberData).toHaveProperty("definitionOfDone");
    expect(memberData.overall === "pass" || memberData.overall === "fail").toBe(true);

    const memberless = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
    const memberlessData = (
      parseJson(memberless.stdout) as {
        readonly data: Record<string, unknown>;
      }
    ).data;
    expect(memberlessData).not.toHaveProperty("definitionOfDone");
    expect(memberlessData.overall).toBe("pass");
    for (const key of MEMBER_KEYS.slice(1)) {
      expect(memberless.stdout).not.toContain(key);
    }
  });
});
