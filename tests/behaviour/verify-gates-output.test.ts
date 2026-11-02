/** TC-VGATES-040..046, 052, 063 — output, redaction, exit matrix, replay. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createVerifyCommandDefinition } from "../../packages/cli/src/commands/verify";
import {
  evaluateVerifyGates,
  renderVerifyGatesFailureSummary,
} from "../../packages/core/src/domain/index";
import {
  baseFacts,
  CANARY,
  clone,
  EXPECTED_JOBS,
  lifecycle,
  request,
  run,
  withReadError,
  workItem,
} from "../fixtures/verify-gates/cases/facts";
import {
  combinedRuntime,
  runVerify,
  SYNTHETIC_BRAND,
} from "../fixtures/verify-gates/cases/harness";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/verify-gates/golden/verify-change-human.txt");

const redFacts = () => {
  const facts = clone(baseFacts());
  facts.checkRuns = {
    ok: true,
    value: {
      items: EXPECTED_JOBS.map((name) =>
        run(name, name === EXPECTED_JOBS[0] ? "failed" : "succeeded"),
      ),
      pageItemCount: 23,
    },
  };
  return facts;
};

const summaryOf = (envelope: Record<string, unknown> | undefined): string =>
  (envelope?.error as { summary?: string } | undefined)?.summary ?? "";

const summaryGrammarViolations = (summary: string): string[] => {
  const violations: string[] = [];
  const lines = summary.split("\n");
  if (lines.length !== 6) violations.push(`expected six lines, got ${lines.length}`);
  if (!/^result=(fail|unknown); gates=\d\/5 passed, \d failed, \d unknown$/.test(lines[0] ?? "")) {
    violations.push("header grammar");
  }
  for (const [index, line] of lines.slice(1).entries()) {
    if (
      !/^\S+ (pass|fail|unknown) reason=\S+ source=\S+ ref=\S+ counts=\S+ names=\S.*$/.test(line)
    ) {
      violations.push(`gate line ${index + 2}: grammar`);
      continue;
    }
    const segments = / counts=(\S*) names=(.*)$/.exec(line);
    const counts = segments?.[1];
    const names = segments?.[2];
    if (counts === undefined || counts.length === 0) {
      violations.push(`gate line ${index + 2}: bare counts`);
    } else if (counts !== "-") {
      for (const token of counts.split(",")) {
        if (!/^[A-Za-z]+=\d+$/.test(token)) {
          violations.push(`gate line ${index + 2}: zero alias or malformed count ${token}`);
        }
      }
    }
    if (names === undefined || names.length === 0) {
      violations.push(`gate line ${index + 2}: missing names segment`);
    } else if (names !== "-") {
      for (const token of names.split(" ")) {
        const match = /^([a-z-]+)=(.+?)(?:\+(\d+))?$/.exec(token);
        if (match?.[2] === undefined) {
          violations.push(`gate line ${index + 2}: malformed name list ${token}`);
          continue;
        }
        try {
          const values: unknown = JSON.parse(match[2]);
          if (!Array.isArray(values)) {
            violations.push(`gate line ${index + 2}: name list is not an array`);
          }
        } catch {
          violations.push(`gate line ${index + 2}: name list is not JSON`);
        }
      }
    }
  }
  return violations;
};

describe("TC-VGATES-042 failure summary grammar", () => {
  test("six lines, both segments present, deterministic replay", async () => {
    const first = await runVerify(combinedRuntime({ facts: redFacts() }), ["gates", "GH-178"]);
    const second = await runVerify(combinedRuntime({ facts: redFacts() }), ["gates", "GH-178"]);
    expect(first.exitCode).toBe(1);
    expect(first.envelope?.data).toBeUndefined();
    expect(summaryOf(first.envelope)).toBe(summaryOf(second.envelope));
    const lines = summaryOf(first.envelope).split("\n");
    expect(lines).toHaveLength(6);
    expect(lines[0]).toMatch(/^result=fail; gates=\d\/5 passed, \d failed, \d unknown$/);
    for (const line of lines.slice(1)) {
      expect(line).toContain(" counts=");
      expect(line).toMatch(/ counts=.* names=/);
    }
    expect(summaryOf(first.envelope)).not.toContain(CANARY);
  });

  test("a no-usable-detail squash line renders counts=- names=-", async () => {
    const facts = clone(baseFacts());
    facts.deliveryRequestDetail = { ok: false, reason: "not-found" };
    facts.checkRuns = { ok: false, reason: "not-attempted" };
    const result = await runVerify(combinedRuntime({ facts }), ["gates", "GH-178"]);
    const squashLine = summaryOf(result.envelope)
      .split("\n")
      .find((line) => line.startsWith("squash-preflight "));
    expect(squashLine).toContain("counts=- names=-");
  });
});

describe("TC-VGATES-043/044/045 human and machine success", () => {
  test("human success is six lines without canaries", async () => {
    const result = await runVerify(combinedRuntime(), ["gates", "GH-178"], { json: false });
    const lines = result.stdout.trimEnd().split("\n");
    expect(lines).toHaveLength(6);
    expect(lines.join("\n")).not.toContain(CANARY);
    expect(result.stderr).not.toContain(CANARY);
  });

  test("machine success is one envelope with the full report", async () => {
    const result = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
    expect(result.stdout.trim().split("\n").length).toBeGreaterThan(5);
    expect(result.envelope?.schemaVersion).toBe("delivery.result.v1");
    const data = result.envelope?.data as Record<string, unknown>;
    expect(data.overall).toBe("pass");
    expect((data.gates as unknown[]).length).toBe(5);
    expect(JSON.stringify(result.envelope).length).toBeLessThanOrEqual(65536);
  });
});

describe("TC-VGATES-046 exit and identity matrix", () => {
  test("all-pass exits 0; a fail exits 1 with verify.gates.failed", async () => {
    expect((await runVerify(combinedRuntime(), ["gates", "GH-178"])).exitCode).toBe(0);
    const failed = await runVerify(combinedRuntime({ facts: redFacts() }), ["gates", "GH-178"]);
    expect(failed.exitCode).toBe(1);
    expect((failed.envelope?.error as { code?: string } | undefined)?.code).toBe(
      "verify.gates.failed",
    );
  });

  test("an unclassified unknown uses verify.gates.unavailable exit 2", async () => {
    const facts = clone(baseFacts());
    facts.checkRuns = { ok: false, reason: "not-found" };
    const result = await runVerify(combinedRuntime({ facts }), ["gates", "GH-178"]);
    expect(result.exitCode).toBe(2);
    expect((result.envelope?.error as { code?: string } | undefined)?.code).toBe(
      "verify.gates.unavailable",
    );
  });

  test("unknown reuses a classified credential or state identity", async () => {
    const credential = clone(baseFacts());
    credential.openPullRequests = withReadError("credential-unavailable");
    credential.deliveryRequestDetail = withReadError("credential-unavailable");
    credential.checkRuns = withReadError("credential-unavailable");
    credential.workItem = withReadError("credential-unavailable");
    const user = await runVerify(combinedRuntime({ facts: credential }), ["gates", "GH-178"]);
    expect(user.exitCode).toBe(1);
    expect((user.envelope?.error as { code?: string } | undefined)?.code).toBe(
      "config.credential.missing",
    );

    const platform = await runVerify(
      combinedRuntime({ registryFailure: { code: "state.store.torn" } }),
      ["gates", "GH-178"],
    );
    expect(platform.exitCode).toBe(2);
    expect((platform.envelope?.error as { code?: string } | undefined)?.code).toBe(
      "state.store.torn",
    );
  });
});

describe("TC-VGATES-063 verify change bytes and planted secret", () => {
  test("humanText returns undefined for change and the golden bytes are byte-identical", async () => {
    const definition = createVerifyCommandDefinition(combinedRuntime());
    const data = await definition.handler({
      command: "verify",
      flags: {},
      argv: ["verify", "change", "GH-178"],
      positionals: ["change", "GH-178"],
      brand: SYNTHETIC_BRAND,
    });
    expect(
      definition.humanText?.((data as { data: unknown }).data, SYNTHETIC_BRAND),
    ).toBeUndefined();
    const result = await runVerify(combinedRuntime(), ["change", "GH-178"], { json: false });
    const golden = readFileSync(GOLDEN, "utf8");
    expect(golden).toContain('"completedCount": 11,\n      "requiredCount": 11');
    expect(result.stdout).toBe(golden);
    const machine = await runVerify(combinedRuntime(), ["change", "GH-178"]);
    expect(machine.stdout).toContain('"completedCount": 11,\n        "requiredCount": 11');
  });

  test("a JSON-escaping-sensitive secret is redacted on both paths", async () => {
    const secret = 'tok"en\\path\nbreak';
    const facts = clone(baseFacts());
    facts.deliveryRequestDetail = {
      ok: true,
      value: { request: request({ identity: { systemName: "github", entityId: secret } }) },
    };
    facts.openPullRequests = {
      ok: true,
      value: {
        items: [request({ identity: { systemName: "github", entityId: secret } })],
        pageItemCount: 1,
      },
    };
    const gates = await runVerify(combinedRuntime({ facts }), ["gates", "GH-178"], {
      json: false,
      secrets: [secret],
    });
    expect(gates.stdout).not.toContain(secret);
    expect(gates.stdout).not.toContain(JSON.stringify(secret).slice(1, -1));
    expect(gates.stdout).toContain("[redacted]");

    const machine = await runVerify(combinedRuntime({ facts }), ["gates", "GH-178"], {
      secrets: [secret],
    });
    expect(machine.stdout).not.toContain(secret);
    expect(machine.envelope).toBeDefined();

    // Independent expectation: the committed pre-change golden with only the
    // secret-bearing changeRef redacted. It is never recomputed with `redact()`.
    const expected = readFileSync(GOLDEN, "utf8").replace(
      '"changeRef": "GH-178"',
      '"changeRef": "[redacted]"',
    );
    const changeRun = await runVerify(combinedRuntime(), ["change", secret], {
      json: false,
      secrets: [secret],
    });
    expect(changeRun.stdout).toBe(expected);
    expect(changeRun.stdout).not.toContain(secret);
  });
});

describe("TC-VGATES-052 replay is byte-identical", () => {
  test("same facts produce the same report, summary, human text, and exit", async () => {
    const firstHuman = await runVerify(combinedRuntime(), ["gates", "GH-178"], { json: false });
    const secondHuman = await runVerify(combinedRuntime(), ["gates", "GH-178"], { json: false });
    expect(secondHuman).toEqual(firstHuman);
    const firstMachine = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
    const secondMachine = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
    expect(secondMachine).toEqual(firstMachine);
  });
});

describe("TC-VGATES-040/041/042 citation and summary negative controls", () => {
  test("a nine-name list clamps to eight with omitted, and a long observed name clamps to 120", () => {
    const nine = clone(baseFacts());
    nine.workflow = {
      outcome: "read",
      names: Array.from({ length: 9 }, (_, index) => `missing-job-${index}`),
    };
    nine.checkRuns = { ok: true, value: { items: [], pageItemCount: 0 } };
    const nineRecord = evaluateVerifyGates(nine).gates[1];
    const nineList = nineRecord?.citation.names.find((entry) => entry.kind === "missing-jobs");
    expect(nineList?.values).toHaveLength(8);
    expect(nineList?.omitted).toBe(1);

    const longName = "z".repeat(130);
    const withLong = clone(baseFacts());
    withLong.checkRuns = {
      ok: true,
      value: {
        items: [...EXPECTED_JOBS.map((name) => run(name, "succeeded")), run(longName, "failed")],
        pageItemCount: 24,
      },
    };
    const longRecord = evaluateVerifyGates(withLong).gates[1];
    const failedNames = longRecord?.citation.names.find((entry) => entry.kind === "failed-jobs");
    expect(failedNames?.values).toHaveLength(1);
    expect(failedNames?.values[0]).toHaveLength(120);
  });

  test("an identity ref over the cap clamps in the failure summary", async () => {
    const facts = redFacts();
    const longId = "r".repeat(130);
    const identity = { systemName: "github", entityId: longId };
    facts.deliveryRequestDetail = { ok: true, value: { request: request({ identity }) } };
    facts.openPullRequests = {
      ok: true,
      value: { items: [request({ identity })], pageItemCount: 1 },
    };
    const result = await runVerify(combinedRuntime({ facts }), ["gates", "GH-178"]);
    const squashLine = summaryOf(result.envelope)
      .split("\n")
      .find((line) => line.startsWith("squash-preflight "));
    const ref = / ref=(\S+)/.exec(squashLine ?? "");
    expect(ref?.[1]).toHaveLength(120);
  });

  test("the summary grammar passes real output and rejects zero aliases, bare counts, and omitted segments", async () => {
    const facts = clone(baseFacts());
    facts.deliveryRequestDetail = { ok: false, reason: "not-found" };
    facts.checkRuns = { ok: false, reason: "not-attempted" };
    const result = await runVerify(combinedRuntime({ facts }), ["gates", "GH-178"]);
    const summary = summaryOf(result.envelope);
    expect(summaryGrammarViolations(summary)).toEqual([]);

    expect(summary).toContain("counts=-");
    expect(summaryGrammarViolations(summary.replace("counts=-", "counts=0"))).not.toEqual([]);
    expect(summaryGrammarViolations(summary.replace("counts=-", "counts="))).not.toEqual([]);
    expect(summaryGrammarViolations(summary.replace("names=-", "names="))).not.toEqual([]);
    const firstGateLine = summary.split("\n")[1] ?? "";
    const withoutNames = summary.replace(firstGateLine, firstGateLine.replace(/ names=.*$/, ""));
    expect(summaryGrammarViolations(withoutNames)).not.toEqual([]);
  });

  test("the combined maximum shrinks names but keeps six lines, both segments, and the byte bound", () => {
    const longNames = Array.from(
      { length: 200 },
      (_, index) => `${"x".repeat(110)}${String(index).padStart(10, "0")}`,
    );
    const longPhases = Array.from(
      { length: 11 },
      (_, index) => `${"p".repeat(110)}${String(index).padStart(10, "0")}`,
    );
    const runs = [
      ...longNames.slice(0, 8).map((name) => run(name, "failed")),
      ...longNames.slice(8, 16).map((name) => run(name, "running")),
      ...longNames.slice(16, 24).map((name) => run(name, "succeeded")),
    ];
    const facts = clone(baseFacts());
    facts.workflow = { outcome: "read", names: longNames };
    facts.checkRuns = { ok: true, value: { items: runs, pageItemCount: runs.length } };
    facts.lifecycle.evaluation = lifecycle({
      variant: "full",
      requiredPhases: longPhases,
      completedPhases: [],
      missingPhases: longPhases,
      declaration: { requiredCount: 11, completedCount: 0 },
      code: "verify.ledger.incomplete",
    });
    const evaluation = evaluateVerifyGates(facts);
    const summary = renderVerifyGatesFailureSummary(evaluation);
    expect(summary.length).toBeLessThanOrEqual(4096);
    const lines = summary.split("\n");
    expect(lines).toHaveLength(6);
    expect(lines[0]).toMatch(/^result=fail;/);
    for (const [index, gateId] of [
      "lifecycle-finalization",
      "ci-green",
      "push-parity",
      "owner-gate",
      "squash-preflight",
    ].entries()) {
      expect(lines[index + 1]?.startsWith(`${gateId} `)).toBe(true);
    }
    expect(summaryGrammarViolations(summary)).toEqual([]);
  });

  test("raw title, comment, commit, file, and payload canaries never render", async () => {
    const canaries = {
      title: "canary-title-3f9d",
      comment: "canary-comment-3f9d",
      commit: "canary-commit-3f9d",
      file: "canary-file-3f9d",
      payload: "canary-payload-3f9d",
    };
    const facts = redFacts();
    facts.workItem = {
      ok: true,
      value: {
        item: {
          ...workItem(["change"]),
          title: canaries.title,
          identity: { systemName: "github", entityId: canaries.file },
          comments: [{ commentId: "comment-1", authorAccount: "reviewer", body: canaries.comment }],
        },
      },
    };
    const checkRuns = facts.checkRuns;
    if (!checkRuns.ok) throw new Error("expected readable check runs");
    const items = checkRuns.value.items.map((entry, index) =>
      index === 0
        ? {
            ...entry,
            identity: { ...entry.identity, entityId: canaries.payload },
            traceEvidence: [{ evidenceName: "commit", location: canaries.commit }],
          }
        : entry,
    );
    facts.checkRuns = { ok: true, value: { items, pageItemCount: checkRuns.value.pageItemCount } };

    const machine = await runVerify(combinedRuntime({ facts }), ["gates", "GH-178"]);
    const human = await runVerify(combinedRuntime({ facts }), ["gates", "GH-178"], {
      json: false,
    });
    for (const canary of Object.values(canaries)) {
      expect(machine.stdout).not.toContain(canary);
      expect(machine.stderr).not.toContain(canary);
      expect(human.stdout).not.toContain(canary);
      expect(human.stderr).not.toContain(canary);
    }
  });
});
