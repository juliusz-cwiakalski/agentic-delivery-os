/**
 * Static self-description for the executable (GH-242 F-1, DEC-10).
 *
 * Help is a pure data lookup: rendering reads no configuration, state, git, or
 * network. Usage, options, examples, exit codes, and a see-also pointer are the
 * five declared sections; every prompt-required command and subcommand has one
 * entry. The binary name always arrives through the branding seam.
 */
import type { BrandIdentity } from "@delivery-os/core/contracts";

/** One help page: a command path plus its five declared sections. */
export type HelpEntry = {
  /** Command path; the empty path is root help. */
  readonly path: readonly string[];
  /** One-line summary rendered next to the usage heading. */
  readonly summary: string;
  /** Usage lines; `<binary>` is substituted with the resolved binary name. */
  readonly usage: readonly string[];
  /** Flag/option list, in declaration order. */
  readonly options: readonly (readonly [string, string])[];
  /** Example invocations; `<binary>` is substituted. */
  readonly examples: readonly string[];
  /** Reference pages this page points at. */
  readonly seeAlso: readonly string[];
};

const REFERENCE_ROOT = "doc/planning/oss-tooling/milestones/m1";
const MAN_PAGE = `${REFERENCE_ROOT}/man-page.md`;
const ENTRYPOINT_PAGE = `${REFERENCE_ROOT}/commands/entrypoint.md`;

/**
 * The per-command reference-page root (GH-288 DEC-13). A command family
 * documents itself in its own milestone's page root, so an M2 page serves an M2
 * command while every M1 snapshot page stays byte-unchanged.
 */
const M2_REFERENCE_ROOT = "doc/planning/oss-tooling/milestones/m2";

const page = (name: string): string => `${REFERENCE_ROOT}/commands/${name}.md`;

const pageIn = (root: string, name: string): string => `${root}/commands/${name}.md`;

const GLOBAL_OPTIONS: readonly (readonly [string, string])[] = [
  ["--json", "Emit the machine envelope instead of the human report"],
  ["--verbose", "Add diagnostic detail to human output"],
  ["--pretty", "Indent machine output"],
];

const STANDARD_EXIT_CODES: readonly (readonly [number, string])[] = [
  [0, "The operation completed and returned its declared verdict"],
  [1, "The request was refused, invalid, or returned a negative verdict"],
  [2, "A platform, state, or provider failure prevented the operation"],
];

/** Root help: families, global flags, and the see-also pointer. */
export const ROOT_HELP: HelpEntry = {
  path: [],
  summary: "Spec-driven delivery tooling",
  usage: ["<binary> <command> [options]"],
  options: [
    ["--help", "Show root help"],
    ["--version", "Show version and build identity"],
    ...GLOBAL_OPTIONS,
  ],
  examples: ["<binary> --help", "<binary> --version", "<binary> status --json"],
  seeAlso: [MAN_PAGE, ENTRYPOINT_PAGE],
};

const entry = (
  path: readonly string[],
  summary: string,
  usage: readonly string[],
  options: readonly (readonly [string, string])[],
  examples: readonly string[],
  pageName: string,
): HelpEntry => ({
  path,
  summary,
  usage,
  options: [...options, ...GLOBAL_OPTIONS],
  examples,
  seeAlso: [page(pageName)],
});

/** An M2-rooted family page for one named reference page. */
const m2PageEntry =
  (pageName: string) =>
  (
    path: readonly string[],
    summary: string,
    usage: readonly string[],
    options: readonly (readonly [string, string])[],
    examples: readonly string[],
  ): HelpEntry => ({
    path,
    summary,
    usage,
    options: [...options, ...GLOBAL_OPTIONS],
    examples,
    seeAlso: [pageIn(M2_REFERENCE_ROOT, pageName)],
  });

/** The M4-rooted family pages (GH-346): the install lifecycle's own milestone. */
const M4_REFERENCE_ROOT = "doc/planning/oss-tooling/milestones/m4";

/** An M4-rooted family page for one named reference page. */
const m4PageEntry =
  (pageName: string) =>
  (
    path: readonly string[],
    summary: string,
    usage: readonly string[],
    options: readonly (readonly [string, string])[],
    examples: readonly string[],
  ): HelpEntry => ({
    path,
    summary,
    usage,
    options: [...options, ...GLOBAL_OPTIONS],
    examples,
    seeAlso: [pageIn(M4_REFERENCE_ROOT, pageName)],
  });

/** The M2-rooted family pages (GH-298): steer documents itself in its milestone. */
const m2Entry = (
  path: readonly string[],
  summary: string,
  usage: readonly string[],
  options: readonly (readonly [string, string])[],
  examples: readonly string[],
): HelpEntry => ({
  path,
  summary,
  usage,
  options: [...options, ...GLOBAL_OPTIONS],
  examples,
  seeAlso: [pageIn(M2_REFERENCE_ROOT, "steer")],
});

