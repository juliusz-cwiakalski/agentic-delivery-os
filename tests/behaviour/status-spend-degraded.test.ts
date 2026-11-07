/**
 * TC-SPEND-028 — the digest's verified-empty and failed-read projections: an
 * observed absence (never a zero-spend claim) and an in-band state-unreadable
 * degradation at exit 0, while the command on the same store still classifies.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { aggregateStatus, renderStatusHuman } from "../../packages/core/src/domain/index";
import {
  ledgerPath,
  makeIdentity,
  makeSessionRecord,
  makeTempRoot,
  openStore,
  removeRoot,
  runSpendCli,
  SPEND_REF,
  seedSpend,
  spendRuntimeOver,
  tokens,
} from "../fixtures/spend/harness";
import {
  baseFacts,
  failedSpend,
  runStatusCli,
  statusRuntime,
  verifiedEmptySpend,
} from "../fixtures/status/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

describe("TC-SPEND-028 digest verified-empty and failed-read projections", () => {
  test("verified-empty is observed with an absence-of-capture line, never a zero-spend claim", () => {
    const digest = aggregateStatus(baseFacts({ spend: verifiedEmptySpend() }));
    const section = digest.sections[7];
    if (section === undefined) throw new Error("spend section missing");
    expect(section.state).toBe("observed");
    expect(section.evidence.sources).toEqual([{ source: "state-log", outcome: "observed-empty" }]);
    expect(section.evidence.reasons).toEqual(["observed-empty"]);
    expect(section.counts).toEqual({ observed: 0, unknown: 0, total: 0, omitted: 0 });
    const human = renderStatusHuman(digest, SYNTHETIC_BRAND);
    expect(human).toContain("no captured telemetry (absence of capture)");
    for (const forbidden of ["spend: 0", "no spend", "zero spend"]) {
      expect(human.toLowerCase()).not.toContain(forbidden);
    }
  });

  test("a failed read degrades in band at exit 0 with state-unreadable", async () => {
    const facts = baseFacts({ spend: failedSpend("state.store.torn") });
    const run = await runStatusCli(["--json", "status"], statusRuntime(facts));
    expect(run.exitCode).toBe(0);
    const envelope = JSON.parse(run.stdout) as unknown;
    if (!isRecord(envelope) || !isRecord(envelope.data)) throw new Error("envelope shape");
    const sections = envelope.data.sections;
    if (!Array.isArray(sections)) throw new Error("sections missing");
    expect(sections).toHaveLength(9);
    const spend = sections[7];
    if (!isRecord(spend)) throw new Error("spend section missing");
    expect(spend.state).toBe("unknown");
    const evidence = spend.evidence;
    if (!isRecord(evidence) || !Array.isArray(evidence.sources)) throw new Error("evidence");
    expect(evidence.reasons).toEqual(["state-unreadable"]);
    expect(evidence.sources).toEqual([
      { source: "state-log", outcome: "failed", failureCode: "state.store.torn" },
    ]);
    const projection = spend.spend;
    if (!isRecord(projection)) throw new Error("projection missing");
    expect(projection.failureCode).toBe("state.store.torn");
    expect(String(renderStatusHuman(aggregateStatus(facts), SYNTHETIC_BRAND))).toContain(
      "spend      unknown  state-unreadable (state.store.torn)",
    );
  });

  test("the command on the same damaged store classifies at exit 2 while the digest degrades", async () => {
    const root = makeTempRoot("gh236-status-degraded");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seedSpend(store, {
        records: [makeSessionRecord({ runId: "run-R1", tokens: tokens({ input: 10 }) })],
      });
      const text = readFileSync(ledgerPath(identity), "utf8");
      const lines = text.split("\n");
      lines[0] = "{not-framed";
      writeFileSync(ledgerPath(identity), lines.join("\n"));

      const command = await runSpendCli(
        ["--json", "spend", "--ref", SPEND_REF],
        spendRuntimeOver(store),
      );
      expect(command.exitCode).toBe(2);
      const envelope = JSON.parse(command.stdout) as unknown;
      if (!isRecord(envelope) || !isRecord(envelope.error)) throw new Error("error missing");
      expect(envelope.error.code).toBe("state.store.torn");
    } finally {
      removeRoot(root);
    }
  });

  test("no placeholder reappears and the spend section adds zero actionable items", () => {
    const empty = aggregateStatus(baseFacts({ spend: verifiedEmptySpend() }));
    const failed = aggregateStatus(baseFacts({ spend: failedSpend() }));
    expect(failed.summary.placeholderSectionCount).toBe(0);
    expect(failed.summary.actionable).toBe(empty.summary.actionable);
    const spend = failed.sections[7];
    if (spend === undefined) throw new Error("spend section missing");
    expect(spend.items ?? []).toEqual([]);
    expect(spend.findings ?? []).toEqual([]);
    expect(JSON.stringify(failed)).not.toContain("spend summary arrives with M1-S19");
    expect(JSON.stringify(failed)).not.toContain("spend-summary");
  });

  test("both renders are deterministic", () => {
    for (const facts of [
      baseFacts({ spend: verifiedEmptySpend() }),
      baseFacts({ spend: failedSpend() }),
    ]) {
      const first = renderStatusHuman(aggregateStatus(facts), SYNTHETIC_BRAND);
      const second = renderStatusHuman(aggregateStatus(facts), SYNTHETIC_BRAND);
      expect(second).toBe(first);
    }
  });
});
