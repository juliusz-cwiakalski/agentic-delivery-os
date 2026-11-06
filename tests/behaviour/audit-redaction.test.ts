/**
 * TC-GH223-031 (edge-registered secrets never reach any record field) and
 * TC-GH223-032 (behaviour half: one redaction chokepoint covers all fields).
 */
import { describe, expect, test } from "bun:test";
import { auditRecordsOf, makeAuditStore, removeRoot } from "../fixtures/state/harness";
import { IDENTITY_VARIABLE, programFor, runAudited } from "./audit-run-support";

const allRecordText = (store: Parameters<typeof auditRecordsOf>[0]): string =>
  auditRecordsOf(store)
    .map((record) => JSON.stringify(record))
    .join("\n");

describe("TC-GH223-031 edge-registered secrets in arguments", () => {
  test("registered secrets are redacted on success, failure, and broken invocations", async () => {
    const fixture = makeAuditStore("redaction-arguments");
    try {
      const secrets = ["planted-fake-secret-0001", "planted-fake-secret-0002"];
      const success = await runAudited(fixture, {
        argv: ["--json", "status", "--name", "planted-fake-secret-0001"],
        program: programFor("success"),
        runId: "run-secret-success",
        secrets,
      });
      const failure = await runAudited(fixture, {
        argv: ["--json", "status", "planted-fake-secret-0002"],
        program: programFor("classified-user"),
        runId: "run-secret-failure",
        secrets,
      });
      const broken = await runAudited(fixture, {
        argv: ["--json", "planted-fake-secret-0001"],
        program: programFor("success"),
        runId: "run-secret-broken",
        secrets,
      });
      for (const run of [success, failure, broken]) {
        expect(run.stdout + run.stderr).not.toContain("planted-fake-secret-0001");
        expect(run.stdout + run.stderr).not.toContain("planted-fake-secret-0002");
      }

      const text = allRecordText(fixture.store);
      for (const secret of secrets) expect(text).not.toContain(secret);
      const invocation = auditRecordsOf(fixture.store).find(
        (record) =>
          record.kind === "audit.invocation" &&
          (record.payload as Record<string, unknown>).runId === "run-secret-success",
      );
      const payload = invocation?.payload as Record<string, unknown>;
      expect(payload.arguments).toEqual(["--json", "status", "--name", "[redacted]"]);
      expect(payload.command).toBe("status");
      const brokenPayload = auditRecordsOf(fixture.store).find(
        (record) =>
          record.kind === "audit.invocation" &&
          (record.payload as Record<string, unknown>).runId === "run-secret-broken",
      )?.payload as Record<string, unknown>;
      expect(brokenPayload.command).toBe("[redacted]");
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("an unregistered canary survives verbatim (the guarantee is scoped)", async () => {
    const fixture = makeAuditStore("redaction-canary");
    try {
      await runAudited(fixture, {
        argv: ["--json", "status", "planted-fake-unregistered"],
        program: programFor("success"),
        runId: "run-canary",
        secrets: ["planted-fake-registered"],
      });
      const invocation = auditRecordsOf(fixture.store).find(
        (record) =>
          record.kind === "audit.invocation" &&
          (record.payload as Record<string, unknown>).runId === "run-canary",
      );
      expect(((invocation?.payload ?? {}) as Record<string, unknown>).arguments).toEqual([
        "--json",
        "status",
        "planted-fake-unregistered",
      ]);
      expect(JSON.stringify(invocation)).toContain("planted-fake-unregistered");
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-032 one redaction chokepoint covers every record field", () => {
  test("an identity value that is itself a registered secret is redacted", async () => {
    const fixture = makeAuditStore("redaction-identity");
    try {
      const secret = "planted-fake-identity-secret";
      await runAudited(fixture, {
        argv: ["--json", "status", "--name", secret],
        program: programFor("success"),
        runId: "run-secret-identity",
        secrets: [secret],
        environment: { [IDENTITY_VARIABLE]: secret },
      });
      const text = allRecordText(fixture.store);
      expect(text).not.toContain(secret);
      const invocation = auditRecordsOf(fixture.store).find(
        (record) =>
          record.kind === "audit.invocation" &&
          (record.payload as Record<string, unknown>).runId === "run-secret-identity",
      );
      const payload = invocation?.payload as Record<string, unknown>;
      expect(payload.agentIdentity).toEqual({ kind: "claimed", value: "[redacted]" });
      expect(payload.arguments).toEqual(["--json", "status", "--name", "[redacted]"]);
      expect(JSON.stringify(payload)).toContain("[redacted]");
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("reservations carry no arguments, outcome, or identity to redact", async () => {
    const fixture = makeAuditStore("redaction-reservation");
    try {
      await runAudited(fixture, {
        argv: ["--json", "status", "--name", "planted-fake-reservation"],
        program: programFor("classified-user"),
        runId: "run-secret-reservation",
        secrets: ["planted-fake-reservation"],
        environment: { [IDENTITY_VARIABLE]: "pm-lane-7" },
      });
      const reservation = auditRecordsOf(fixture.store).find(
        (record) => record.kind === "audit.reservation",
      );
      expect(Object.keys(reservation?.payload ?? {})).toEqual([
        "schemaId",
        "auditSeq",
        "runId",
        "chainValue",
      ]);
      expect(JSON.stringify(reservation)).not.toContain("planted-fake-reservation");
      expect(JSON.stringify(reservation)).not.toContain("pm-lane-7");
    } finally {
      removeRoot(fixture.root);
    }
  });
});