/** Every prompt-required command and subcommand help page. */
export const COMMAND_HELP: readonly HelpEntry[] = [
  entry(
    ["status"],
    "Collect the nine-section delivery digest",
    ["<binary> status [--repo <path>]", "<binary> status --project <groupKey>"],
    [
      ["--repo", "Target repository path (repeatable)"],
      ["--project <groupKey>", "Scope the read to one configured project group"],
    ],
    [
      "<binary> status",
      "<binary> status --json",
      "<binary> status --repo . --json",
      "<binary> status --project platform --json",
    ],
    "status",
  ),
  entry(
    ["brief"],
    "Render the owner-facing delivery brief",
    ["<binary> brief"],
    [],
    ["<binary> brief", "<binary> brief --json"],
    "brief",
  ),
  entry(
    ["queue"],
    "Read and mutate the scheduling queue",
    [
      "<binary> queue <list|plan|add|prioritize|dep|claim|release|remove|reconcile> [options]",
      "<binary> queue dep [add|remove] <ref> <on-ref>",
      "<binary> queue list --project <groupKey>",
    ],
    [
      ["--next <n>", "Limit the planned next actions"],
      ["--priority <n>", "Set or filter entry priority"],
      ["--dep <ref>", "Declare a dependency edge"],
      ["--holder <id>", "Claim or release holder identity"],
      ["--park <cause>", "Park a released entry with a condition"],
      ["--until <iso>", "Provider-window expiry for a park"],
      ["--reason <reason>", "Removal reason: landed | abandoned | superseded | reconciled"],
      ["--ref <ref>", "Reconcile a single entry"],
      ["--project <groupKey>", "Scope `queue list` to one configured project group"],
      ["--watch", "Watch the queue (requires the resident daemon)"],
    ],
    [
      "<binary> queue list",
      "<binary> queue plan --next 3",
      "<binary> queue add GH-242",
      "<binary> queue remove GH-242 --reason abandoned",
      "<binary> queue dep add GH-243 GH-242",
      "<binary> queue dep remove GH-243 GH-242",
      "<binary> queue reconcile",
      "<binary> queue reconcile --ref GH-242",
    ],
    "queue",
  ),
  entry(
    ["queue", "list"],
    "List observed queue entries",
    ["<binary> queue list", "<binary> queue list --project <groupKey>"],
    [["--project <groupKey>", "Scope the read to one configured project group"]],
    [
      "<binary> queue list",
      "<binary> queue list --json",
      "<binary> queue list --project platform --json",
    ],
    "queue",
  ),
  entry(
    ["queue", "plan"],
    "Plan the next scheduling actions",
    ["<binary> queue plan [--next <n>]"],
    [["--next <n>", "Number of next actions to return"]],
    ["<binary> queue plan --next 3", "<binary> queue plan --json"],
    "queue",
  ),
  entry(
    ["queue", "add"],
    "Declare a queue entry",
    ["<binary> queue add <ref> [--priority <n>] [--dep <ref>]"],
    [
      ["--priority <n>", "Entry priority"],
      ["--dep <ref>", "Declare a dependency edge"],
    ],
    ["<binary> queue add GH-242", "<binary> queue add GH-242 --priority 10"],
    "queue",
  ),
  entry(
    ["queue", "prioritize"],
    "Change an entry priority",
    ["<binary> queue prioritize <ref> --priority <n>"],
    [["--priority <n>", "New entry priority"]],
    ["<binary> queue prioritize GH-242 --priority 5"],
    "queue",
  ),
  entry(
    ["queue", "dep"],
    "Declare or remove a dependency edge",
    [
      "<binary> queue dep <ref> <on-ref>",
      "<binary> queue dep add <ref> <on-ref>",
      "<binary> queue dep remove <ref> <on-ref>",
    ],
    [],
    [
      "<binary> queue dep GH-243 GH-242",
      "<binary> queue dep add GH-243 GH-242",
      "<binary> queue dep remove GH-243 GH-242",
    ],
    "queue",
  ),
  entry(
    ["queue", "claim"],
    "Claim the next eligible entry",
    ["<binary> queue claim [<ref>] --holder <id>"],
    [["--holder <id>", "Claim holder identity"]],
    ["<binary> queue claim --holder lane-1", "<binary> queue claim GH-242 --holder lane-1"],
    "queue",
  ),
  entry(
    ["queue", "release"],
    "Release a claim or park an entry",
    ["<binary> queue release <ref> [--park <cause>] [--until <iso>]"],
    [
      ["--park <cause>", "Park cause"],
      ["--until <iso>", "Provider-window expiry"],
    ],
    ["<binary> queue release GH-242", "<binary> queue release GH-242 --park merge-conflict"],
    "queue",
  ),
  entry(
    ["queue", "remove"],
    "Remove a queue entry with a recorded reason",
    ["<binary> queue remove <ref> --reason <landed|abandoned|superseded|reconciled>"],
    [["--reason <reason>", "Removal reason: landed | abandoned | superseded | reconciled"]],
    [
      "<binary> queue remove GH-242 --reason abandoned",
      "<binary> queue remove GH-242 --reason landed",
    ],
    "queue",
  ),
  entry(
    ["queue", "reconcile"],
    "Remove entries whose tracked work item is done or canceled",
    ["<binary> queue reconcile [--ref <ref>]"],
    [["--ref <ref>", "Examine exactly one entry"]],
    ["<binary> queue reconcile", "<binary> queue reconcile --ref GH-242"],
    "queue",
  ),
  entry(
    ["lanes"],
    "Read lane occupancy and economics",
    ["<binary> lanes <list|show <ref>>"],
    [],
    ["<binary> lanes list", "<binary> lanes show GH-242"],
    "lanes",
  ),
  entry(
    ["lanes", "list"],
    "List lanes",
    ["<binary> lanes list"],
    [],
    ["<binary> lanes list", "<binary> lanes list --json"],
    "lanes",
  ),
  entry(
    ["lanes", "show"],
    "Show one lane",
    ["<binary> lanes show <ref>"],
    [],
    ["<binary> lanes show GH-242"],
    "lanes",
  ),
  entry(
    ["blockers"],
    "Publish, list, and answer typed questions",
    ["<binary> blockers <publish|list|answer> [options]"],
    [
      ["--lane <id>", "Publishing lane identity"],
      ["--options <list>", "Declared answer options"],
      ["--audience <name>", "Target audience"],
      ["--choice <n>", "Selected answer option"],
      ["--text <text>", "Free-text answer"],
      ["--open", "List only open questions"],
    ],
    [
      "<binary> blockers list --open",
      '<binary> blockers publish decision --lane lane-1 "Which gate applies?"',
      "<binary> blockers answer question-1 --choice 2",
    ],
    "blockers",
  ),
  entry(
    ["blockers", "publish"],
    "Publish a typed question",
    ['<binary> blockers publish <type> --lane <id> "<question>" [--options ...] [--audience ...]'],
    [
      ["--lane <id>", "Publishing lane identity"],
      ["--options <list>", "Declared answer options"],
      ["--audience <name>", "Target audience"],
    ],
    ['<binary> blockers publish decision --lane lane-1 "Which gate applies?"'],
    "blockers",
  ),
  entry(
    ["blockers", "list"],
    "List typed questions and answers",
    ["<binary> blockers list [--open]"],
    [["--open", "List only open questions"]],
    ["<binary> blockers list", "<binary> blockers list --open --json"],
    "blockers",
  ),
  entry(
    ["blockers", "answer"],
    "Answer a typed question",
    ["<binary> blockers answer <id> [--choice <n>] [--text <text>]"],
    [
      ["--choice <n>", "Selected answer option"],
      ["--text <text>", "Free-text answer"],
    ],
    ["<binary> blockers answer question-1 --choice 2"],
    "blockers",
  ),
  entry(
    ["phase"],
    "Read and write lifecycle phase state",
    ["<binary> phase <list|complete|reopen> [options]"],
    [["--no-commit", "Record the transition without a commit"]],
    [
      "<binary> phase list GH-242",
      "<binary> phase complete GH-242 delivery",
      '<binary> phase reopen GH-242 review_fix "scope gap"',
    ],
    "phase",
  ),
  entry(
    ["phase", "list"],
    "List phase state",
    ["<binary> phase list <ref>"],
    [],
    ["<binary> phase list GH-242", "<binary> phase list GH-242 --json"],
    "phase",
  ),
  entry(
    ["phase", "complete"],
    "Complete a lifecycle phase",
    ["<binary> phase complete <ref> <phase> [--no-commit]"],
    [["--no-commit", "Record the transition without a commit"]],
    [
      "<binary> phase complete GH-242 delivery",
      "<binary> phase complete GH-242 delivery --no-commit",
    ],
    "phase",
  ),
  entry(
    ["phase", "reopen"],
    "Reopen a completed lifecycle phase",
    ["<binary> phase reopen <ref> <phase> <reason>"],
    [],
    ['<binary> phase reopen GH-242 review_fix "review found a gap"'],
    "phase",
  ),
  entry(
    ["commit"],
    "Create one commit through the commit primitive",
    ["<binary> commit [<ref>] [--phase <phase>] [--dry-run]"],
    [
      ["--phase <phase>", "Complete the lifecycle phase atomically with the commit"],
      ["--dry-run", "Compute the staging set and message without committing"],
    ],
    ["<binary> commit", "<binary> commit GH-242 --phase delivery", "<binary> commit --dry-run"],
    "commit",
  ),
  entry(
    ["lint"],
    "Check pm-notes and plan conformance",
    ["<binary> lint <ref> [--registry]", "<binary> lint plan <ref>"],
    [["--registry", "Check the phase-state registry projection"]],
    ["<binary> lint GH-242", "<binary> lint plan GH-242"],
    "lint",
  ),
  entry(
    ["plan"],
    "Validate and compare delivery plans",
    ["<binary> plan <validate|diff|overlap> [options]"],
    [["--against <base>", "Base ref for a plan diff"]],
    [
      "<binary> plan validate GH-242",
      "<binary> plan diff GH-242 --against origin/main-tools",
      "<binary> plan overlap GH-242 GH-243",
    ],
    "plan",
  ),
  entry(
    ["plan", "validate"],
    "Validate a delivery plan",
    ["<binary> plan validate <ref>"],
    [],
    ["<binary> plan validate GH-242", "<binary> plan validate GH-242 --json"],
    "plan",
  ),
  entry(
    ["plan", "diff"],
    "Diff a plan's declared scope against a base",
    ["<binary> plan diff <ref> [--against <base>]"],
    [["--against <base>", "Base ref for the scope diff"]],
    ["<binary> plan diff GH-242 --against origin/main-tools"],
    "plan",
  ),
  entry(
    ["plan", "overlap"],
    "Check scope overlap between two plans",
    ["<binary> plan overlap <refA> <refB>"],
    [],
    ["<binary> plan overlap GH-242 GH-243"],
    "plan",
  ),
  entry(
    ["verify"],
    "Verify artifact, gate, and deploy evidence",
    ["<binary> verify <change|gates|deploy> <ref>"],
    [],
    [
      "<binary> verify change GH-242",
      "<binary> verify gates GH-242",
      "<binary> verify deploy GH-242",
    ],
    "verify-change",
  ),
  entry(
    ["verify", "change"],
    "Verify the change artifact ledger",
    ["<binary> verify change <ref>"],
    [],
    ["<binary> verify change GH-242"],
    "verify-change",
  ),
  entry(
    ["verify", "gates"],
    "Verify CI gate evidence",
    ["<binary> verify gates <ref>"],
    [],
    ["<binary> verify gates GH-242"],
    "verify-gates",
  ),
  entry(
    ["verify", "deploy"],
    "Verify deploy trace evidence",
    ["<binary> verify deploy <ref>"],
    [],
    ["<binary> verify deploy GH-242"],
    "verify-deploy",
  ),
  entry(
    ["merge"],
    "Merge a verified ready item",
    ["<binary> merge <ref> [--dry-run]"],
    [
      ["--dry-run", "Verify merge readiness without landing"],
      ["--waive <gate>", "Waive one gate identity"],
      ["--waived-by <principal>", "Waiver authority"],
      ["--waive-reason <text>", "Waiver rationale"],
    ],
    ["<binary> merge GH-242 --dry-run", "<binary> merge GH-242"],
    "merge",
  ),
  entry(
    ["closeout"],
    "Plan or apply the post-merge sweep",
    ["<binary> closeout <ref> [--apply]"],
    [["--apply", "Apply the closeout writes"]],
    ["<binary> closeout GH-242", "<binary> closeout GH-242 --apply"],
    "closeout",
  ),
  entry(
    ["dispatch"],
    "Run one typed dispatch, read dual-run evidence, or move authority",
    [
      "<binary> dispatch <ref> [--harness <name>] [--resume-prompt <text>]",
      "<binary> dispatch attempts [--ref <ref>] [--limit <n>]",
      "<binary> dispatch dual-run summary --repo <repo>",
      "<binary> dispatch dual-run resolve <divergence-id> --note <text>",
      "<binary> dispatch handover <repo> [--revert]",
      "<binary> dispatch status <ref> [--json]",
      "<binary> dispatch log <ref> [--tail <n>] [--json]",
      "<binary> dispatch is-delivering [<ref>] [--json]",
      "<binary> dispatch last-message <ref> [--json]",
      "<binary> dispatch stop <ref> --cause peak-window --until <iso>",
    ],
    [
      ["--harness <name>", "Harness adapter (opencode, claude-code); default from config"],
      ["--resume-prompt <text>", "Resume the existing lane with guidance"],
      ["--ref <ref>", "Work item reference to inspect; default is the active change"],
      ["--limit <n>", "Page size, 1..100 (default 20)"],
      ["--repo <repo>", "Repository identity for summary and handover"],
      ["--note <text>", "Bounded divergence-resolution note"],
      ["--revert", "Revert a recorded handover to dual-run"],
      ["--tail <n>", "Log tail size, 1..500 (default 50); refused, never clamped"],
      ["--cause <cause>", "Stop cause; peak-window is the one admitted cause"],
      ["--until <iso>", "The declared park end; required for peak-window"],
    ],
    [
      "<binary> dispatch GH-242",
      "<binary> dispatch GH-242 --harness claude-code",
      "<binary> dispatch attempts --ref GH-242 --limit 5",
      "<binary> dispatch dual-run summary --repo github.com/owner/repo",
      '<binary> dispatch dual-run resolve DIV-1 --note "tracker was stale"',
      "<binary> dispatch handover github.com/owner/repo --revert",
      "<binary> dispatch status GH-354 --json",
      "<binary> dispatch log GH-354 --tail 200",
      "<binary> dispatch is-delivering GH-354",
      "<binary> dispatch last-message GH-354 --json",
      "<binary> dispatch stop GH-354 --cause peak-window --until 2026-11-12T10:00:00Z",
    ],
    "dispatch",
  ),
  entry(
    ["dispatch", "stop"],
    "Stop a running lane with the same bounded-grace stop the window watch sends",
    ["<binary> dispatch stop <ref> --cause peak-window --until <iso>"],
    [
      ["--cause <cause>", "Stop cause; peak-window is the one admitted cause"],
      ["--until <iso>", "The declared park end; required for peak-window"],
    ],
    ["<binary> dispatch stop GH-354 --cause peak-window --until 2026-11-12T10:00:00Z"],
    "dispatch",
  ),
  {
    path: ["dispatch", "attempts"],
    summary:
      "Read one work item's recorded attempts, newest first; coverage and floor come from dispatch dual-run summary --repo <repo>",
    usage: ["<binary> dispatch attempts [--ref <ref>] [--limit <n>]"],
    options: [
      ["--ref <ref>", "Work item reference to inspect; default is the active change"],
      ["--limit <n>", "Page size, 1..100 (default 20)"],
      ...GLOBAL_OPTIONS,
    ],
    examples: [
      "<binary> dispatch attempts --ref GH-242 --limit 5",
      "<binary> dispatch attempts --json",
    ],
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "attempts")],
  },
  {
    path: ["dispatch", "status"],
    summary:
      "Answer the newest durable lane for a ref: delivering/stale/marker/probe, the owner facts, and the last outcome (exit 0 in every state)",
    usage: ["<binary> dispatch status <ref> [--json]"],
    options: [...GLOBAL_OPTIONS],
    examples: ["<binary> dispatch status GH-354", "<binary> dispatch status GH-354 --json"],
    seeAlso: [page("dispatch")],
  },
  {
    path: ["dispatch", "log"],
    summary:
      "Answer the bounded per-ref tail of the streaming harness's own stdout; no artifact is no-log (exit 0), an unreadable file is unreadable (exit 1)",
    usage: ["<binary> dispatch log <ref> [--tail <n>] [--json]"],
    options: [
      ["--tail <n>", "Newest lines to return, 1..500 (default 50); refused, never clamped"],
      ...GLOBAL_OPTIONS,
    ],
    examples: ["<binary> dispatch log GH-354", "<binary> dispatch log GH-354 --tail 200 --json"],
    seeAlso: [page("dispatch")],
  },
  {
    path: ["dispatch", "is-delivering"],
    summary:
      "Answer whether a ref (or the repository) has an active, non-stale lane: exit 0 in progress, exit 1 not; the JSON answer carries the boolean",
    usage: ["<binary> dispatch is-delivering [<ref>] [--json]"],
    options: [...GLOBAL_OPTIONS],
    examples: ["<binary> dispatch is-delivering GH-354", "<binary> dispatch is-delivering --json"],
    seeAlso: [page("dispatch")],
  },
  {
    path: ["dispatch", "last-message"],
    summary:
      "Answer the session's final assistant message for a ref, composed redact -> flatten -> bound -> mark; a closed reason at exit 1 when it cannot",
    usage: ["<binary> dispatch last-message <ref> [--json]"],
    options: [...GLOBAL_OPTIONS],
    examples: [
      "<binary> dispatch last-message GH-354",
      "<binary> dispatch last-message GH-354 --json",
    ],
    seeAlso: [page("dispatch")],
  },
  entry(
    ["dispatch", "dual-run", "summary"],
    "Report the dual-run evidence window and the four-condition verdict",
    ["<binary> dispatch dual-run summary --repo <repo>"],
    [["--repo <repo>", "Repository identity to summarize"]],
    ["<binary> dispatch dual-run summary --repo github.com/owner/repo --json"],
    "dispatch",
  ),
  entry(
    ["dispatch", "dual-run", "resolve"],
    "Resolve one open divergence with a bounded note",
    ["<binary> dispatch dual-run resolve <divergence-id> --note <text>"],
    [["--note <text>", "Bounded resolution note"]],
    ['<binary> dispatch dual-run resolve DIV-1 --note "tracker was stale"'],
    "dispatch",
  ),
  entry(
    ["dispatch", "handover"],
    "Flip one repository to engine-authoritative, or revert it",
    ["<binary> dispatch handover <repo> [--revert]"],
    [["--revert", "Restore dual-run authority"]],
    [
      "<binary> dispatch handover github.com/owner/repo",
      "<binary> dispatch handover github.com/owner/repo --revert",
    ],
    "dispatch",
  ),
  entry(
    ["spend"],
    "Report captured spend and amplification",
    ["<binary> spend [--ref <ref>] [--phase <phase>] [--breakdown <field>] [--amplification]"],
    [
      ["--ref <ref>", "Work item ref"],
      ["--phase <phase>", "Lifecycle phase"],
      ["--breakdown <field>", "Lead with one breakdown: ticket, repository, lane, role, model"],
      ["--amplification", "Render the amplification view"],
    ],
    [
      "<binary> spend --ref GH-242",
      "<binary> spend --ref GH-242 --breakdown model --amplification --json",
    ],
    "spend",
  ),
  {
    ...entry(
      ["retro"],
      "Collect and report retro evidence; file, close, and list follow-through actions",
      ["<binary> retro <collect|report|action <file|close|list>> [--level <name>]"],
      [
        ["--level <name>", "Retro level (change, session, incident, window, project)"],
        ["--window <name>", "Improvement window (action file/list)"],
        ["--owner <name>", "Named owner: one agent role or one human (action file)"],
        ["--owner-kind <kind>", "agent-role | human (action file)"],
        ["--verb <verb>", "add | remove | change | test | deploy (action file)"],
        ["--outcome <text>", "Measurable outcome (action file)"],
        ["--tracker <ref>", "Real tracker entry (action file)"],
        ["--due <date>", "Due date (action file)"],
        ["--artifact <ref>", "Verification artifact (action file/close)"],
        ["--outcome-evidence <ref>", "Delayed-metric evidence (action file)"],
        ["--outcome-window <start>..<end>", "Verifier window (action file)"],
        ["--rollback <text>", "Rollback condition (action file)"],
        ["--action <id>", "Action reference (action close)"],
        ["--route <route>", "done | deprioritized | superseded (action close)"],
        ["--decision <ref>", "Explicit closure decision (action close)"],
        ["--reason <text>", "Deprioritize reason (action close)"],
        ["--successor <id>", "Superseding action reference (action close)"],
        ["--evidence <ref>", "In-window verifier evidence (action close)"],
        ["--plane <plane>", "artifact | outcome (action close)"],
      ],
      [
        "<binary> retro collect",
        "<binary> retro report --level milestone",
        "<binary> retro action list --window window-a",
      ],
      "retro",
    ),
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "retro")],
  },
  {
    ...entry(
      ["retro", "action"],
      "File, close, and list follow-through actions in the retro action registry",
      ["<binary> retro action <file|close|list> [options]"],
      [["--help", "Show this help"]],
      [
        "<binary> retro action file --owner agent-role:reviewer --owner-kind agent-role --verb add",
        "<binary> retro action close --action action-1 --route done --decision decision-1",
        "<binary> retro action list",
      ],
      "retro",
    ),
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "retro")],
  },
  {
    ...entry(
      ["retro", "collect"],
      "Collect retro evidence",
      ["<binary> retro collect [--level <name>]"],
      [["--level <name>", "Retro level"]],
      ["<binary> retro collect --level change"],
      "retro",
    ),
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "retro")],
  },
  {
    ...entry(
      ["retro", "report"],
      "Render a retro report",
      ["<binary> retro report [--level <name>]"],
      [["--level <name>", "Retro level"]],
      ["<binary> retro report --level milestone"],
      "retro",
    ),
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "retro")],
  },
  {
    ...entry(
      ["ceremony"],
      "Run declared ceremonies: list, run, resume, catch-up",
      ["<binary> ceremony <list|run <name>|resume <runId>|catch-up> [options]"],
      [
        ["--note <path>", "Ceremony note document (required by note-consuming ceremonies)"],
        ["--window <start>..<end>", "Run window"],
        ["--apply", "Land declared sync effects; dry-run is the default"],
        ["--name <name>", "Limit catch-up to one ceremony"],
      ],
      [
        "<binary> ceremony list",
        "<binary> ceremony run morning-brief",
        "<binary> ceremony resume run-123",
        "<binary> ceremony catch-up --name morning-brief",
      ],
      "ceremony",
    ),
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "ceremony"), MAN_PAGE],
  },
  {
    ...entry(
      ["ceremony", "list"],
      "List every declared ceremony",
      ["<binary> ceremony list"],
      [],
      ["<binary> ceremony list", "<binary> ceremony list --json"],
      "ceremony",
    ),
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "ceremony")],
  },
  {
    ...entry(
      ["ceremony", "run"],
      "Run one declared ceremony",
      ["<binary> ceremony run <name> [--note <path>] [--window <start>..<end>] [--apply]"],
      [
        ["--note <path>", "Ceremony note document"],
        ["--window <start>..<end>", "Run window"],
        ["--apply", "Land declared sync effects"],
      ],
      ["<binary> ceremony run morning-brief", "<binary> ceremony run night-watch --json"],
      "ceremony",
    ),
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "ceremony")],
  },
  {
    ...entry(
      ["ceremony", "resume"],
      "Continue an interrupted ceremony run",
      ["<binary> ceremony resume <runId> [--apply]"],
      [["--apply", "Land declared sync effects"]],
      ["<binary> ceremony resume run-123"],
      "ceremony",
    ),
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "ceremony")],
  },
  {
    ...entry(
      ["ceremony", "catch-up"],
      "Replay at most one missed window per ceremony",
      ["<binary> ceremony catch-up [--name <name>]"],
      [["--name <name>", "Limit catch-up to one ceremony"]],
      ["<binary> ceremony catch-up", "<binary> ceremony catch-up --name morning-brief"],
      "ceremony",
    ),
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "ceremony")],
  },
  {
    ...entry(
      ["daemon"],
      "Run and manage the resident daemon: start, stop, status, install, uninstall",
      [
        "<binary> daemon <start [--foreground]|stop [--mode drain|immediate]|status [--live]|install|uninstall>",
      ],
      [
        ["--foreground", "Own the resident loop in this process until a signal (start only)"],
        ["--live", "Fail closed when the composed socket is unreachable (status only)"],
        ["--mode <mode>", "Stop mode: drain or immediate (stop only)"],
      ],
      [
        "<binary> daemon start --foreground",
        "<binary> daemon status",
        "<binary> daemon stop --mode drain",
        "<binary> daemon install",
      ],
      "daemon",
    ),
    seeAlso: [page("daemon"), MAN_PAGE],
  },
  entry(
    ["daemon", "start"],
    "Start the resident daemon, detached or in the foreground",
    ["<binary> daemon start [--foreground]"],
    [["--foreground", "Run the resident loop in this process"]],
    ["<binary> daemon start", "<binary> daemon start --foreground"],
    "daemon",
  ),
  entry(
    ["daemon", "stop"],
    "Stop the resident daemon, draining or immediately",
    ["<binary> daemon stop [--mode drain|immediate]"],
    [["--mode <mode>", "Stop mode: drain or immediate"]],
    ["<binary> daemon stop", "<binary> daemon stop --mode immediate"],
    "daemon",
  ),
  entry(
    ["daemon", "status"],
    "Report the durable daemon projection and socket reachability",
    ["<binary> daemon status [--live]"],
    [["--live", "Fail closed when the composed socket is unreachable"]],
    ["<binary> daemon status", "<binary> daemon status --live --json"],
    "daemon",
  ),
  entry(
    ["daemon", "install"],
    "Install the per-user supervisor unit for the daemon",
    ["<binary> daemon install"],
    [],
    ["<binary> daemon install", "<binary> daemon install --json"],
    "daemon",
  ),
  entry(
    ["daemon", "uninstall"],
    "Remove this installation's supervisor unit and marker",
    ["<binary> daemon uninstall"],
    [],
    ["<binary> daemon uninstall", "<binary> daemon uninstall --json"],
    "daemon",
  ),
  entry(
    ["coordinator"],
    "Supervise the coordinator session: start, stop, status, tick",
    ["<binary> coordinator <start --foreground [--fresh-budget]|stop|status [--live]|tick>"],
    [
      ["--foreground", "Run the foreground supervision loop (start only)"],
      ["--fresh-budget", "Open a new restart budget epoch (start only)"],
      ["--live", "Report bounded live process facts (status only)"],
    ],
    [
      "<binary> coordinator status",
      "<binary> coordinator start --foreground",
      "<binary> coordinator tick --json",
    ],
    "coordinator",
  ),
  {
    path: ["projects"],
    summary: "Project groups: the declared repositories and their aggregate health",
    usage: ["<binary> projects <list> [options]"],
    options: [
      ["--flat", "Return the delivered flat projects.v1 payload (deprecation alias)"],
      ["--project <groupKey>", "Scope the read to one configured project group"],
      ...GLOBAL_OPTIONS,
    ],
    examples: ["<binary> projects list", "<binary> projects list --json"],
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "projects")],
  },
  {
    path: ["projects", "list"],
    summary: "List the configured project groups, or the delivered flat payload alias",
    usage: ["<binary> projects list [--flat] [--project <groupKey>] [options]"],
    options: [
      ["--flat", "Return the delivered flat projects.v1 payload (deprecation alias)"],
      ["--project <groupKey>", "Scope the read to one configured project group"],
      ...GLOBAL_OPTIONS,
    ],
    examples: [
      "<binary> projects list",
      "<binary> projects list --json",
      "<binary> projects list --project platform",
      "<binary> projects list --flat --json",
    ],
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "projects")],
  },
  {
    path: ["repos"],
    summary: "The flat record set of delivery-managed checkouts on the host",
    usage: ["<binary> repos <list> [options]"],
    options: [...GLOBAL_OPTIONS],
    examples: ["<binary> repos list", "<binary> repos list --json"],
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "repos")],
  },
  {
    path: ["repos", "list"],
    summary: "List every managed checkout with its state and handover",
    usage: ["<binary> repos list [options]"],
    options: [...GLOBAL_OPTIONS],
    examples: ["<binary> repos list", "<binary> repos list --json"],
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "repos")],
  },
  {
    path: ["events"],
    summary: "Read the subscribe event taxonomy: list topics and describe one",
    usage: ["<binary> events <list|describe <topic>> [options]"],
    options: [...GLOBAL_OPTIONS],
    examples: [
      "<binary> events list",
      "<binary> events describe queue.graph",
      "<binary> events list --json",
    ],
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "events")],
  },
  {
    path: ["events", "list"],
    summary: "List the declared topics, their shapes, kinds, ordering, and overflow",
    usage: ["<binary> events list [options]"],
    options: [...GLOBAL_OPTIONS],
    examples: ["<binary> events list", "<binary> events list --json"],
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "events")],
  },
  {
    path: ["events", "describe"],
    summary: "Describe one topic's kinds, payload fields, lane, ordering, and frame",
    usage: ["<binary> events describe <topic> [options]"],
    options: [...GLOBAL_OPTIONS],
    examples: [
      "<binary> events describe queue.graph",
      "<binary> events describe queue.graph --json",
    ],
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "events")],
  },
  {
    path: ["board"],
    summary: "One screen of lanes, gates, owner asks, and parked work across managed repositories",
    usage: ["<binary> board [--all] [--project <key>] [--json]"],
    options: [
      ["--all", "Span every managed repository (bounded to 128, overflow counted)"],
      ["--project <key>", "Narrow to one clone identity"],
      ...GLOBAL_OPTIONS,
    ],
    examples: [
      "<binary> board",
      "<binary> board --all",
      "<binary> board --project delivery-a-1a2b3c4d --json",
    ],
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "board")],
  },
  {
    path: ["steer"],
    summary: "File steering notes and read them at the phase boundary",
    usage: [
      "<binary> steer <send|list|read|complete> [options]",
      '<binary> steer send "<text>" [--kind request|escalate] [--priority low|normal|high|urgent] [--ttl <duration>] [--ref <artifact>]',
      "<binary> steer list",
      "<binary> steer read",
      "<binary> steer complete <id> --ref <artifact>",
    ],
    options: [
      ["--kind request|escalate", "Filing kind (drawn default: request)"],
      ["--priority low|normal|high|urgent", "Filing priority (drawn default: normal)"],
      [
        "--ttl <duration>",
        "Time to live as <positive-integer><unit>, unit s|m|h|d, max 30d (drawn default: 24h)",
      ],
      ["--ref <artifact>", "Artifact reference (at most 160 characters); required on complete"],
      ...GLOBAL_OPTIONS,
    ],
    examples: [
      '<binary> steer send "prefer smaller diffs; split the refactor"',
      '<binary> steer send "escalate the review" --kind escalate --priority urgent --ttl 14d',
      "<binary> steer list --json",
      "<binary> steer read",
      "<binary> steer complete msg-1 --ref doc/changes/proof.yaml",
    ],
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "steer")],
  },

  {
    path: ["metrics"],
    summary:
      "Report the delivery's metrics, per-dispatch spend, burn-rate alarms, and comparison view",
    usage: [
      "<binary> metrics [--ref <ref>] [--from <iso>] [--through <iso>] [--json]",
      "<binary> metrics --from 2026-10-18T00:00:00Z --through 2026-11-17T00:00:00Z",
    ],
    options: [
      ["--ref <ref>", "Evaluate this work-item ref (drawn from the active change context)"],
      [
        "--from <iso>",
        "Inclusive evidence-window start (jointly required with --through; drawn: trailing 30 days)",
      ],
      ["--through <iso>", "Inclusive evidence-window end (drawn: the read instant)"],
      ...GLOBAL_OPTIONS,
    ],
    examples: [
      "<binary> metrics",
      "<binary> metrics --ref GH-299 --json",
      "<binary> metrics --from 2026-10-18T00:00:00Z --through 2026-11-17T00:00:00Z",
    ],
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "metrics")],
  },

  m2Entry(
    ["steer", "send"],
    "File one steering note with drawn defaults",
    [
      '<binary> steer send "<text>" [--kind request|escalate] [--priority low|normal|high|urgent] [--ttl <duration>] [--ref <artifact>]',
    ],
    [
      ["--kind request|escalate", "Filing kind (default request)"],
      ["--priority low|normal|high|urgent", "Filing priority (default normal)"],
      ["--ttl <duration>", "Duration <positive-integer><unit>, unit s|m|h|d, max 30d, default 24h"],
      ["--ref <artifact>", "Artifact reference, at most 160 characters"],
    ],
    [
      '<binary> steer send "prefer smaller diffs"',
      '<binary> steer send "escalate" --kind escalate --priority urgent --ttl 14d',
    ],
  ),
  m2Entry(
    ["steer", "list"],
    "Render the queued, landed, and expired steering notes side by side",
    ["<binary> steer list"],
    [],
    ["<binary> steer list", "<binary> steer list --json"],
  ),
  m2Entry(
    ["steer", "read"],
    "Read the boundary read point: land due notes and batch the owner asks",
    ["<binary> steer read"],
    [],
    ["<binary> steer read", "<binary> steer read --json"],
  ),
  m2Entry(
    ["steer", "complete"],
    "Complete a landed note against the artifact that proves the course change",
    ["<binary> steer complete <id> --ref <artifact>"],
    [["--ref <artifact>", "The proving artifact reference (required, at most 160 characters)"]],
    ["<binary> steer complete msg-1 --ref doc/changes/proof.yaml"],
  ),

  m2PageEntry("supervise")(
    ["supervise"],
    "Run the supervisor battery: classify every lane and supervision claim from artifact evidence",
    ["<binary> supervise [--json]"],
    [],
    ["<binary> supervise", "<binary> supervise --json"],
  ),

  m4PageEntry("install")(
    ["install"],
    "Install, upgrade, inspect, roll back, and remove the installed product; installation is owned by the primary identity, so the compatibility alias advertises the family and refuses it — the alias is a declared compatibility shim removed in release 0.2.0, so run the lifecycle through the installed product binary as the reference page and the local install guide document",
    [
      "<binary> install [--add-to-path] [--shell-profile <path>] [--dry-run] [--stop-daemon]",
      "<binary> install status [--json]",
      "<binary> install rollback [--dry-run] [--stop-daemon]",
      "<binary> install uninstall [--dry-run] [--stop-daemon]",
      "<binary> install purge [--dry-run] [--stop-daemon] [--yes]",
    ],
    [
      ["--add-to-path", "Append one delimited PATH block to the operator's profile"],
      [
        "--shell-profile <path>",
        "The profile file to manage; overrides the declared shell mapping",
      ],
      ["--dry-run", "Print the complete plan and write nothing"],
      [
        "--stop-daemon",
        "Stop a live daemon through the delivered stop path before the swap or removal",
      ],
      ["--yes", "Confirm `install purge`"],
    ],
    [
      "<binary> install --dry-run",
      "<binary> install status --json",
      "<binary> install rollback",
      "<binary> install uninstall --dry-run",
      "<binary> install purge --yes",
    ],
  ),
  m4PageEntry("install")(
    ["install", "migrate"],
    "Move the three prior-namespace roots (host configuration, host state, invoking project configuration) to the current identity with a dry-run, a verified backup, per-entry precedence, idempotence, and recovery; the retired `install --migrate` form is refused and points at this verb",
    ["<binary> install migrate [--dry-run] [--backup-dir <abs>] [--stop-daemon]"],
    [
      ["--dry-run", "Print the complete plan and write nothing"],
      ["--backup-dir <abs>", "Place the verified backup at this absolute path"],
      ["--stop-daemon", "Stop a live daemon through the delivered stop path before the first move"],
    ],
    ["<binary> install migrate --dry-run", "<binary> install migrate"],
  ),
  m4PageEntry("install")(
    ["install", "status"],
    "Report the running identity, the installed record, the record condition, the slot, the target stability, the state-format verdict, and the managed block",
    ["<binary> install status [--json]"],
    [],
    ["<binary> install status", "<binary> install status --json"],
  ),
  m4PageEntry("install")(
    ["install", "rollback"],
    "Swap the rollback slot and the destination with two renames in reverse order",
    ["<binary> install rollback [--dry-run] [--stop-daemon]"],
    [
      [
        "--dry-run",
        "Print the two identities, the two renames, and the record update, or the refusal",
      ],
      ["--stop-daemon", "Stop a live daemon through the delivered stop path before the swap"],
    ],
    ["<binary> install rollback", "<binary> install rollback --dry-run"],
  ),
  m4PageEntry("install")(
    ["install", "uninstall"],
    "Remove the artifact, the slot, the record, and the managed PATH block, always printing the purge residual set",
    ["<binary> install uninstall [--dry-run] [--stop-daemon]"],
    [
      ["--dry-run", "Print the removal list and the residual set in two separated blocks"],
      ["--stop-daemon", "Stop a live daemon through the delivered stop path before removal"],
    ],
    ["<binary> install uninstall", "<binary> install uninstall --dry-run"],
  ),
  m4PageEntry("install")(
    ["install", "purge"],
    "Remove the artifact surface and both roots behind an explicit confirmation",
    ["<binary> install purge [--dry-run] [--stop-daemon] [--yes]"],
    [
      ["--dry-run", "Print the removal list including every enumerated project root"],
      ["--stop-daemon", "Stop a live daemon through the delivered stop path before removal"],
      ["--yes", "Confirm the purge; without it the run refuses and removes nothing"],
    ],
    ["<binary> install purge", "<binary> install purge --yes", "<binary> install purge --dry-run"],
  ),
  m4PageEntry("loop")(
    ["loop"],
    "Run, stop, inspect, tail, and reset the CEO outer delivery loop — a composition profile over the delivered supervision engine under the loop-main identity",
    [
      "<binary> loop start --foreground [--fresh-budget]",
      "<binary> loop stop [--mode drain|immediate]",
      "<binary> loop status [--json]",
      "<binary> loop log [--lines <n>]",
      "<binary> loop reset",
    ],
    [
      ["--foreground", "Run the supervision cycle in the foreground (required by start)"],
      ["--fresh-budget", "Open the next restart-budget epoch on start"],
      [
        "--mode <drain|immediate>",
        "Stop mode: drain finishes the session; immediate terminates it",
      ],
      ["--lines <n>", "Read the last n log lines (1..100, default 50)"],
    ],
    [
      "<binary> loop start --foreground",
      "<binary> loop status --json",
      "<binary> loop log --lines 20",
      "<binary> loop stop --mode immediate",
      "<binary> loop reset",
    ],
  ),
  m4PageEntry("loop")(
    ["loop", "start"],
    "Claim the instance lease, establish or re-find the CEO session, and run the supervision cycle",
    ["<binary> loop start --foreground [--fresh-budget]"],
    [
      ["--foreground", "Required in v1; detached hosting is not declared"],
      ["--fresh-budget", "Open the next restart-budget epoch"],
    ],
    ["<binary> loop start --foreground", "<binary> loop start --foreground --fresh-budget"],
  ),
  m4PageEntry("loop")(
    ["loop", "stop"],
    "Append one durable loop-identity stop request; the loop honours it at its next boundary",
    ["<binary> loop stop [--mode drain|immediate]"],
    [["--mode <drain|immediate>", "drain (default) finishes the session; immediate terminates it"]],
    ["<binary> loop stop", "<binary> loop stop --mode immediate"],
  ),
  m4PageEntry("loop")(
    ["loop", "status"],
    "Project the delivery.loop.v1 observation read-only: the six shell keys, then the additive keys",
    ["<binary> loop status [--json]"],
    [],
    ["<binary> loop status", "<binary> loop status --json"],
  ),
  m4PageEntry("loop")(
    ["loop", "log"],
    "Return the bounded tail of the loop's operational log",
    ["<binary> loop log [--lines <n>]"],
    [["--lines <n>", "An integer 1..100 (default 50)"]],
    ["<binary> loop log", "<binary> loop log --lines 100"],
  ),
  m4PageEntry("loop")(
    ["loop", "reset"],
    "Append one durable stop clearance when a request is folded; otherwise a no-op success",
    ["<binary> loop reset"],
    [],
    ["<binary> loop reset"],
  ),
  entry(
    ["provider"],
    "Inspect and resolve AI provider policy: chains, quota, parks, profiles, watches, simulation, and legacy migration",
    [
      "<binary> provider resolve [--chain <name>] [--profile <name>]",
      "<binary> provider quota [--provider <name>]",
      "<binary> provider parks list [--all] [--provider <name>]",
      "<binary> provider profile resolve [--agent <name>] [--for-spawn]",
      "<binary> provider watch status [--provider <name>]",
      "<binary> provider simulate --fixture <path>",
      "<binary> provider migrate legacy [--profiles-dir <dir>] [--hook <path>] [--write]",
    ],
    [
      ["--chain <name>", "Resolve one declared chain instead of the default chain (`resolve`)"],
      ["--profile <name>", "Scope the resolution to one named profile's providers (`resolve`)"],
      ["--provider <name>", "Narrow `quota`, `parks list`, or `watch status` to one provider"],
      ["--all", "Include cleared and expired parks (`parks list`)"],
      ["--agent <name>", "Select the seat for one agent (`profile resolve`)"],
      ["--for-spawn", "Emit the spawn env record (`profile resolve`)"],
      ["--fixture <path>", "The bounded simulation fixture to replay (`simulate`)"],
      [
        "--profiles-dir <dir>",
        "Read legacy profiles from one declared directory (`migrate legacy`)",
      ],
      ["--hook <path>", "Read the pre-iteration hook from one declared path (`migrate legacy`)"],
      [
        "--write",
        "Write the migration proposal to the project-committed document (`migrate legacy`)",
      ],
    ],
    [
      "<binary> provider resolve",
      "<binary> provider quota --provider coding-plan",
      "<binary> provider watch status --json",
    ],
    "provider",
  ),
  entry(
    ["provider", "resolve"],
    "Resolve one chain decision and persist its parks and announcements",
    ["<binary> provider resolve [--chain <name>] [--profile <name>]"],
    [
      ["--chain <name>", "Resolve one declared chain instead of the default chain"],
      ["--profile <name>", "Scope the resolution to one named profile's providers"],
    ],
    ["<binary> provider resolve", "<binary> provider resolve --profile mixed --json"],
    "provider",
  ),
  entry(
    ["provider", "quota"],
    "Evaluate quota conditions for one provider or the default chain without writing state",
    ["<binary> provider quota [--provider <name>]"],
    [["--provider <name>", "Evaluate one declared provider instead of the default chain"]],
    ["<binary> provider quota", "<binary> provider quota --provider coding-plan --json"],
    "provider",
  ),
  entry(
    ["provider", "parks", "list"],
    "Read the active park projection, optionally including cleared and expired parks",
    ["<binary> provider parks list [--all] [--provider <name>]"],
    [
      ["--all", "Include cleared and expired parks"],
      ["--provider <name>", "Narrow the projection to one provider"],
    ],
    ["<binary> provider parks list", "<binary> provider parks list --all --json"],
    "provider",
  ),
  entry(
    ["provider", "profile", "resolve"],
    "Resolve the profile selection decision for an agent, optionally as the spawn env record",
    ["<binary> provider profile resolve [--agent <name>] [--for-spawn]"],
    [
      ["--agent <name>", "Select the seat for one agent instead of the preference chain"],
      ["--for-spawn", "Emit the validated model environment record for the spawn wrapper"],
    ],
    [
      "<binary> provider profile resolve",
      "<binary> provider profile resolve --agent reviewer --for-spawn --json",
    ],
    "provider",
  ),
  entry(
    ["provider", "watch", "status"],
    "Read the declared watch conditions and their observation freshness",
    ["<binary> provider watch status [--provider <name>]"],
    [["--provider <name>", "Read one declared watch target instead of every target"]],
    ["<binary> provider watch status", "<binary> provider watch status --json"],
    "provider",
  ),
  entry(
    ["provider", "simulate"],
    "Replay a resolution from one bounded fixture with zero state, credential, network, or spend effect",
    ["<binary> provider simulate --fixture <path>"],
    [["--fixture <path>", "The bounded simulation fixture to replay"]],
    [
      "<binary> provider simulate --fixture tmp/simulate.json",
      "<binary> provider simulate --fixture tmp/simulate.json --json",
    ],
    "provider",
  ),
  entry(
    ["provider", "migrate", "legacy"],
    "Read legacy provider profiles and the pre-iteration hook as compatibility input and emit a proposal",
    ["<binary> provider migrate legacy [--profiles-dir <dir>] [--hook <path>] [--write]"],
    [
      ["--profiles-dir <dir>", "Read legacy profiles from one declared directory"],
      ["--hook <path>", "Read the pre-iteration hook from one declared path"],
      ["--write", "Write the proposal to the project-committed configuration document"],
    ],
    [
      "<binary> provider migrate legacy",
      "<binary> provider migrate legacy --profiles-dir ./legacy/profiles --json",
    ],
    "provider",
  ),
];

