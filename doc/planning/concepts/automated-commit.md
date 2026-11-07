---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/automated-commit.md
---
# Concept: automated commit

Status: Draft (2026-11-03). Feeds M1-S14 (commit primitive and
phase-transition commits). Owner decisions recorded 2026-11-03:
deterministic skeleton + AI flesh; both inference transports behind a
seam; template fallback, marked; body presence decided by the model.

## Summary

Committing becomes a tool capability: a deterministic script collects
context, computes everything verifiable (work-item ref, type candidate,
scope, staging set, forbidden-path exclusions, secret scan), and makes
exactly one constrained model call for the parts that need language —
the subject and, only when it earns its place, the body. The commit
never runs inside a delivery session. Prior-art evidence
(single-call CLIs, gptcommit, CommitLLM) supports the architecture;
diff budgets carry evidence-based defaults pending validation against
real commits.

## Motivation

- The commit process is a typed primitive today (the `commit` command, with the thin `@committer` as an executor):
  a large system prompt plus a tool loop of 8-12 git round-trips with
  diff output echoing through context every turn — roughly 15-50k
  tokens per commit, plus dispatch overhead from the calling session,
  plus latency.
- The mechanical majority of that spend buys nothing: ref resolution,
  type, scope, staging, safety scans, and the commit itself are all
  deterministic decisions. Only the natural-language message needs a
  model.
- M1-S14 already fixes the mechanics (precise staging, atomic
  record-plus-commit with phase completion, idempotent re-run,
  commitlint respect) but leaves the message-generation policy open;
  this concept is that policy.

## Prior art and evidence (surveyed 2026-11-04)

- Single-call CLIs (aicommits, opencommit, AI Commit): send the staged
  diff to one model call, return a structured/conventional message.
  OpenCommit adds configurable token limits, prompt modules (including
  a conventional-commit generator module), and local models via
  Ollama. Confirms the one-call shape is the proven mainstream.
- gptcommit (git prepare-commit-msg hook, Rust): issues N+2 prompts —
  one summary per modified file (diff under a per-file token cap, at
  most four concurrent; a failed summary stops generation rather than
  silently omitting the file) plus title and compose prompts. Default
  model is a low-reasoning cheap tier with a 2,048-token cap shared by
  reasoning and output per request; empty or fully ignored staged
  changes make no API call at all; a deterministic `file_ignore`
  pattern list (lockfiles, minified files) removes generated noise
  before any model sees it.
- CommitLLM (arXiv 2607.17532): three-stage pipeline — fine-tuned
  small model, constrained decoding (max_new_tokens=20, temperature
  0.1, repetition penalty 1.1), deterministic post-processing (first
  line only, conversational-prefix stripping, type checked against a
  fixed set). Result: 98% format compliance vs 22% for the raw model;
  every output under 72 characters. Headline finding: the
  deterministic layers contributed more to quality than fine-tuning
  (+1.48 vs +0.23 LLM-judge points) — engineering the system around
  the model beats engineering the model. Documented failure mode:
  plausible-but-fabricated issue IDs leaking into subjects, with a
  regex filter as the recommended fix.
- Harness-native (OpenCode, Claude Code): commit-message generation
  runs as an in-session or subagent pattern that pays session context
  and project prefill; no established cheaper native path exists.
  Supports core-direct transport first, harness one-shot as fallback.
- Local/fine-tuned tiny models (CommitLLM, community Ollama fine-tunes)
  are a viable zero-API-key lane later; they slot into the provider
  route's lite class rather than changing this design.

## Design

Flow (steps 1-2 and 4-7 are deterministic; step 3 is the only AI step):

