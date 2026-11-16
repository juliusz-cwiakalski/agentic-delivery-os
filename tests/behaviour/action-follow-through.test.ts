/**
 * TC-ACTION-022/023 — the registry as the follow-through producer: the R4+
 * ceremony pass assigns verdicts from artifact evidence (never an owner claim),
 * and the retro report fold gains its registry reader with provenance inside the
 * delivered `followThrough[]` and no new top-level key (AC-F7-1, DEC-10, RSK-1).
 */
import { describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import {
  RETRO_REPORT_SCHEMA,
  type RetroFollowThroughEntry,
} from "../../packages/core/src/contracts/index";
import { ceremonyFollowThroughItems } from "../../packages/core/src/domain/ceremony-builtins";
import {
  type ActionArtifactVerdict,
  retroActionCeremonyFacts,
} from "../../packages/core/src/domain/ceremony-retro";
import { reportRetro } from "../../packages/core/src/domain/retro";
import { readActionRegistry } from "../../packages/core/src/state/action-registry";
import { conformingDraft } from "../fixtures/action/builders";
import { FILING_MS } from "../fixtures/action/clock";
import { actionSnapshot, fileAction } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";
import {
  auditOutcome,
  makeRetroDir,
  reportDeps,
  transitionRecord,
} from "../fixtures/retro/harness";

const oracle = (
  verdicts: Readonly<Record<string, ActionArtifactVerdict>>,
): ((artifactRef: string) => ActionArtifactVerdict) => {
  return (artifactRef) => verdicts[artifactRef] ?? "unresolvable";
};

describe("TC-ACTION-022 artifact evidence governs the ceremony verdicts", () => {
  const actions = [
    { actionId: "action-applied", verificationArtifact: "artifact:applied" },
    { actionId: "action-partial", verificationArtifact: "artifact:partial" },
    { actionId: "action-violated", verificationArtifact: "artifact:violated" },
    { actionId: "action-rot", verificationArtifact: "artifact:rot" },
  ];

  test("the verdicts come from the artifact oracle and no verdict lacks an artifact", () => {
    const facts = retroActionCeremonyFacts(
      actions,
      oracle({
        "artifact:applied": "applied",
        "artifact:partial": "partial",
        "artifact:violated": "violated-with-consequence",
      }),
    ) as { readonly retroRegistry: Readonly<Record<string, unknown>> };
    const items = ceremonyFollowThroughItems(facts as unknown as Readonly<Record<string, unknown>>);
    const byItem = new Map(items.map((item) => [item.item, item]));
    expect(byItem.get("action-applied")?.verdict).toBe("applied");
    expect(byItem.get("action-partial")?.verdict).toBe("partial");
    expect(byItem.get("action-violated")?.verdict).toBe("violated-with-consequence");
    expect(byItem.get("action-rot")?.verdict).toBe("unverified");
    for (const item of items) {
      expect(item.verificationArtifact ?? item.evidenceRef).toBeTruthy();
    }
  });

  test("an owner claim that contradicts a failed artifact cannot yield applied", () => {
    const facts = {
      retroRegistry: {
        evidenceRefs: ["artifact:failed"],
        openActions: [
          {
            item: "action-claimed-applied",
            verificationArtifact: "artifact:failed",
            verdict: "violated-with-consequence",
            ownerClaim: "applied",
          },
        ],
      },
    };
    const [item] = ceremonyFollowThroughItems(facts);
    expect(item?.verdict).toBe("violated-with-consequence");
    expect(item?.verdict).not.toBe("applied");
  });

  test("artifact rot degrades to unverified, never fabricated", () => {
    const facts = retroActionCeremonyFacts(actions, () => "unresolvable");
    const items = ceremonyFollowThroughItems(facts as unknown as Readonly<Record<string, unknown>>);
    expect(items.every((item) => item.verdict === "unverified")).toBe(true);
  });
});

describe("TC-ACTION-023 the retro report fold gains its producer", () => {
  test("registry entries carry provenance inside the four-key fold", () => {
    const fixture = makeRetroDir("action-report-fold");
    try {
      expect(
        fileAction(
          fixture.store,
          conformingDraft({ verificationArtifact: "artifact:report-verified" }),
          { actionId: "action-verified", filedAt: FILING_MS },
        ).ok,
      ).toBe(true);
      expect(
        fileAction(
          fixture.store,
          conformingDraft({ verificationArtifact: "artifact:report-unknown" }),
          { actionId: "action-unknown", filedAt: FILING_MS },
        ).ok,
      ).toBe(true);
      const snapshot = actionSnapshot(fixture.store);
      const entries = snapshot.actions.map((action) => ({
        action: action.actionId,
        artifactRef: action.verificationArtifact,
      }));
      const outcome = reportRetro(
        reportDeps(fixture, {
          readFollowThrough: () => entries,
          verifyArtifact: (ref) => ref === "artifact:report-verified",
        }),
      );
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      const data = outcome.data as Record<string, unknown>;
      expect(Object.keys(data).sort()).toEqual([
        "evidenceRefs",
        "findings",
        "followThrough",
        "level",
      ]);
      const fold = data.followThrough as readonly RetroFollowThroughEntry[];
      expect(fold.map((entry) => entry.action)).toEqual(["action-unknown", "action-verified"]);
      expect(fold.find((entry) => entry.action === "action-verified")).toEqual({
        action: "action-verified",
        verdict: "verified",
        artifactRef: "artifact:report-verified",
        provenance: "registry",
      });
      expect(fold.find((entry) => entry.action === "action-unknown")?.verdict).toBe("unverified");
      expect(RETRO_REPORT_SCHEMA).toBe("delivery.retro.report.v1");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("the delivered injected-reader case is preserved and no entry is invented", () => {
    const fixture = makeRetroDir("action-report-injected");
    try {
      transitionRecord({ changeRef: "GH-232" });
      fixture.scriptDeliveryChanges([
        { changeRef: "GH-232", transitions: [transitionRecord({ changeRef: "GH-232" })] },
      ]);
      fixture.scriptAudit(auditOutcome({}));
      const outcome = reportRetro(reportDeps(fixture));
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect((outcome.data as { followThrough: unknown[] }).followThrough).toEqual([]);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test("a verified-empty registry is an explicit success with an empty fold", () => {
    const fixture = makeRetroDir("action-report-empty");
    try {
      const outcome = reportRetro(reportDeps(fixture, { readFollowThrough: () => [] }));
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect((outcome.data as { followThrough: unknown[] }).followThrough).toEqual([]);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