const ALL_HELP: readonly HelpEntry[] = [ROOT_HELP, ...COMMAND_HELP];

const pathKey = (path: readonly string[]): string => path.join(" ");

/** Resolve the help entry for a command path, or `undefined`. */
export const helpEntryFor = (path: readonly string[]): HelpEntry | undefined => {
  const key = pathKey(path);
  const exact = ALL_HELP.find((candidate) => pathKey(candidate.path) === key);
  if (exact !== undefined) return exact;
  // A deeper spelling of a documented entry renders that entry: the `dep`
  // grammar's `add`/`remove` spellings have no separate help path (GH-292
  // F-7), so `queue dep add --help` shows the `queue dep` page that documents
  // all three accepted spellings.
  for (let end = path.length - 1; end > 0; end -= 1) {
    const parent = helpEntryFor(path.slice(0, end));
    if (parent !== undefined) return parent;
  }
  return undefined;
};

/** Every help entry, root first. */
export const allHelpEntries = (): readonly HelpEntry[] => ALL_HELP;

const withBinary = (text: string, brand: BrandIdentity): string =>
  text.replaceAll("<binary>", brand.binaryName);

/**
 * Render one help page with the five declared sections.
 *
 * The rendering is pure: the only dynamic fact is the injected binary name.
 */
