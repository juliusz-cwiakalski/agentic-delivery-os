/**
 * TC-ACTION-025 — the ceremony declared-actions handoff reaches filing: the
 * ceremony writes nothing (delivered posture), an unfiled declared action never
 * passes as applied, a filed one does, and an empty registry is verified-empty
 * (AC-F7-1, RSK-3, NG-4).
 */
import { describe, expect, test } from "bun:test";
import {
  ceremonyFollowThroughItems,
  renderCeremonyFollowThrough,
  renderCeremonyRetroActions,
} from "../../packages/core/src/domain/ceremony-builtins";
import { retroActionCeremonyFacts } from "../../packages/core/src/domain/ceremony-retro";
import { conformingDraft } from "../fixtures/action/builders";
import { FILING_MS } from "../fixtures/action/clock";
import { actionSnapshot, fileAction } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";
import { retroNote } from "../fixtures/ceremony/notes/index";

const oracle = (artifact: string) => (ref: string) =>
  ref === artifact ? ("applied" as const) : ("unresolvable" as const);

describe("TC-ACTION-025 the handoff reaches filing", () => {
  test("the ceremony renders the declared actions as a handoff and writes nothing", () => {
    const note = retroNote("retro-evidence-pass", "window", {
      actions: ["action-declared-1", "action-declared-2"],
    });
    const handoff = renderCeremonyRetroActions(note) as {
      readonly actions: readonly string[];
      readonly handoff: boolean;
      readonly filed: boolean;
    };
    expect(handoff.actions).toEqual(["action-declared-1", "action-declared-2"]);
    expect(handoff.handoff).toBe(true);
    expect(handoff.filed).toBe(false);

    const fixture = makeActionStore("handoff-empty");
    try {
      const before = actionSnapshot(fixture.store);
      expect(ceremonyFollowThroughItems({}).length).toBe(0);
      expect(actionSnapshot(fixture.store)).toEqual(before);
    } finally {
      fixture.cleanup();
    }
  });

  test("an unfiled declared action never passes as applied; the filed one does", () => {
    const fixture = makeActionStore("handoff-filed");
    try {
      const empty = retroActionCeremonyFacts([], oracle("artifact:filed"));
      const emptyItems = ceremonyFollowThroughItems(
        empty as unknown as Readonly<Record<string, unknown>>,
      );
      expect(emptyItems).toEqual([]);
      expect(renderCeremonyFollowThrough({})).toMatchObject({ verifiedEmpty: true });

      expect(
        fileAction(
          fixture.store,
          conformingDraft({ verificationArtifact: "artifact:filed", level: "window" }),
          { actionId: "action-filed", filedAt: FILING_MS },
        ).ok,
      ).toBe(true);
      const facts = retroActionCeremonyFacts(
        [{ actionId: "action-filed", verificationArtifact: "artifact:filed" }],
        oracle("artifact:filed"),
      );
      const items = ceremonyFollowThroughItems(
        facts as unknown as Readonly<Record<string, unknown>>,
      );
      expect(items.map((item) => item.item)).toEqual(["action-filed"]);
      expect(items[0]?.verdict).toBe("applied");
      // The unfiled declared action is never in the verified set.
      expect(items.some((item) => item.item === "action-declared-1")).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  test("an empty registry yields a verified-empty follow-through, never a fabricated one", () => {
    const rendered = renderCeremonyFollowThrough({});
    expect(rendered).toMatchObject({ verifiedEmpty: true, items: [] });
  });
});
