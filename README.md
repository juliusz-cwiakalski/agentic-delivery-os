<p align="center">
  <a href="./assets/hero.png">
    <picture>
      <source srcset="assets/hero.webp" type="image/webp" />
      <img
        src="./assets/hero.png"
        alt="Agentic Delivery OS - Ship faster. Break less. AI-Native SDLC"
        width="880"
      />
    </picture>
  </a>
</p>

# Agentic Delivery OS

Turn AI from "chat assistance" into a repeatable, auditable delivery system:

ticket -> spec -> plan -> test plan -> code -> quality gates -> PR -> release

This repo is a practical reference implementation of a spec-driven workflow using OpenCode:

- Artifacts are first-class (versioned in Git), not trapped in chats.
- Deterministic quality gates define "done".
- The workflow is tracker-agnostic: the tracker owns status, Git stores the delivery artifacts.

## Why this exists

AI can generate code quickly, but most teams struggle to use it reliably at scale:

- Prompts live in DMs and chat logs (not versioned, not repeatable)
- Output quality varies day-to-day ("prompt roulette")
- Delivery still needs specs, acceptance criteria, test strategy, reviews, docs, release discipline
- Tooling glue work persists between Jira/Git/CI/docs

Agentic Delivery OS codifies a predictable pipeline where quality and traceability are non-negotiable.

## What this gives you

- A small "virtual team" of repo-local OpenCode agents aligned to SDLC roles (PM, spec writer, planner, executor, reviewer).
- A standard artifact set (spec, implementation plan, test plan) stored under `doc/changes/` using stable, tracker-linked names.
- Commands that compose those agents into repeatable workflows (manual or autopilot).

## Benefits

- Less ambiguity: specs and test plans are explicit before code is written.
- Higher trust: reviews and gates run against artifacts, not vibes.
- Faster iteration: agents can find the right context deterministically (stable paths, no global indexes).
- Better auditability: tickets link to change folders, branches, PR descriptions, and logs.

## Intention (why I use this)

I use this repo to evolve and validate an AI-native delivery operating model on real work: reduce "prompt roulette", keep humans accountable, and make shipping faster without lowering quality.

## Docs at a glance

- How to use the agents/commands: [doc/guides/opencode-agents-and-commands-guide.md](doc/guides/opencode-agents-and-commands-guide.md)
- Change folder + naming convention (workItemRef, branches, files): [doc/guides/unified-change-convention-tracker-agnostic-specification.md](doc/guides/unified-change-convention-tracker-agnostic-specification.md)
- Broader docs layout standard (some details may differ per repo): [doc/documentation-handbook.md](doc/documentation-handbook.md)

## What is implemented here

OpenCode tooling (see the main README for the authoritative list):

- Agents for common SDLC roles: `@pm`, `@delivery-agent`, `@spec-writer`, `@plan-writer`, `@test-plan-writer`, `@executor`, `@reviewer`, `@doc-syncer`, `@pr-manager`, `@runner`, `@fixer`, `@committer`, `@architect`, `@editor`, `@designer`, `@image-reviewer`.
- Commands that compose them into a repeatable workflow: `/plan-change`, `/write-spec`, `/write-plan`, `/write-test-plan`, `/run-plan`, `/review`, `/review-deep`, `/sync-docs`, `/check`, `/check-fix`, `/pr`, `/commit`, `/plan-decision`, `/write-adr`.

## Typical workflow (manual)

For the detailed walkthrough, see [doc/guides/opencode-agents-and-commands-guide.md](doc/guides/opencode-agents-and-commands-guide.md). The common flow is:

```text
/plan-change <workItemRef?>
/write-spec <workItemRef>
/write-plan <workItemRef>
/write-test-plan <workItemRef>
/run-plan <workItemRef>
/review <workItemRef>
/sync-docs <workItemRef>
/check
/pr
```

## Change artifacts (tracker-agnostic)

Changes are identified by `workItemRef` (for example `PDEV-123` for Jira or `GH-456` for GitHub). Artifacts live under:

- `doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/`
- Stable filenames inside the folder:
  - `chg-<workItemRef>-spec.md`
  - `chg-<workItemRef>-plan.md`
  - `chg-<workItemRef>-test-plan.md`

Branches follow conventional-commit-aligned types:

- `<type>/<workItemRef>/<slug>` (for example `feat/PDEV-123/responsive-recipes-images`)

## Repo structure

```
.
├── .opencode/        # OpenCode agents and commands (repo-local tooling)
└── doc/
    ├── guides/       # how-to guides (OpenCode workflow, naming conventions)
    └── documentation-handbook.md
```

## License

Open-source. See [LICENSE](LICENSE).

## Author

Maintained by Juliusz Ćwiąkalski. If you find this useful, follow me or drop by my homepage (blog + newsletter):

- LinkedIn: [@juliusz-cwiakalski](https://www.linkedin.com/in/juliusz-cwiakalski/)
- X: [@cwiakalski](https://x.com/cwiakalski)
- Website (blog + newsletter): https://www.cwiakalski.com