1. Collect: workItemRef (branch then change folder), current phase,
   plan-phase data (declared scope + summary from the M1-S13 plan
   schema), `git status --porcelain=v2`, name-status, numstat,
   budget-capped diff hunks (top-N changed files, total token budget),
   last 5 commit subjects for tone. Generated noise (lockfiles,
   minified files, vendored code) is removed deterministically before
   any model sees the bundle (gptcommit's `file_ignore` pattern);
   files whose diff exceeds the per-file cap contribute name-status
   and numstat only. Empty or fully-excluded changes make no model
   call at all.
2. Skeleton: type candidate from a phase/type table (delivery -> feat,
   review_fix -> fix, docs sync -> docs, ...), scope = workItemRef,
   breaking flag default false. Commitlint configuration consulted;
   repo rules win.
3. Flesh: ONE model call with the context bundle; JSON-schema-
   constrained output `{subject, body?, breaking}`. The model may omit
   the body when the header already explains the change to an auditor;
   it must include one when there is content an auditor needs.
   Type/scope/ref are given, not asked. Decoding is constrained the
   CommitLLM way: low temperature (<= 0.1) and a hard output-token
   cap sized to the schema (subject <= 72 characters, body capped) —
   worst-case output, not average quality, decides whether such a
   tool survives production use.
4. Validate: commitlint plus deterministic checks (ref matches the
   resolved ref; type in the allowed list; no invented refs). The
   deterministic layer owns the format, the model owns the semantics —
   post-processing slices to the schema shape and strips
   conversational filler, and any fabricated tracker reference in
   subject or body is removed mechanically (CommitLLM's documented
   hallucinated-issue-ID failure mode). One retry with the lint error
   fed back; second failure falls back to the template.
5. Safety (never AI): secret scan on staged content and filenames;
   forbidden-path exclusions (`tmp/`, `.ai/local/`); binary size
   guard. STOP classified on suspicion.
6. Stage precisely and commit: never untracked strays; atomic
   record-plus-commit for phase transitions (ledger flip and commit
   land together or neither); idempotent re-run converges.
7. Emit: commit SHA, message source (`model|template`), transport
   used, token spend as a telemetry event (feeds M1-S19 spend reads).

Inference transport seam — the single model call runs behind a
transport interface with two implementers, tried in order:

1. Core-owned inference via the provider engine: direct call from the
   typed core, no harness session. Cheapest (~1-5k tokens). Used when
   an API key path is configured for the provider route.
2. Harness one-shot: `opencode run` (or the Claude Code headless
   equivalent) in a temporary empty project directory, so no delivery
   session or project context is loaded. Reuses coding-plan
   subscription auth where no plain API key exists. Costs session
   bootstrap (~5-15k tokens) but needs no new credentials.

Selection is configuration plus capability discovery, not code.
Failover core -> harness -> template is classified in the emitted
event.

Fallback (no AI available: quota park, no key, provider down): commit
with the deterministic template message
`<type from table>(<ref>): <plan-phase summary or top-path summary>`.
The telemetry event carries `message-source=template` so message
quality remains auditable and template share is measurable over time.
Delivery never stalls on a commit.

Token economics (target): today ~15-50k tokens per commit (subagent
loop); target ~1-5k (single constrained call, direct transport) with
output bounded by the JSON schema (subject <= 72 characters, body
capped); zero-AI mode always available. Reference point: gptcommit's
default request shape is a 2,048-token cap per request on a
low-reasoning cheap tier — a working proof that small request budgets
on cheap models produce usable commit messages, though it pays N+2
requests per commit where this design pays one.

## Guardrails

- Exactly one AI touch per commit, and only for subject/body/breaking;
  everything verifiable is computed, never generated.
- Safety checks (secrets, forbidden paths, binary guard) are
  deterministic and never delegated to the model.
- The model receives type/scope/ref; it cannot produce them. Invented
  refs or off-list types fail validation and trigger the retry, then
  the template.
- A commit message is always produced, even with zero AI available;
  message source is recorded so the fallback is visible, not silent.
- The commit never runs inside a delivery session; callers invoke the
  tool (`commit` or `phase complete`).

## Story mapping

- M1-S14: this concept is the message-generation policy for the commit
  primitive; the story owns the mechanics (staging, atomicity,
  idempotence, commitlint).
- M1-S13: the plan schema supplies per-phase scope and summaries — the
  deterministic skeleton's highest-signal input.
- M0-S13: the provider engine is the core-owned transport and the
  quota/park states that trigger fallback.
- M1-S11: the harness one-shot transport rides the harness adapter
  surface.
- M1-S19: spend reads consume the per-commit token and
  message-source events.
- model-profiles.md: the commit call is a natural `lite` profile
  class task once ModelPolicy is typed (M2).

## Open questions

- Diff budget numbers: proposed evidence-based defaults — total input
  budget ~4-8k tokens, per-file diff cap ~1-2k tokens with
  name-status fallback for over-cap files, top-N files fully diffed
  (N ~ 10); validate against real repository commits during M1-S14
  delivery.
- Whether the per-file-summary fan-out (gptcommit's N+2 shape) is
  ever worth its extra calls for very large mixed commits, or whether
  plan-phase data plus a capped diff suffices; revisit only if
  single-call quality disappoints (relates to the parked
  MultiModelFanout research candidate).
- Whether the phase/type table lives in the plan schema, project
  configuration, or core defaults.
- How `message-source` participates in quality gates: template-share
  ceiling per change, per fleet, or report-only (start report-only,
  feed M1-S19).
- Whether the harness one-shot transport needs a dedicated
  HarnessSession mode (headless, empty project) or stays a CLI-level
  detail.
