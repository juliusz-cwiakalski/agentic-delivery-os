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

/** Every prompt-required command and subcommand help page. */
export const COMMAND_HELP: readonly HelpEntry[] = [
  entry(
    ["status"],
    "Collect the nine-section delivery digest",
    ["<binary> status [--repo <path>]"],
    [["--repo", "Target repository path (repeatable)"]],
    ["<binary> status", "<binary> status --json", "<binary> status --repo . --json"],
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
      "<binary> queue <list|plan|add|prioritize|dep|claim|release|remove> [options]",
      "<binary> queue dep [add|remove] <ref> <on-ref>",
    ],
    [
      ["--next <n>", "Limit the planned next actions"],
      ["--priority <n>", "Set or filter entry priority"],
      ["--dep <ref>", "Declare a dependency edge"],
      ["--holder <id>", "Claim or release holder identity"],
      ["--park <cause>", "Park a released entry with a condition"],
      ["--until <iso>", "Provider-window expiry for a park"],
      ["--reason <reason>", "Removal reason: landed | abandoned | superseded | reconciled"],
      ["--watch", "Watch the queue (requires the resident daemon)"],
    ],
    [
      "<binary> queue list",
      "<binary> queue plan --next 3",
      "<binary> queue add GH-242",
      "<binary> queue remove GH-242 --reason abandoned",
      "<binary> queue dep add GH-243 GH-242",
      "<binary> queue dep remove GH-243 GH-242",
    ],
    "queue",
  ),
  entry(
    ["queue", "list"],
    "List observed queue entries",
    ["<binary> queue list"],
    [],
    ["<binary> queue list", "<binary> queue list --json"],
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
    ],
    [
      ["--harness <name>", "Harness adapter (opencode, claude-code); default from config"],
      ["--resume-prompt <text>", "Resume the existing lane with guidance"],
      ["--ref <ref>", "Work item reference to inspect; default is the active change"],
      ["--limit <n>", "Page size, 1..100 (default 20)"],
      ["--repo <repo>", "Repository identity for summary and handover"],
      ["--note <text>", "Bounded divergence-resolution note"],
      ["--revert", "Revert a recorded handover to dual-run"],
    ],
    [
      "<binary> dispatch GH-242",
      "<binary> dispatch GH-242 --harness claude-code",
      "<binary> dispatch attempts --ref GH-242 --limit 5",
      "<binary> dispatch dual-run summary --repo github.com/owner/repo",
      '<binary> dispatch dual-run resolve DIV-1 --note "tracker was stale"',
      "<binary> dispatch handover github.com/owner/repo --revert",
    ],
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
    ["<binary> spend [--ref <ref>] [--phase <phase>] [--amplification]"],
    [
      ["--ref <ref>", "Work item ref"],
      ["--phase <phase>", "Lifecycle phase"],
      ["--amplification", "Render the amplification view"],
    ],
    ["<binary> spend --ref GH-242", "<binary> spend --amplification --json"],
    "spend",
  ),
  entry(
    ["retro"],
    "Collect and report retro evidence",
    ["<binary> retro <collect|report> [--level <name>]"],
    [["--level <name>", "Retro level (change, milestone, release)"]],
    ["<binary> retro collect", "<binary> retro report --level milestone"],
    "retro",
  ),
  entry(
    ["retro", "collect"],
    "Collect retro evidence",
    ["<binary> retro collect [--level <name>]"],
    [["--level <name>", "Retro level"]],
    ["<binary> retro collect --level change"],
    "retro",
  ),
  entry(
    ["retro", "report"],
    "Render a retro report",
    ["<binary> retro report [--level <name>]"],
    [["--level <name>", "Retro level"]],
    ["<binary> retro report --level milestone"],
    "retro",
  ),
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
    summary: "One overview of every delivery-managed checkout on the host",
    usage: ["<binary> projects <list> [options]"],
    options: [...GLOBAL_OPTIONS],
    examples: ["<binary> projects list", "<binary> projects list --json"],
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "projects")],
  },
  {
    path: ["projects", "list"],
    summary: "List every discovered project with its state and health",
    usage: ["<binary> projects list [options]"],
    options: [...GLOBAL_OPTIONS],
    examples: ["<binary> projects list", "<binary> projects list --json"],
    seeAlso: [pageIn(M2_REFERENCE_ROOT, "projects")],
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
