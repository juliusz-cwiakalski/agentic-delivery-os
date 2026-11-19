/**
 * TC-ENGINE-040/041/042/060..065 — the documentation phase's contract.
 *
 * Every subject is resolved by heading or by a declared marker and asserted as
 * text: the hold/window effect-surface mapping, the corrected lanes-read claim
 * and its declared limitation, the two absences (no window read, no
 * `QueueLane.providerProfile`), the operator guide and its four topics, the six
 * reconciled feature pages, the planning corpus and its restatements, the landed
 * decision record, and the bounded lifecycle prose.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");
const normalized = (text: string): string => text.replace(/\s+/gu, " ").trim();

const page = (name: string): string => read(`doc/spec/features/${name}`);

const section = (text: string, heading: string): string => {
  const start = text.indexOf(heading);
  if (start < 0) throw new Error(`heading not found: ${heading}`);
  const rest = text.slice(start + heading.length);
  const next = rest.search(/\n## /u);
  return rest.slice(0, next < 0 ? rest.length : next);
};

const guideFiles = (): readonly string[] =>
  readdirSync(join(ROOT, "doc/guides"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `doc/guides/${name}`);

const ENGINE_GUIDE = "doc/guides/engine-first-operations.md";

describe("TC-ENGINE-040 the hold and window effect-surface mapping", () => {
  test("both rows are stated with every declared surface and the absent read", () => {
    const peak = page("feature-peak-pausing.md");
    const mapping = normalized(section(peak, "### Effect-surface mapping"));
    expect(mapping.length).toBeGreaterThan(0);
    const lower = mapping.toLowerCase();
    for (const token of [
      "owner hold",
      "admission",
      "queue blocking",
      "status.ownerhold",
      "ownerhold",
    ]) {
      expect(lower, token).toContain(token);
    }
    expect(lower, "peak window").toContain("peak window");
    for (const token of [
      "peak-window",
      "status.laneParks",
      "until",
      "preservation",
      "peakEnforcement",
      "window-scoped spend",
      "stop",
      "parked",
    ]) {
      expect(mapping, token).toContain(token);
    }
    expect(mapping.toLowerCase()).toContain("no read surface");
  });

  test("the composing features name the same surfaces", () => {
    const dispatch = normalized(page("feature-dispatch-engine.md"));
    const daemon = normalized(page("feature-resident-daemon.md"));
    for (const text of [dispatch, daemon]) {
      expect(text).toContain("status.laneParks");
      expect(text).toContain("peak-window");
    }
  });
});

describe("TC-ENGINE-041 the lanes-read over-claim is corrected", () => {
  test("the old claim is gone, the carrying surfaces are named, and the limitation is declared", () => {
    const peak = normalized(page("feature-peak-pausing.md"));
    expect(peak).not.toContain("the lanes read, and the records agree");
    expect(peak).not.toContain("the lanes read carries the nomination");
    for (const token of [
      "attempt history",
      "daemon lane records",
      "status.laneParks",
      "PARKED",
      "spend evidence",
    ]) {
      expect(peak, token).toContain(token);
    }
    expect(peak).toContain("Known limitation");
    expect(peak).toContain("cannot attribute a running lane to a provider profile");
    expect(peak).not.toContain("lanes read carries `providerProfile`");
  });

  test("no reconciled page re-introduces the lanes-nomination claim", () => {
    const pages = [
      "feature-peak-pausing.md",
      "feature-dispatch-engine.md",
      "feature-resident-daemon.md",
      "feature-merge-verify-deploy.md",
      "feature-projects.md",
      "feature-autonomous-delivery.md",
    ];
    expect(pages.length).toBeGreaterThan(0);
    for (const name of pages) {
      expect(normalized(page(name))).not.toContain("lanes read, and the records agree");
    }
  });
});

describe("TC-ENGINE-042 the declared absences hold", () => {
  test("no window/hold read was added and QueueLane carries no providerProfile", () => {
    const queueContracts = read("packages/core/src/contracts/queue.ts");
    const lane = section(queueContracts, "export type QueueLane = {");
    expect(lane.length).toBeGreaterThan(0);
    for (const field of [
      "id",
      "ref",
      "state",
      "reason",
      "lease",
      "leaseScope",
      "leaseHolder",
      "until",
      "restarts",
      "amplification",
      "amplificationWarning",
      "weightClass",
    ]) {
      expect(lane, field).toContain(field);
    }
    expect(lane).not.toContain("providerProfile");
    // No new window/hold verb exists in the prompt-required command inventory.
    const inventory = read("packages/cli/src/help/prompt-required-commands.ts");
    for (const forbidden of ['"windows"', '"holds"', '"peak"', '"gate-evaluate"']) {
      expect(inventory).not.toContain(forbidden);
    }
    const guide = normalized(read(ENGINE_GUIDE));
    expect(guide).toContain("no read surface");
  });
});

describe("TC-ENGINE-060 the operator guide declares its marker and four topics", () => {
  test("exactly one guide carries the operating content with a redistributable marker", () => {
    const candidates = guideFiles().filter((path) =>
      normalized(read(path)).includes("Engine-first delivery operations"),
    );
    expect(candidates).toEqual([ENGINE_GUIDE]);
    const guide = read(ENGINE_GUIDE);
    expect(guide).toContain("ados_distribution: redistributable");
    const body = normalized(guide);
    for (const token of [
      "dispatch <ref>",
      "verify gates <ref>",
      "merge <ref>",
      "conditions",
      "cleanDispatches",
      "handoverGate",
      "verdict",
      "dispatch handover <host/owner/name>",
      "--revert",
      "reversible",
      "five-key",
      "pointer",
      "dual-run",
    ]) {
      expect(body, token).toContain(token);
    }
    expect(body).toContain("The regular path is the engine");
    expect(body).toContain("documented fallback");
    expect(body).toContain("separate owner act");
    expect(body).toContain("declared residual");
    expect(body).toContain("`verify deploy`");
    expect(body).toContain("profile-blind");
  });
});

describe("TC-ENGINE-061 the six feature pages state the declared contracts", () => {
  test("the dispatch page states the summary/handover additions, the host, the exemption, and no-flip", () => {
    const text = normalized(page("feature-dispatch-engine.md"));
    for (const token of [
      "cleanDispatches",
      "consecutiveCleanDispatches",
      "conditions",
      "reversible",
      "repos list",
      "production",
      "Declared exemption",
      "revert noop",
      "No-flip operating definition",
    ]) {
      expect(text, token).toContain(token);
    }
  });

  test("the projects page states the row contract, the binding, the scope, and the alias", () => {
    const text = normalized(page("feature-projects.md"));
    for (const token of [
      "reversible",
      "handoverGate",
      "countedDeliveries",
      "cleanDispatches",
      "truncation",
      "host/owner/name",
      "production",
      "repos.state-unavailable",
      "five columns",
      "projects list --flat",
      "byte-compatible",
    ]) {
      expect(text, token).toContain(token);
    }
  });

  test("the merge page states the composition, the seams, and the residual", () => {
    const text = normalized(page("feature-merge-verify-deploy.md"));
    for (const token of [
      "MERGE_COMPOSITION_EMITTABLE_CODES",
      "owner principal",
      "provider-resolved repository owner",
      "config.credential.missing",
      "fallback.internal",
      "real",
      "Declared residual",
      "verify deploy",
    ]) {
      expect(text, token).toContain(token);
    }
  });

  test("the autonomous and daemon pages carry the engine-first and fallback wording", () => {
    const autonomous = normalized(page("feature-autonomous-delivery.md"));
    expect(autonomous).toContain("typed engine");
    expect(autonomous).toContain("still-executable fallback");
    const daemon = normalized(page("feature-resident-daemon.md"));
    expect(daemon).toContain("documented fallback");
    expect(daemon).toContain("daemon-hosted periodic gate evaluation");
    expect(daemon).toContain("supervise-only");
  });

  test("the phase-7 test-spec handoff is stated and no test-spec entry was added", () => {
    const guide = normalized(read(ENGINE_GUIDE));
    expect(guide).toContain("test-spec-dispatch-engine.md");
    expect(guide).toContain("system_spec_update");
    const peak = normalized(page("feature-peak-pausing.md"));
    expect(peak).not.toContain("reconciled during test planning");
    const entries = readdirSync(join(ROOT, "doc/quality/test-specs")).sort();
    expect(entries).toContain("test-spec-dispatch-engine.md");
    expect(entries).toContain("test-spec-merge-verify-deploy.md");
    // No new test-spec entry was created by this change (DEC-11).
    expect(entries.filter((name) => name.includes("engine-first"))).toEqual([]);
  });
});

describe("TC-ENGINE-062 the planning corpus carries the delivery", () => {
  test("progress line, status addendum, scenario row, and both restatements", () => {
    const backlog = normalized(read("doc/planning/oss-tooling/milestones/m2/backlog.md"));
    expect(backlog).toContain("Progress: GH-293 delivered the engine-first evaluation surfaces");
    for (const token of [
      "cleanDispatches",
      "handoverGate",
      "production",
      "No repository was flipped",
    ]) {
      expect(backlog, token).toContain(token);
    }

    const status = normalized(read("doc/planning/oss-tooling/status.md"));
    expect(status).toContain("Engine-first evaluation surfaces delivered (GH-293, M2-S16)");

    const readme = normalized(read("doc/planning/oss-tooling/milestones/m2/README.md"));
    expect(readme).toContain("SC-M2-S16-01, SC-M2-S16-02, SC-M2-S16-03");

    const scenarios = normalized(read("doc/planning/oss-tooling/milestones/m2/test-scenarios.md"));
    for (const token of [
      "countedDeliveries` grows by one",
      "at most one per dispatch",
      "at most eleven",
      "cleanDispatches` grows by one",
      "five-key tail unchanged",
      "repos list",
      "per-repository isolation",
    ]) {
      expect(scenarios, token).toContain(token);
    }
    expect(scenarios).not.toContain("`data.coverage` grows with it");
    expect(scenarios).not.toContain("reports `data.reversible == true`");
  });

  test("planning truth still holds", () => {
    const scenarios = read("doc/planning/oss-tooling/milestones/m2/test-scenarios.md");
    expect(scenarios).toContain("SC-M2-S16-01");
    expect(scenarios).toContain("SC-M2-S16-02");
    expect(scenarios).toContain("SC-M2-S16-03");
  });
});

describe("TC-ENGINE-063 the restatements are traceable and no AC is weakened", () => {
  test("the spec's Appendix B carries both rows with forcing facts and preserved ACs", () => {
    const spec = normalized(
      read("doc/changes/2026-11/2026-11-17--GH-293--engine-first-operations/chg-GH-293-spec.md"),
    );
    expect(spec).toContain("Appendix B: Scenario restatements");
    expect(spec).toContain("countedDeliveries` grows by one per counted dispatch");
    expect(spec).toContain("cleanDispatches` grows by one per corroborated dispatch");
    expect(spec).toContain("AC1 (corroborated outcomes accrue)");
    expect(spec).toContain("AC3 (shell usable and documented)");
    expect(spec).toContain("AC4 (per-repository reversible flip)");
    expect(spec).toContain("eleven-token");
    expect(spec).toContain("five-key");
    expect(spec).toContain("No story AC is weakened");

    const scenarios = normalized(read("doc/planning/oss-tooling/milestones/m2/test-scenarios.md"));
    expect(scenarios).toContain("Restated by GH-293");
    expect(scenarios).toContain("No story AC is weakened");
    expect(scenarios).toContain("coverage is the eleven-token exposure");
    expect(scenarios).toContain("pinned five-key");
  });
});

describe("TC-ENGINE-064 TDR-0031 is landed, indexed, and carried by the change", () => {
  test("the record, its index row, its clauses, and the five-outcome table", () => {
    const record = read("doc/decisions/TDR-0031-engine-first-evaluation-surfaces.md");
    expect(record).toContain("id: TDR-0031");
    expect(record).toContain("decision_type: tdr");
    expect(record).toContain("status: Proposed");
    for (const clause of ["D1 —", "D2 —", "D3 —", "D4 —", "D5 —", "D6 —", "D7 —"]) {
      expect(record, clause).toContain(clause);
    }
    for (const clause of ["D8 —", "D9 —", "D10 —", "D11 —"]) {
      expect(record, clause).toContain(clause);
    }
    expect(record).toContain("MERGE_COMPOSITION_EMITTABLE_CODES");
    expect(record).toContain("provider-resolved repository owner");
    expect(record).toContain("read-only and non-persisting");
    expect(record).toContain("production");

    const tableStart = record.indexOf("| Outcome |");
    expect(tableStart).toBeGreaterThan(0);
    const table = record.slice(tableStart, record.indexOf("\n\n", tableStart));
    const rows = table
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("|"));
    // Header, separator, and the five declared outcomes.
    expect(rows).toHaveLength(7);
    const exempt = rows.filter((line) => line.includes("Idempotent revert noop"));
    expect(exempt).toHaveLength(1);
    expect(exempt[0]).toContain("absent");
    expect(exempt[0]).toContain("`false`");
    expect(exempt[0]).toContain("exit `0`");
    const evidenceReading = rows.filter(
      (line) => line.includes("Recorded flip") || line.includes("Recorded revert"),
    );
    expect(evidenceReading).toHaveLength(2);
    for (const row of evidenceReading) expect(row).toContain("four entries, declared order");

    const index = read("doc/decisions/00-index.md");
    expect(index).toContain("[TDR-0031](TDR-0031-engine-first-evaluation-surfaces.md)");
    expect(index).toContain("Proposed");
    const spec = read(
      "doc/changes/2026-11/2026-11-17--GH-293--engine-first-operations/chg-GH-293-spec.md",
    );
    expect(spec).toContain("TDR-0031-engine-first-evaluation-surfaces.md");
    expect(record).toContain("feature-dispatch-engine.md");
    expect(record).toContain("feature-projects.md");
    expect(record).toContain("feature-peak-pausing.md");
  });
});

describe("TC-ENGINE-065 the lifecycle prose names the engine and the fallback", () => {
  test("both documents state the claim, the fallback, and no flip; the old claim is gone", () => {
    const agents = read("AGENTS.md");
    const lifecycle = read("doc/guides/change-lifecycle.md");
    for (const [name, text] of [
      ["AGENTS.md", agents],
      ["change-lifecycle.md", lifecycle],
    ] as const) {
      const body = normalized(text);
      expect(body, name).toContain("The typed engine is the regular delivery path");
      expect(body, name).toContain("dispatch <ref>");
      expect(body, name).toContain("still-executable fallback");
      expect(body, name).toContain("dispatch handover <repo> --revert");
      expect(body, name).toContain("owner act");
      expect(body, name.toLowerCase(), name).not.toContain("retained primary entry points");
      expect(body, name.toLowerCase()).not.toContain("primary delivery path");
      expect(body, name).not.toContain("deprecated in `dual-run`");
      expect(body, name).not.toContain("unsupported in `dual-run`");
    }
    // AGENTS.md is a root document and carries no distribution marker.
    expect(agents.split("\n---").length).toBeGreaterThan(0);
    expect(agents.includes("ados_distribution:")).toBe(false);
    const lifecycleHead = lifecycle.slice(0, lifecycle.indexOf("\n---", 4));
    expect(lifecycleHead).toContain("ados_distribution: redistributable");
    expect(lifecycle.split("ados_distribution:").length).toBe(2);

    // The bounded edit: the surrounding sections still carry their headings.
    for (const heading of [
      "## Delivery process",
      "## Agent team",
      "## Commands",
      "## Change artifacts",
    ]) {
      expect(agents, heading).toContain(heading);
    }
    for (const heading of ["### Commit Primitive Routing", "### Pure-Writer Agents"]) {
      expect(lifecycle, heading).toContain(heading);
    }
  });
});