export const renderHelp = (help: HelpEntry, brand: BrandIdentity): string => {
  const title =
    help.path.length === 0
      ? `${brand.binaryName} — ${help.summary}`
      : `${brand.binaryName} ${help.path.join(" ")} — ${help.summary}`;
  const usage = help.usage.map((line) => `  ${withBinary(line, brand)}`).join("\n");
  const options =
    help.options.length === 0
      ? "  (none)"
      : help.options.map(([flag, description]) => `  ${flag}  ${description}`).join("\n");
  const examples = help.examples.map((line) => `  ${withBinary(line, brand)}`).join("\n");
  const exitCodes = STANDARD_EXIT_CODES.map(([code, meaning]) => `  ${code}  ${meaning}`).join(
    "\n",
  );
  const seeAlso = help.seeAlso.map((target) => `  ${target}`).join("\n");
  return [
    title,
    "",
    "Usage:",
    usage,
    "",
    "Options:",
    options,
    "",
    "Examples:",
    examples,
    "",
    "Exit codes:",
    exitCodes,
    "",
    "See also:",
    seeAlso,
    "",
  ].join("\n");
};

/** Root help with the command families named explicitly. */
export const renderRootHelp = (brand: BrandIdentity): string => {
  const families = COMMAND_HELP.filter((help) => help.path.length === 1)
    .map((help) => `  ${help.path[0]}  ${help.summary}`)
    .join("\n");
  const base = renderHelp(ROOT_HELP, brand);
  return `${base}\nCommands:\n${families}\n`;
};
