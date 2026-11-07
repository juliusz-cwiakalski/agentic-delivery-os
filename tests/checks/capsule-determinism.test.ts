/** TC-CAP-054 — identical injected facts produce byte-identical output. */
import { describe, expect, test } from "bun:test";
import { candidateYaml, runPromotionCloseout } from "../fixtures/capsule/promotion";

const runOnce = () =>
  runPromotionCloseout({
    candidates: {
      "a.yaml": candidateYaml({ id: "lesson-one", statement: "Deterministic lesson." }),
      "b.yaml": candidateYaml({ id: "fact-one", class: "fact", statement: "Deterministic fact." }),
    },
  });

describe("TC-CAP-054 determinism", () => {
  test("two fresh runs over identical facts render identical data and capsule payloads", async () => {
    const first = await runOnce();
    const firstData = JSON.stringify(first.data);
    const firstEvents = JSON.stringify(
      first.capsule.read("GH-183").ok
        ? (first.capsule.read("GH-183") as { events: unknown }).events
        : [],
    );
    first.cleanup();
    const second = await runOnce();
    expect(JSON.stringify(second.data)).toBe(firstData);
    expect(
      JSON.stringify(
        second.capsule.read("GH-183").ok
          ? (second.capsule.read("GH-183") as { events: unknown }).events
          : [],
      ),
    ).toBe(firstEvents);
    second.cleanup();
  });
});
