---
change:
  ref: GH-230
  type: feat
  status: Proposed
  slug: typed-blockers
  title: "M1-S16: Typed blocker and question channel"
  owners: [engineering]
  service: delivery-os
  labels: [m1, blockers, coordinator, attention-plane]
  version_impact: minor
  audience: internal
  security_impact: high
  risk_level: medium
  dependencies:
    internal:
      - "State layer (M0-S5, GH-174, delivered) — append-only schema-versioned ledger, verified reads, verified-empty evidence, single-writer fences, torn-state classification; substrate for question and answer records"
      - "Owner-gate SLA (M1-S5, GH-229, delivered) — owner|coordinator audience seam, policy-as-data precedent, deterministic rank-key/bounds/truncation precedent"
      - "Lane contracts (M1-S1, GH-221, delivered) — lane vocabulary and the injected lane reader behind `--lane <id>`"
      - "Status digest (M0-S6, GH-175, delivered) — fixed-section vocabulary, five-value section states, closed reason set, bounds, evidence model"
      - "Brief (M1-S6, GH-228, delivered) — nine-surface totality, closed placeholder catalog, anchored-action groups; placeholder retirement is this change's contract edit"
      - "Result contract and error table — CommandResult envelope, DOMAIN_KINDS union, documented/machine/fixture sync gate, redaction chokepoint with the registered-secrets record"
      - "Branding seam — injected brand binary name and the naming discipline for environment-resolved facts"
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Replace prose-and-silence lane blockers with a typed, ranked, answerable question channel — every question routed by audience, credential values structurally refused, answers landing as data that projects the lane's resume path — so lane-idle hours convert into answer-and-resume seconds.

## 1. SUMMARY

This change delivers the M1-S16 typed blocker and question channel: a blocked lane publishes a typed question (`decision-needed` with options, `spec-ambiguity`, `credential-missing` with variable name only, `external-wait`) as a durable state record instead of stalling in prose. Every question carries an `audience` field (`owner` | `coordinator`) that routes answers; a cross-audience answer is refused with the delegation policy named unless policy-as-data explicitly delegates (the confused-deputy guard). The channel refuses credential values on every content path — questions and free-text answers alike carry the variable name, never the value. The `blockers` command surface (`list`, `answer`, `publish`) per the man page records answers as intent records in state together with a `laneResume` projection (`boundary-note`, `attach-continue`, or `resume-prompt-reentry` as the acknowledged fallback when the harness adapter lacks resume injection, its prefill cost visible). Questions rank by age and priority in one shared ranking consumed identically by the blockers list, the status digest, and the brief — replacing the brief's `typed-questions` named placeholder — and the coordinator pickup contract (wake or next-iteration trigger on a top-of-digest coordinator-audience question; no question waits on the daily brief) is declared here, with enforcement owned by M1-S23.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The owner-gate SLA (M1-S5, GH-229, delivered) established the escalation mechanism with an explicit audience dimension (`owner` | `coordinator`) designed so this change adds the coordinator audience without redesign; it also fixed the policy-as-data pattern (the PDR-0003 two-row default map), the deterministic rank-key discipline (severity class → oldest → id), declared truncation, and the render bounds this channel reuses.
- The state layer (M0-S5, GH-174, delivered) provides the append-only, schema-versioned JSONL ledger, verified reads, verified-empty evidence, single-writer fences, atomic derived-document replace, and torn-state classification — the substrate for durable question and answer records. Additive record kinds inside `delivery.state.v1` are an established, repeatable pattern (provider parks, closeout operations, owner-gate decisions).
- The status digest (M0-S6, GH-175) renders six fixed sections over closed vocabularies with a five-value section state and declared bounds; section failures are payload data, not envelope errors. The brief (M1-S6, GH-228) mirrors those sections plus a closed three-entry placeholder catalog; the `typed-questions` placeholder (owning story M1-S16) is today's only blocker surface — a named `not-delivered` line, never empty, never zero.
- The result contract provides the `CommandResult` envelope, the machine-readable error table with two fallback containment entries, the `{0, 1, 2}` CLI exit projection, the documented/machine/fixture sync gate, and the single redaction chokepoint over the registered-secrets record injected at the runtime-aware edge.
- The lane contracts (M1-S1, GH-221) fix the lane vocabulary and the injected lane reader; the scheduling engine, resident daemon, coordinator supervision, and agent integration that will consume this channel do not exist yet (M1-S17, M1-S18, M1-S23, M1-S20 — all open), and neither do the harness adapters that declare resume capabilities (M1-S11, open) or the invocation audit ledger with its agent-identity convention (M1-S22, GH-223, open).
- The M1 planning pack designates `blockers` as "M1 planned (M1-S16). Proposed contract": a typed question channel that publishes to the state layer, ranks in the digest and brief within one collection cycle, and answers as data so lanes resume without re-entering delivery sessions. The architecture map places it on the attention plane beside the digest, brief, and board SLA ranking, and its intent table records "blocker questions and answers, resume notes" as command-written intent that the daemon consumes.

### 2.2 Pain Points / Gaps

- **Blockers stall in prose and silence**: a blocked lane has no typed, machine-readable record of what question is blocking it, who must answer it, or what answers would unblock it — the blocker lives in session prose and dies with the session.
- **No audience routing**: nothing prevents a coordinator-side actor from answering a question addressed to the owner (the confused-deputy hazard), and no delegation policy exists that names who may answer what.
- **Credential leakage path**: a `credential-missing` ask invites the human to paste the secret itself into a question or answer; nothing structurally refuses credential values on any content path.
- **No answer-as-data path**: even when an answer arrives, there is no durable record of it and no recorded projection of how the lane resumes (attach, note at boundary, or full re-entry), so unblocking requires re-entering a delivery session by hand.
- **No ranking or attention surface**: questions do not appear in the digest or the brief, so lane-idle hours are wasted until a human happens to look; the brief renders only a named `not-delivered` placeholder.
- **No pickup contract**: nothing declares when a published question must wake the coordinator, so the wake behavior M1-S23 must enforce has no contract to enforce.

## 3. PROBLEM STATEMENT

Because a blocked lane has no typed, audience-routed, credential-safe question record — no durable question, no routing rule that refuses the wrong answerer, no value-refusing guard on the content paths, no answer-as-data record with a projected lane resume, and no ranked surface in the digest or brief — lane-idle hours are wasted until a human happens to look, answers cannot be applied as data without re-entering delivery sessions, credential values risk transiting a persisted channel, and a coordinator-side actor can silently answer a question addressed to the owner, resulting in stalled deliveries, wasted prefill, authority confusion, and secret exposure risk.

## 4. GOALS

- **G-1**: Every lane blocker publishes as a typed question record persisted in durable state — never as prose, never as silence (ticket AC: types validated; digest surfacing within one collection cycle).
- **G-2**: Every question carries an `audience` field and answers are routed by it: a cross-audience answer is refused with the delegation policy named, unless policy-as-data explicitly delegates (ticket AC; confused-deputy guard).
- **G-3**: Credential values never transit the channel: `credential-missing` questions and their answers carry the variable name and never a value, and the channel refuses values on every content path (ticket AC).
- **G-4**: An answer is a data record in state that projects the lane's resume path (`laneResume` mode recorded per answer), resuming the lane without session re-entry where the harness adapter declares resume injection, and recording the declared re-entry fallback with its prefill cost visible when it does not (ticket AC, conditioned on the adapter capability flag).
- **G-5**: Questions rank by age and priority through one shared ranking consumed identically by the blockers list, the status digest, and the brief — the brief's `typed-questions` named placeholder retires; ranking is never forked per surface.
- **G-6**: The coordinator pickup contract is declared — a coordinator-audience question ranked top-of-digest triggers coordinator wake or the next coordinator iteration, and no question waits on the daily brief — with enforcement owned by M1-S23 (declared here, not enforced here).

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Published blockers visible in the digest and brief ranking on the first collection after publish | 100% (v0: every `status`/`brief`/`blockers list` invocation is a collection; the one-cycle bound is structural, daemon interval later) |
| Questions carrying a valid `audience` field from the closed set | 100% (publish without a valid audience is impossible) |
| Cross-audience answers applied | 0 (100% refused with the delegation policy named, exit 1, not_landed, question stays open) |
| Credential values persisted or rendered by the channel | 0 (100% refused before landing on every content path) |
| Answers recorded with a `laneResume` mode from the closed three-value set | 100% |
| Surfaces (blockers list, digest section, brief anchor) disagreeing on question order over identical facts | 0 (one shared ranking) |
| Invalid question types accepted at publish | 0 (validated against the closed type set) |

> **v0 exercisability note:** mirroring the GH-229 production-posture precedent, the answer→resume path is fully exercisable over injected harness-adapter capability facts (fixtures and fakes); in the v0 production composition — no delivered harness adapters — the recorded `laneResume` mode is the `resume-prompt-reentry` fallback with its prefill cost visible, and the recorded application posture is `applied: false` until M1-S18/M1-S23 deliver the applying actors.

### 4.2 Non-Goals

- **NG-1**: Daemon application of answers and control-socket wake — M1-S18 (GH-238); this change records the intent the daemon will apply.
- **NG-2**: Coordinator supervision and wake enforcement — M1-S23 (GH-241); this change declares the pickup contract only.
- **NG-3**: The one-shot `dispatch --resume` path — M1-S9 (GH-239); lands with the dispatch story.
- **NG-4**: Delivering harness adapters or their resume-injection capability — M1-S11 (GH-233); the capability is consumed here as a declared, injectable fact.
- **NG-5**: The invocation audit ledger and caller-identity capture — M1-S22 (GH-223); this change resolves the answering audience through the branding-seam naming discipline without delivering audit.
- **NG-6**: Out-of-band delivery of questions (push, email, chat) — attention surfaces are the declared digest, brief, and list only.
- **NG-7**: MCP or host-integration mirrors of the channel — M1-S7 mirrors proven engines after delivery.
- **NG-8**: Configuration keys for question types, priorities, delegation, audiences, or bounds — all contract data, never operator-tunable config.
- **NG-9**: Any change to owner-gate SLA mechanics or the board — the board remains the owner-gate surface (see DEC-10).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Typed question records persisted via the state layer | The blocker must survive the session that raised it: durable, verified-readable, torn-classified — never prose. |
| F-2 | Question-type validation and per-type answer channels | A mistyped or malformed question/answer must be refused at the door, deterministically. |
| F-3 | Credential guard on every content path | Credential values must never transit or persist in the channel; names only, on questions and answers alike. |
| F-4 | Audience routing with the confused-deputy guard | The wrong answerer must be structurally refused, with the delegation policy named; policy-as-data may explicitly delegate. |
| F-5 | Answer-as-data intent records with the `laneResume` projection | An answer must be a durable record projecting the resume path — no session re-entry where capability allows, fallback cost visible when not. |
| F-6 | Shared ranking with digest and brief integration (placeholder retirement) | Questions must surface ranked, identically ordered on every attention surface, within one collection cycle. |
| F-7 | `blockers` command surface (list, answer, publish) | The man-page contract: bounded, deterministic, envelope-projected, brand-neutral. |

### 5.1 Capability Details

- **F-1 — Typed question records.** Publishing persists one typed question record as an additive record kind in the state layer (EVT-1, DM-1): question id (`q-` prefix plus an opaque generated suffix, unique per store), closed question type, audience, lane id, optional work-item ref, the question text, the ordered options for option-bearing types, the asked-at timestamp, and derived open/answered status (derived at read time from answer presence, never a stored flag). Reads are verified; a verified-empty store is a legitimate empty ranking, and a torn, wrong-kind, or malformed history is classified state failure — never served as truth, never zeroed silently. Questions are immutable once published; closure is derived, never rewritten.

- **F-2 — Type validation and answer channels.** The question type set is closed at exactly four values (DM-5): `decision-needed` (carries ordered options), `spec-ambiguity`, `credential-missing` (carries the variable name only), `external-wait`. Publish validates the type against the closed set and refuses an unknown type (`blockers.invalid-type`, exit 1). Each type admits exactly one answer channel: an options-bearing `decision-needed` is answered by `--choice <n>` (1-based index into the published options; the answer records the selected option value), the other three by `--text` (bounded free text). A choice on an options-less question, text where a choice is required, an out-of-range choice index, or an answer to an already-answered question is refused with the delivered `input.value.rejected` identity (exit 1, not_landed) naming the violation.

- **F-3 — Credential guard (layered, precise, testable).** Two declared layers, both contract data, both evaluated before any record lands (NFR-6): **Layer 1 — whole channel:** any content path (question text, option values, free-text answer) that contains a registered secret value — the same registered-secrets record the serialization redaction chokepoint uses — is refused with `blockers.credential-value-rejected`, exit 1, consequence `not_landed`, zero persisted bytes. **Layer 2 — `credential-missing` questions:** the question text must match the declared variable-name shape (a name-pattern contract datum); anything beyond a name-shaped reference is refused, so a credential-missing question carries the variable name and nothing else. The refusal remediation hint states the contract: credential questions carry the variable name only; the value comes from the environment.

- **F-4 — Audience routing and the confused-deputy guard.** Every question carries an audience from the closed set `owner` | `coordinator` (DM-5); publish validates it and defaults to `coordinator` when the flag is absent (DEC-3). `blockers answer` resolves the answering audience from an injected caller-audience fact (DEC-4) and consults the delegation policy-as-data map (DM-4): the initial policy allows an owner identity to answer coordinator-audience questions and refuses a coordinator identity answering owner-audience questions with "delegation policy: none". A refused answer yields `blockers.audience-mismatch`, exit 1 (pinned by SC-M1-24), category user, consequence `not_landed`, with a remediation hint naming the question's audience and the delegation policy row consulted — and the question remains open, no answer record applied.

- **F-5 — Answer-as-data with the `laneResume` projection.** An accepted answer persists one answer intent record (EVT-2, DM-2): question id, answering audience, the answer substance (selected option value or bounded text), answered-at time, and the `laneResume` projection (DM-3) — one authoritative answer per question id (F-2 refuses a second). The projection is computed from the declared resume-injection capability of the harness adapter, an injectable fact: a capability-declaring adapter yields `boundary-note` or `attach-continue` (no session re-entry), and the absence of the capability yields `resume-prompt-reentry`, the acknowledged fallback, with `sessionReentry: true` and the prefill cost visibly marked on the payload and human line. The projection is recorded with the answer, never executed here: the applying actors (daemon M1-S18, coordinator M1-S23, `dispatch --resume` M1-S9) are downstream consumers of the recorded intent. The answer envelope carries `applied` — the declared application posture, `false` at answer time in v0 (DEC-5) — so the recorded-versus-applied boundary is explicit on every payload.

- **F-6 — Shared ranking with digest and brief integration.** Open questions rank by one shared, pure ranking — priority class first (type-derived, contract data), then oldest asked-at, then question id ascending (DEC-7) — consumed identically by three surfaces; answered questions never interleave (they render after all open ones, age order). The status digest gains a dedicated `typed-questions` section in the fixed section order (state-sourced; the standard five-value section state; the closed reason set reuses `state-unreadable` for a failed or torn store read — never a fabricated question, never an exit-2 command failure, per the digest's section-failures-are-payload-data discipline). The brief mirrors the section on its stable `typed-questions` surface id, the `typed-questions` placeholder retires from the closed placeholder catalog (3 → 2 entries), and the `blocker-questions` anchored-action group becomes a real ranked group in the decision-first anchor order. Every surface renders the audience and rank per question, and truncation is declared with an omitted count under the shared bounds. In v0 every `status`/`brief`/`blockers list` invocation reads the store directly, so a published question surfaces on the first subsequent invocation — the one-collection-cycle bound holds structurally; M1-S18's periodic collection later preserves the same bound (DEC-6).

- **F-7 — `blockers` command surface.** The command is `blockers` with exactly three subcommands per the man page: `list [--open]` (default renders all records ranked — open ranked by F-6, answered in a resolved group after; `--open` restricts to open), `answer <id> [--choice <n>] [--text <text>]`, and `publish <type> --lane <id> "<question>" [--options a,b] [--audience owner|coordinator]` (the audience flag refines the proposed pack synopsis; DEC-3). Text mode renders ranked question lines with declared truncation; machine mode returns the standard `CommandResult` envelope whose `data` carries `questions[]` (`id`, `type`, `audience`, `lane`, `ref`, `question`, `options[]`, `askedAt`, `age`, `rank`) on list and `answered`, `audience`, the answer substance, `applied`, and `laneResume` on answer (DM-1..DM-3). Exit 0 listed or answered; exit 1 user/validation refusals (invalid type, unknown id — `blockers.unknown-id`, credential value, audience mismatch, malformed answer); exit 2 platform/state faults reusing the delivered `state.*` identities. All content and output are bounded (NFR-4) and brand-neutral: the binary name comes from the branding configuration; no product literal is committed.

## 6. USER & SYSTEM FLOWS

```
Flow 1: a blocked lane publishes instead of stalling
  lifecycle agent, mid-phase, lane L5 blocked on a choice
    → <binary> blockers publish decision-needed --lane L5 --audience coordinator
      "closeout residue sweep: full or lite?" --options full,lite+escalation
    → type validated, credential guard evaluated, audience validated
    → question record appended to the state ledger → q-8f41 published, exit 0
    → next status/brief/blockers-list invocation: ranked in the digest section
      and the brief blocker-questions anchor (one shared ranking)
```

```
Flow 2: answer as data, lane resumes at the boundary
  coordinator identity answers
    → <binary> blockers answer q-8f21 --choice 2 --json
    → question found (open), audience matches, no credential value in content
    → answer intent record + laneResume projection appended (EVT-2)
    → adapter declares resume injection → mode boundary-note, sessionReentry false
    → envelope: answered=q-8f21, audience=coordinator, choice=lite+escalation,
      applied=false (recorded, not yet applied by any actor), exit 0
    → M1-S18 daemon / M1-S23 coordinator later consume the recorded intent
```

```
Flow 3: confused-deputy refusal (SC-M1-24)
  question q-9043 addressed to audience owner; answering identity is coordinator
    → <binary> blockers answer q-9043 --choice 1
    → delegation policy consulted: no row delegates coordinator→owner
    → refused: blockers.audience-mismatch, exit 1, not_landed, hint names
      "audience owner … (delegation policy: none)" → question remains open
```

```
Flow 4: credential value refused on any content path
  → <binary> blockers publish credential-missing --lane L4 "GITHUB_TOKEN"
  → layer 2: text is name-shaped → accepted (name only, no value)
  → a publish or answer whose text carries a registered secret value
    → refused: blockers.credential-value-rejected, exit 1, not_landed,
      zero persisted bytes — the value never transits the channel
```

```
Flow 5: pickup contract (declared here; enforced by M1-S23)
  coordinator-audience question ranked top-of-digest
    → the digest payload exposes audience + rank per question (machine-determinable
      predicate: rank 1 of the typed-questions ranking carries audience coordinator)
    → M1-S23 wakes the coordinator or triggers its next iteration on that predicate
    → no question waits on the daily brief (the digest is the pickup surface)
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Typed question records persisted via the state layer over the closed four-type vocabulary, with validated publish input, derived open/answered status, and torn/verified-empty read classification.
- The `blockers` command surface per the man page: `list [--open]`, `answer <id> [--choice <n>] [--text <text>]`, `publish <type> --lane <id> "<question>" [--options a,b]` plus the audience flag refinement; standard envelope, exit projection, bounded deterministic rendering.
- The audience field on every question (`owner` | `coordinator`), publish default `coordinator`, and answer routing with the confused-deputy guard: cross-audience refusal with the delegation policy named, policy-as-data delegation exception, `blockers.audience-mismatch` pinned exit 1 (SC-M1-24).
- The credential guard on both question and free-text answer paths: layered registered-secret-value refusal (whole channel) and the variable-name-shape rule (`credential-missing` questions), refuse-before-land, exit 1, `not_landed`.
- Answer validation per type (choice channels for options-bearing questions, text channels otherwise) and one authoritative answer per question id.
- Answer intent records in state with the `laneResume` mode recorded per answer (`boundary-note`, `attach-continue`, `resume-prompt-reentry`), the capability-flag conditioning, the visible prefill-cost marking on the fallback, and the explicit recorded-versus-applied posture (`applied: false` in v0).
- One shared ranking (priority class → oldest → id) consumed identically by the blockers list, a new digest `typed-questions` section, and the brief's real `blocker-questions` anchored-action group; the `typed-questions` placeholder retiring from the brief's closed catalog; declared truncation everywhere.
- The declared coordinator pickup contract: top-of-digest coordinator-audience question triggers coordinator wake or next iteration; no question waits on the daily brief (declaration only; enforcement is M1-S23's).
- The error family: new `blockers` domain kind with exactly `blockers.invalid-type`, `blockers.unknown-id`, `blockers.credential-value-rejected`, `blockers.audience-mismatch`; documented/machine/fixture error-table sync stays green.
- Declared unavailability posture: failed or torn state reads surface as the digest section's `state-unreadable` evidence or the command's exit-2 `state.*` identity — never a fabricated question, never silent.

### 7.2 Out of Scope

- [OUT] Daemon application of answers and control-socket wake — M1-S18 (GH-238); the daemon consumes the recorded intent.
- [OUT] Coordinator supervision and wake enforcement of the pickup contract — M1-S23 (GH-241).
- [OUT] The one-shot `dispatch --resume` path — lands with the dispatch story (M1-S9, GH-239).
- [OUT] Delivering real harness adapters or their resume-injection capability — M1-S11 (GH-233); real-data answer→resume activation is conditioned on that capability flag, mirroring the GH-229 v0 production-posture precedent.
- [OUT] The invocation audit ledger and caller-identity capture — M1-S22 (GH-223); this change consumes the branding-seam naming discipline only and records no audit ledger.
- [OUT] Out-of-band question delivery (push, email, chat) or any notification broadcast.
- [OUT] MCP or host-integration mirrors of the channel — M1-S7.
- [OUT] Configuration keys for types, priorities, delegation maps, audiences, or bounds — contract data only.
- [OUT] Changes to owner-gate SLA mechanics, the board, or the SLA policy map (DEC-10).

### 7.3 Deferred / Maybe-Later

- Rendering owner-gate asks as blocker-channel records (one screen for both audiences) — deferred to the M2-S4 fleet-grid context; the board remains the owner-gate SLA surface (DEC-10).
- Pattern-based credential-value detection beyond the registered-secrets layer (extending coverage at a false-positive cost) — deferred by [TDR-0009](../../../decisions/TDR-0009-blockers-credential-guard-pattern-deferral.md); revisit triggers named there.
- Answer supersession or question re-opening after closure — the first authoritative answer wins; a deliberate re-open flow needs a named consumer.
- Question expiry/TTL or closure sweeps for abandoned lanes — no consumer today.
- Per-lane question quotas or deduplication of repeated identical questions — the daemon-era coordinator loop may name the need.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — the surface is a local CLI command family over local state; there are no HTTP endpoints and no new outbound requests.

### 8.2 Events / Messages

| ID | Event | Producer | Consumer | Content |
|----|-------|----------|----------|---------|
| EVT-1 | Blocker question published | A lifecycle agent or the operator via `blockers publish` | Verified reads by the blockers list, digest section, brief anchor; later M1-S18 daemon and M1-S23 coordinator | Typed question record (DM-1); append-only, immutable, keyed per question id |
| EVT-2 | Blocker answer intent recorded | The owner or coordinator identity via `blockers answer` | The blockers list closure state; M1-S18 daemon applier, M1-S23 coordinator, M1-S9 `dispatch --resume` | Answer intent record with the `laneResume` projection (DM-2, DM-3); append-only, one authoritative record per question id |

Questions and answers are ledger records, not transient messages; escalation posture for owner gates remains the board's derived SLA state and is not an event of this channel (DEC-10).

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Typed question record (EVT-1 payload) | Append-only ledger record: `id` (`q-` + opaque generated suffix, unique per store), `type` (`decision-needed` \| `spec-ambiguity` \| `credential-missing` \| `external-wait`), `audience` (`owner` \| `coordinator`), `lane`, `ref` (optional, null when absent), `question` (bounded text), `options[]` (ordered, options-bearing types only), `askedAt`; open/answered status derived at read time from answer presence, never stored. Additive record kind and payload schema inside the existing state schema version; no schema bump, no migration |
| DM-2 | Answer intent record (EVT-2 payload) | Append-only ledger record keyed by question id: `questionId`, `answeringAudience`, answer substance (`choice` option value or bounded `text`), `answeredAt`, embedded `laneResume` projection; the first record per question id is authoritative |
| DM-3 | `laneResume` projection | Recorded per answer: `mode` (`boundary-note` \| `attach-continue` \| `resume-prompt-reentry`), `sessionReentry` (boolean; true only for the fallback), the declared prefill-cost marker visible on the fallback, and the capability source the mode derives from (`adapter-declared` \| `capability-absent`) |
| DM-4 | Delegation policy-as-data | Closed map of {question audience, answering audience} → allowed/refused, held as contract data; initial policy: owner answering coordinator questions allowed; coordinator answering owner questions refused ("delegation policy: none"); rows are owner-signed policy data, never runtime inventions |
| DM-5 | Type, audience, and priority vocabulary (contract data) | Closed four-type set with per-type answer channel; closed audience set; type-derived priority classes (`decision-needed` 1, `credential-missing` 1, `spec-ambiguity` 2, `external-wait` 3); the variable-name shape pattern; content bounds |
| DM-6 | Digest `typed-questions` section and brief surfaces | Digest: new fixed-order section over the state-sourced question ranking, standard five-value state and counts, `state-unreadable` evidence on failed/torn reads, open ranked questions only. Brief: the `typed-questions` surface keeps its id and mirrors the section; the `typed-questions` placeholder retires from the closed catalog (3 → 2); the `blocker-questions` anchored-action group becomes a real ranked group carrying audience and rank per question; surface count stays nine (seven section mirrors + two placeholders) |

### 8.4 External Integrations

None. The channel is local-state-only: no tracker read or write, no provider call, no credential resolution (credential values are refused, and the variable name is content, not a resolved secret), no network. The registered-secrets record consumed by the guard is the already-injected record from the delivered redaction path — no new secret-read allowlist entry.

### 8.5 Backward Compatibility

- Additive change: new command family, two additive state record kinds inside the existing schema version (no existing record kind, read, derived document, or schema version modified), four new error rows in one new domain kind (the `DOMAIN_KINDS` union extends additively; classification requires the code, per the multi-row-kind discipline).
- The status digest's fixed section order extends from six to seven sections — a contract-data edit executed in this change with its corpus, bounds, and tests; existing sections keep their order, states, and behavior.
- The brief's surface set stays at nine; the `typed-questions` surface id is stable while its content changes from a named placeholder line to a section mirror, the placeholder catalog drops to two entries, and the anchors array grows from two to three groups — the documented closed-set evolution executed by the owning story.
- The `CommandResult` envelope schema is unchanged; the answer payload's `applied` field is declared `false` in v0 and keeps a stable meaning when M1-S18/M1-S23 add applying actors (DEC-5).
- No existing command's behavior, exit codes, or payload shapes change.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism: identical injected facts (records, caller audience, adapter capability, clock, brand) produce byte-identical output in text and machine modes on all three surfaces | 100% byte-identical; zero run-to-run drift |
| NFR-2 | Read/write cost: one verified state read per surface invocation; one fenced append with post-append coverage verification per publish or answer; zero outbound network requests, retries, or pagination | ≤ 1 read + ≤ 1 fenced append per mutating invocation; 0 outbound requests |
| NFR-3 | Latency: pure validation, guard evaluation, ranking, and rendering | ≤ 50 ms on the reference environment |
| NFR-4 | Bounds: rendered questions ≤ 8 per surface; question text ≤ 120 characters; options ≤ 4 per question, each ≤ 60 characters; free-text answers ≤ 160 characters; machine `data` ≤ 65 536 UTF-8 bytes; human render ≤ 24 lines / 4 096 UTF-8 bytes; every drop or clamp explicitly marked | All bounds enforced and marked; zero silent drops |
| NFR-5 | Error-identity stability: exactly four new rows in one new domain kind; documented table, machine table, and fixtures agree in both directions; `audience-mismatch` projects exit 1; all other failures reuse existing rows or the two fallback entries | 0 undocumented codes; 0 reused-as-class codes; sync check green |
| NFR-6 | Credential-guard coverage: the guard evaluates every content-admitting path (question text, option values, free-text answer) before any record lands; a refusal persists zero bytes and reports `not_landed` | 100% of content paths guarded; 0 refused-but-landed records |
| NFR-7 | State integrity: exactly one authoritative answer record per question id; fenced appends with verified post-append record-count increase of exactly one; torn, wrong-kind, malformed, or duplicated histories classified, never served | 1 record per answer; 0 unclassified corruptions served as truth |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The standard envelope's `runId` and `timing` on every blockers invocation.
- The ranking itself is the observability surface: every rendered question carries type, audience, lane, age, and rank, on the list, the digest section, and the brief anchor alike.
- The `laneResume` projection and the `applied` posture on every answer payload make the recorded-versus-applied boundary visible at a glance.
- Declared evidence for every non-observed read: the digest section's `state-unreadable` reason, or the command's classified `state.*` exit-2 identity — never a silent empty.
- The persisted records (EVT-1/EVT-2) are the durable audit trail of what blocked each lane, who answered, and which resume path was projected.
- No telemetry exporter, event sink, background process, or alerting channel is added; invocation audit arrives with M1-S22.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|------------|------------|---------------|
| RSK-1 | Digest/brief integration forks the ranking (list, digest, brief each re-derive order), so "top-of-digest" stops meaning the same thing across surfaces | H | M | F-6/DEC-6 pin one shared pure ranking consumed by all three surfaces; a structure-level test asserts identical ordering over identical facts (AC-F6-3); the digest section and the brief anchor render the same rank values | L |
| RSK-2 | The credential-detection boundary is too narrow — a value not registered in the environment record transits the channel | H | M | Layered guard: layer 1 catches registered values on every content path; layer 2 constrains `credential-missing` questions to the variable-name shape so a value-shaped question text is structurally refused; refuse-before-land with zero persisted bytes (NFR-6); negative-control tests; pattern-based extension is deferred by TDR-0009 with named revisit triggers (M1-S20, M1-S22, shared pattern-policy seam, transit incident); future adoption takes a system-level shared-content-policy shape | M |
| RSK-3 | The confused-deputy guard is bypassed because the answering identity is claimed, not proven (absent identity defaults to owner) | M | M | The trust model is declared explicitly (DEC-4): unauthenticated attribution per the M1-S22/S18 direction; agent shells receive the identity fact from the harness plugin (M1-S11 reconciliation); the guard is process discipline plus audit evidence, not authentication; the residual is accepted and documented in the security review | M |
| RSK-4 | Documented error table, machine table, and fixtures drift apart for the new `blockers` family | M | L | The delivered error-table sync gate (both-direction agreement, run in CI) covers the four new rows; the family is closed at exactly four rows (DEC-9) | L |
| RSK-5 | Digest/brief contract ripple (seven-section totality, placeholder retirement, third anchor group) breaks existing consumers or corpora | M | M | The closed-set evolution is executed wholly within this change (DEC-6): section order, surface set (still nine), placeholder catalog (3 → 2), anchor groups (2 → 3), bounds, corpus, and docs move together; existing sections and commands keep byte-stable behavior | L |
| RSK-6 | The v0 posture (`applied: false`, fallback `resume-prompt-reentry`) is misread as the pack's `applied: true` example, or recorded mode is mistaken for an executed resume | M | M | DEC-5 pins the recorded-versus-applied boundary and declares the pack example illustrative of the post-M1-S18 posture; fixtures and goldens follow the pinned v0 posture, not the example; `laneResume` is a recorded projection only — no session is touched | L |
| RSK-7 | Product or binary literals leak into command output, examples, or error hints | L | M | Brand neutrality is a reviewable criterion (AC-F7-3); the binary name is injected from the branding configuration; docs and fixtures use the `<binary>` placeholder | L |
| RSK-8 | "Within one collection cycle" is implemented as a wait for a daemon interval that does not exist in v0 | M | L | DEC-6 pins v0 collection as per-invocation (the store is read on each status/brief/list run), making the bound structural; the daemon interval is an M1-S18 refinement that preserves the bound | L |

## 12. ASSUMPTIONS

- The status digest carries no blocker surface today (its six sections and four tracker families are tracker/context-sourced); the "named placeholder" wording in the planning summary is the brief's `typed-questions` placeholder (and M1-S10's planned digest expansion note). Digest integration therefore means adding a new digest section in this change (DEC-6), which M1-S10 later expands around.
- M1-S22 (GH-223, invocation audit ledger and agent identity) is not yet delivered; this change resolves the answering audience through an environment fact named via the branding-seam discipline (DEC-4) and M1-S22 later reconciles the variable into its audit-identity convention (the GH-229 → M1-S4 reconciliation precedent).
- M1-S11 harness adapters are not delivered; the resume-injection capability arrives as an injectable declared fact. The v0 production composition records the `resume-prompt-reentry` fallback; the other modes are exercisable over injected capability facts (DEC-5).
- The pack's publish synopsis predates the audience pin, so `--audience` (default `coordinator`) is a proposed-contract refinement, as is the `applied: false` v0 posture against the man page's illustrative `applied: true` example; the pack is explicitly "Proposed contract; refined at story delivery".
- Lane ids are declared, non-empty strings recorded as given; lane-registry existence verification arrives with the scheduling engine (M1-S17) and is not enforced here. `ref` is optional and null when not supplied.
- An answer must carry exactly one channel per the question's type: `--choice` for options-bearing `decision-needed`, `--text` for the other three; violations and answers to already-answered questions reuse the delivered `input.value.rejected` identity (exit 1) — the pinned four-row family stays closed.
- Question ids (`q-` + opaque generated suffix) are unique per store and generated at publish; examples in the pack (`q-8f21`, `q-9043`) are illustrative.
- Default `blockers list` renders all records (open ranked, answered in a resolved group after); `--open` filters to open only (DEC-3's routing keeps the ranking open-only where it matters — digest and brief render open questions only).
- The digest's `typed-questions` section can be observed or unknown (state-store read failed or torn → `state-unreadable`); `degraded`, `unavailable`, and `not-delivered` never apply (single required local read).
- Layer 1 of the credential guard catches exactly the registered secret values (the delivered environment-record mechanism); values absent from the registered set are out of layer 1's reach by design — that residual is TDR-0009's documented accepted risk (with named revisit triggers: M1-S20, M1-S22, a shared pattern-policy seam, any transit incident), not a silent gap.
- Single-host, local-first posture: the state layer's local filesystem authorization is accepted for M1, matching the delivered posture.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | State layer (M0-S5, GH-174) — CLOSED 2026-10-30 ✓ | Append-only ledger, verified reads, verified-empty evidence, fences, torn-state classification — substrate for EVT-1/EVT-2 (DM-1/DM-2) |
| Depends on | Owner-gate SLA (M1-S5, GH-229) — merged 2026-11-06 ✓ | The `owner\|coordinator` audience seam that change delivered for exactly this consumer; policy-as-data, rank-key, bounds, and truncation precedents |
| Depends on | Lane contracts (M1-S1, GH-221) — delivered ✓ | Lane vocabulary behind `--lane <id>` |
| Depends on | Status digest (M0-S6, GH-175) — delivered ✓ | Section vocabulary, five-value states, closed reason set, bounds — extended by DM-6 |
| Depends on | Brief (M1-S6, GH-228) — delivered ✓ | Surface set, placeholder catalog, anchor groups — evolved by DM-6 |
| Depends on | Result contract and error table — delivered ✓ | Envelope, `DOMAIN_KINDS`, documented/machine/fixture sync gate, `{0,1,2}` projection, registered-secrets record |
| Depends on | Branding seam — delivered ✓ | Injected binary name; naming discipline for the caller-audience environment fact |
| Feeds | Resident dispatch daemon (M1-S18, GH-238, OPEN) | Applies the recorded answer intents; adds the periodic collection cycle that preserves the one-cycle bound |
| Feeds | Coordinator supervision (M1-S23, GH-241, OPEN) | Enforces the declared pickup contract (wake on top-of-digest coordinator-audience question) |
| Feeds | Agent integration (M1-S20, GH-242, OPEN) | Lifecycle agents publish blockers and consume answers as tool calls |
| Feeds | Dispatch engine (M1-S9, GH-239, OPEN) | The one-shot `dispatch --resume` consumer of the recorded `laneResume` projection |
| Feeds | Session lifecycle economics (M1-S15, GH-235, OPEN) | SC-M1-15 raises typed questions through this channel on budget exhaustion |
| Feeds | Status collector expansion (M1-S10, GH-243, OPEN) | Expands around the digest section delivered here |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the credential guard extend beyond the registered-secrets layer with declared token-shape patterns (privacy-guard-style rules) to catch values that were never registered in the environment record? | Layer 1 is precise and testable exactly because it matches registered values; pattern-based detection widens coverage at the cost of false positives on prose that merely looks like a token. The planning summary demands "a precise, testable contract boundary" — layer 2 (name-shape on `credential-missing` questions) covers that type structurally; other types' free-text answers rely on layer 1 alone | Resolved: [TDR-0009](../../../decisions/TDR-0009-blockers-credential-guard-pattern-deferral.md) — the credential guard stays two-layer per DEC-2 (registered-secret-value refusal on every content path plus the variable-name shape on credential-missing questions) with NO token-shape pattern layer; the unregistered-value residual on other content paths is a documented accepted risk with named revisit triggers (M1-S20, M1-S22, a shared pattern-policy seam, any transit incident); any future pattern adoption takes the system-level shared-content-policy shape, never channel-local patterns (autonomous PM-decided under change-scoped authority; security-residual acceptance pending human owner at PR review) |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The question vocabulary is closed at exactly four types (`decision-needed` with options, `spec-ambiguity`, `credential-missing`, `external-wait`) with a pinned per-type answer channel (choice for options-bearing, text otherwise); unknown types and channel violations are refused at admission | Pinned by the ticket; a closed set keeps validation total and the digest/brief projections deterministic; per-type channels make the answer payload's substance unambiguous | 2026-11-06 |
| DEC-2 | The credential guard is layered contract data: (1) registered-secret-value match refused on every content path, whole channel; (2) `credential-missing` question text restricted to the declared variable-name shape; refusals are `blockers.credential-value-rejected`, exit 1, `not_landed`, zero persisted bytes — and no token-shape pattern layer is added (TDR-0009 defers pattern extension to a future system-level shared-content-policy shape) | The ticket pins "names only, never values" on questions and answers alike; the planning summary demands a precise, testable boundary — registered-value matching reuses the delivered redaction machinery, and the name-shape rule makes the credential-missing type structurally value-free; [TDR-0009](../../../decisions/TDR-0009-blockers-credential-guard-pattern-deferral.md) resolves OQ-1 by deferring pattern-based extension with named revisit triggers | 2026-11-06 |
| DEC-3 | Every question carries an audience from the closed set `owner \| coordinator`; publish validates it and defaults to `coordinator`; routing consults the delegation policy-as-data map (initial: owner may answer coordinator questions; coordinator may not answer owner questions — none); refusals name the audience and the policy row consulted | The ticket pins audience on every question and the confused-deputy guard with the policy-as-data delegation exception; defaulting to coordinator is the safe direction (the deputy-protected side is owner) and matches who answers lane questions day to day | 2026-11-06 |
| DEC-4 | The answering audience is an injected caller-audience fact resolved from an environment variable named through the branding-seam discipline, claimed-not-proven per the M1-S22/S18 trust model; an absent fact defaults to `owner` (the un-agented human at the terminal); M1-S22 reconciles the variable into its audit-identity convention | The man-page refusal example requires "this identity"; the identity convention's owner story (GH-223) is undelivered, so this change declares the minimal fact it needs via the established naming discipline — the same create-here/reconcile-later pattern as GH-229's gate-kind classification | 2026-11-06 |
| DEC-5 | The `laneResume` mode is recorded per answer from the declared harness-adapter resume-injection capability (`boundary-note`/`attach-continue` when declared; `resume-prompt-reentry` fallback with `sessionReentry: true` and a visible prefill-cost marker when absent); the projection is recorded, never executed; the answer payload's `applied` is declared `false` in v0 — the pack's `applied: true` example is illustrative of the post-M1-S18 posture | The ticket conditions the resume AC on the adapter capability flag and demands the fallback's prefill cost be visible; no applying actor is delivered here, so recording-versus-applying must be explicit (planning-summary risk) — fixtures follow the pinned v0 posture | 2026-11-06 |
| DEC-6 | Digest integration is a new fixed-order `typed-questions` section over the state-sourced ranking; the brief's `typed-questions` surface keeps its id and mirrors the section, the placeholder retires (catalog 3 → 2), and the `blocker-questions` anchored-action group becomes real (anchors 2 → 3; surface count stays nine); v0 collection is per-invocation — the one-cycle bound is structural, with M1-S18's periodic cycle preserving it | The ticket AC requires digest surfacing and the brief placeholder's owning story is this change; a section follows the digest's source-per-section design (state-sourced like parked-work) and keeps the brief's surface totality stable; M1-S10's planned "blockers section" expansion builds on it | 2026-11-06 |
| DEC-7 | Ranking is one shared pure ordering — priority class first (type-derived contract data: `decision-needed` 1, `credential-missing` 1, `spec-ambiguity` 2, `external-wait` 3), then oldest asked-at, then question id — consumed identically by the blockers list, the digest section, and the brief anchor; answered questions render in a resolved group after all open ones | The pack pins "ranked by age and priority" with no priority source; type-derived priority is the only delivered signal and matches actionability (decision/credential questions have concrete answers; external-wait does not); one mechanism prevents the fork risk (RSK-1) and mirrors the board's severity-class rank precedent | 2026-11-06 |
| DEC-8 | The pickup contract is declared as a payload-determinable predicate: a coordinator-audience open question at rank 1 of the digest `typed-questions` ranking triggers coordinator wake or the next coordinator iteration; no question waits on the daily brief; enforcement is M1-S23's | Pinned by the ticket; declaring the predicate here (audience + rank on every rendered question) gives M1-S23 a stable fact to enforce without pre-building its behavior | 2026-11-06 |
| DEC-9 | The error family is one new `blockers` domain kind with exactly four rows — `blockers.invalid-type`, `blockers.unknown-id`, `blockers.credential-value-rejected`, `blockers.audience-mismatch` — all user-validation, exit 1, `not_landed`; malformed answer bodies (bad choice index, wrong channel, answering a closed question) reuse the delivered `input.value.rejected` | The planning summary pins the four-row superset (SC-M1-24 + man page; the pack's ERRORS list and contracts list are each non-exhaustive); keeping the family closed and reusing `input.value.rejected` keeps the sync gate and the table total without inventing rows | 2026-11-06 |
| DEC-10 | "One mechanism, two audiences" is delivered as the shared audience seam, ranking discipline, and record machinery — the board remains the owner-gate SLA surface and no owner-gate→question conversion is built here; joint owner-ask rendering is deferred to the M2-S4 fleet-grid context | The ticket names owner gates (M1-S5) as the mechanism's first audience, not a new consumer to build; converting SLA gates into question records would fork the SLA state the board owns (never-silence posture, decision records) for no named consumer today | 2026-11-06 |
| DEC-11 | Questions and answers persist as two additive record kinds inside the existing state schema version (payload schemas `delivery.blocker.question.v1` / `delivery.blocker.answer.v1`) under store-scoped per-question keys; one authoritative answer per question id; fenced appends with post-append coverage verification; no schema bump, no migration, no backfill | The state layer's additive-kind pattern (provider parks, closeout operations, owner-gate decisions) is the delivered road; derived closure and read-time folding keep records immutable and the ledger append-only | 2026-11-06 |

Linked decision record: [TDR-0009](../../../decisions/TDR-0009-blockers-credential-guard-pattern-deferral.md) — blockers credential-guard pattern deferral (status Proposed; resolves OQ-1, amends DEC-2; security-residual acceptance pending human owner at PR review).

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Core contracts (question/answer vocabulary, delegation policy data, type-priority map, variable-name shape, bounds, error rows) | New — closed contract data and payload types; the `blockers` domain kind joins the error table's kind union |
| Core domain (validation, credential guard, audience routing, ranking, `laneResume` projection, renderers) | New — pure evaluation over injected facts (records, caller audience, capability, clock); no I/O, clock, randomness, or environment access |
| State layer record kinds | New — two additive record kinds (DM-1/DM-2); no existing kind, read, or schema version modified |
| CLI command surface (`blockers`) | New — command definition and the three subcommands, composed beside the other top-level commands |
| CLI composition edge | Updated — blockers runtime wiring (state port, caller-audience fact resolution, brand, clock); registered only when a blockers composition is supplied |
| Status digest | Updated — new fixed-order `typed-questions` section (contract data), corpus, bounds; existing sections unchanged |
| Brief | Updated — `typed-questions` surface becomes a section mirror (id stable), placeholder catalog 3 → 2, `blocker-questions` anchor becomes a real ranked group |
| Result contract documentation | Updated — the `blockers` family documented with its four rows and exit projection |
| Current-truth feature documentation | New — a feature spec for the typed blocker channel, reconciled at system_spec_update (first-spec-only always-resolve) |

## 17. ACCEPTANCE CRITERIA

**Ticket AC (verbatim):** a blocker surfaces in the digest within one collection cycle as a typed question; an answer addressed to the wrong audience is refused (owner-audience question answered by a coordinator identity → refused, with the policy that would delegate named); an answer resumes the lane, and when the adapter lacks resume injection the fallback is the declared re-entry mode with its cost acknowledged; question types are validated; a credential-missing question or answer carries the variable name and never a value.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a valid publish request (closed type, audience, non-empty lane, bounded content), **when** `blockers publish` runs, **then** exactly one typed question record (DM-1) is appended under its store-scoped key, the record is returned by a verified read with all fields intact, and the exit code is 0 | F-1, EVT-1, DM-1 |
| AC-F1-2 | **Given** a state store whose blocker records are torn, wrong-kind, or malformed, **when** any surface reads the ranking, **then** the corruption is classified (`state.store.torn` family or the digest section's `state-unreadable` evidence) — never served as truth, never a silent zero — and an absent store is explicit verified-empty evidence | F-1, NFR-7 |
| AC-F2-1 | **Given** a publish with a type outside the closed four-value set, **when** it runs, **then** it is refused with `blockers.invalid-type`, exit 1, `not_landed`, and nothing is persisted | F-2, DEC-1 |
| AC-F2-2 | **Given** an answer whose channel does not match the question type (a `--choice` on an options-less question, `--text` where a choice is required, an out-of-range choice index) or an answer to an already-answered question, **when** it runs, **then** it is refused with the delivered `input.value.rejected` identity, exit 1, `not_landed`, and the question's authoritative answer is unchanged | F-2, NFR-7 |
| AC-F3-1 | **Given** a publish or answer whose content contains a registered secret value, **when** the credential guard evaluates, **then** the operation is refused with `blockers.credential-value-rejected`, exit 1, consequence `not_landed`, zero bytes persisted, and the remediation hint states that credential questions carry the variable name only and the value comes from the environment | F-3, DEC-2, NFR-6 |
| AC-F3-2 | **Given** a `credential-missing` publish whose question text is a variable-name-shaped reference (for example an environment variable name), **when** it runs, **then** the question is accepted carrying the name and no value, and it renders on the ranked surfaces with the name only | F-3, AC-F5 of ticket |
| AC-F3-3 | **Given** a `credential-missing` question answered with free text carrying the variable name and no value, **when** the guard evaluates, **then** the answer is accepted; and **given** free text containing a registered credential value, **then** it is refused by that registered-value match (AC-F3-1), never by shape alone — questions and answers are held to the same never-a-value contract | F-3, NFR-6 |
| AC-F4-1 | **Given** a question addressed to audience `owner` and an answering identity resolved as `coordinator`, **when** `blockers answer` runs, **then** the answer is refused with `blockers.audience-mismatch`, exit 1, consequence `not_landed`, the remediation hint naming the question's audience and the consulted delegation policy ("none"), and the question remains open with no answer record applied (SC-M1-24) | F-4, DEC-3, DM-4 |
| AC-F4-2 | **Given** a delegation policy row that explicitly allows the answering audience for the question's audience, **when** the answer runs, **then** it is accepted and recorded with the answering audience — the policy-as-data exception, never a runtime invention | F-4, DM-4 |
| AC-F4-3 | **Given** any published question, **when** it is rendered on any surface, **then** it carries its audience value from the closed set — a question without a valid audience cannot exist (publish defaults to `coordinator`) | F-4, DEC-3 |
| AC-F5-1 | **Given** an answer accepted against a question and a harness-adapter capability fact declaring resume injection, **when** the answer is recorded, **then** the `laneResume` projection records `boundary-note` or `attach-continue` with `sessionReentry: false` — the recorded path resumes the lane at the phase boundary without a new session spawn; exercised over injected capability facts (SC-M1-13) | F-5, DM-3, DEC-5 |
| AC-F5-2 | **Given** an answer accepted when the capability fact declares no resume injection (or is absent), **when** the answer is recorded, **then** the `laneResume` projection records the declared fallback `resume-prompt-reentry` with `sessionReentry: true` and the prefill cost visibly marked on the machine payload and the human line — the acknowledged fallback, its cost visible | F-5, DM-3, DEC-5 |
| AC-F5-3 | **Given** any recorded answer, **when** its payload or record is inspected, **then** the `applied` posture is explicitly declared (`false` in v0), the answer intent record (DM-2) is the durable data later actors consume, and no session is spawned, attached, or resumed by this change | F-5, DEC-5 |
| AC-F6-1 | **Given** a published blocker, **when** the next `status` (or `brief`) invocation runs, **then** the question surfaces in the digest's `typed-questions` section (and the brief's ranking) as a typed question with type, audience, lane, age, and rank — within one collection cycle (v0: the invocation itself) | F-6, DEC-6, ticket AC 1 |
| AC-F6-2 | **Given** the brief payload after this change, **when** it is inspected, **then** the `typed-questions` surface mirrors the digest section (id stable), the `typed-questions` placeholder has retired from the closed catalog (2 entries remain), and the `blocker-questions` anchored-action group is a real ranked group — nine surfaces total, anchors ordered decision-first | F-6, DM-6 |
| AC-F6-3 | **Given** identical question facts, **when** the blockers list, the digest section, and the brief anchor rank them, **then** all three produce the identical order (priority class → oldest → id) from the one shared ranking — zero forked orderings, with answered questions never interleaved among open ones | F-6, DEC-7, NFR-1 |
| AC-F6-4 | **Given** the digest machine payload, **when** a coordinator-audience question is ranked first in the `typed-questions` ranking, **then** that fact is determinable from the payload alone (audience and rank per question) — the declared pickup predicate M1-S23 enforces; no enforcement, wake, or iteration behavior ships here | F-6, DEC-8 |
| AC-F7-1 | **Given** open and answered questions in the store, **when** `blockers list` runs (default and `--open`), **then** the machine envelope carries `questions[]` with `id`, `type`, `audience`, `lane`, `ref`, `question`, `options[]`, `askedAt`, `age`, `rank`, exit 0, declared truncation, and deterministic output (NFR-1) | F-7, DM-1, NFR-4 |
| AC-F7-2 | **Given** an answer to a question id that does not exist in the store, **when** `blockers answer` runs, **then** it is refused with `blockers.unknown-id`, exit 1, `not_landed` | F-7, DEC-9 |
| AC-F7-3 | **Given** any rendered output (text lines, envelope, error hints, docs, fixtures), **when** reviewed, **then** the binary name comes from the injected brand configuration and no product or binary literal is committed — the `<binary>` placeholder discipline holds | F-7 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered as one additive change through the standard 11-phase lifecycle on its feature branch; no flag-gating — a single-user local tool adds the surface directly.
- Delivery order inside the change: contract vocabulary and the pure domain (validation, guard, routing, ranking, resume projection — fixture-testable with zero I/O) first, then the two state record kinds, then the `blockers` command surface, then the digest and brief integration as one atomic contract edit (section, surfaces, catalog, anchors move together).
- v0 exercisability boundary: publish/list/answer/guards are fully real against local state; the answer→resume projection is fully exercisable over injected capability facts, while the v0 production composition records the `resume-prompt-reentry` fallback with `applied: false` — real application activates with M1-S18 (daemon), M1-S23 (coordinator enforcement), and M1-S11 (real adapter capabilities).
- Adoption: lifecycle agents start publishing instead of stalling in prose; the coordinator's session-start digest immediately ranks open questions; the brief's placeholder line becomes real ranked questions. No existing command or consumer changes behavior.
- Doc impacts recorded now, resolved at phase 7: the new current-truth feature spec for the typed blocker channel (first-spec-only always-resolve); digest and brief feature docs updated for the section/surface/catalog/anchor edits; result-contract doc updated for the `blockers` family; command-registry cross-reference verified (the planning-truth `blockers` row already exists — assert, do not author).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. Two additive record kinds inside the existing state schema version; no backfill, no migration, no schema bump. The first publish seeds the store; an empty store is verified-empty evidence rendered as an explicit empty ranking. Prose-era blockers predating this change are not converted — they were never records.

## 20. PRIVACY / COMPLIANCE REVIEW

- Credential values are structurally excluded: the layered guard refuses them before any record lands (NFR-6), and the serialization redaction chokepoint remains as defense-in-depth over the same registered-secrets record — no new secret-read allowlist entry is added.
- Question and answer content is bounded, clamped, and rendered only on the declared surfaces; free text never exceeds the declared caps; no raw provider payloads, tracker titles, bodies, or comments enter the channel's payloads or renders.
- Records are local, append-only, and content-minimal by design (typed questions with bounded text) — an attention trail, not a data hold.
- The caller-audience fact is an unauthenticated attribution consumed for routing; it is never rendered as proven identity and never persisted as authentication evidence.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Authority boundary (primary):** the confused-deputy guard keeps owner-audience questions unanswerable by coordinator identities, with the delegation policy named on refusal and policy-as-data as the only delegation path — no runtime-invented authority (DEC-3, AC-F4-1/2).
- **Claimed-not-proven posture:** the answering identity is unauthenticated attribution (DEC-4); the guard is process discipline with recorded evidence, not authentication. Residual risk (an agent running outside an identity-bearing shell defaults to owner) is accepted, documented, and revisited at M1-S22's audit-identity reconciliation.
- **Credential non-transit:** refuse-before-land on every content path (AC-F3-1/3); zero persisted bytes on refusal; layer 2 makes credential-missing questions structurally value-free.
- **State integrity:** fenced appends, verified reads, verified-empty evidence, torn-state classification — a torn or duplicated answer history fails closed and is never served as truth (NFR-7).
- **Recorded intent, no execution:** this change spawns no session, attaches nothing, wakes nothing, and writes no control socket — the recorded projection is inert data until a delivered actor consumes it.
- **No child processes, no shell, no network, no new credential path.**
- **Brand neutrality:** no product or binary literal is committed; all renders use the injected brand binary name.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Adding a question type, changing a priority class, adjusting content bounds, or extending the delegation map is a contract-data edit plus validator, tests, and documentation — closed vocabularies evolve only through reviewed changes; the delegation map is owner-signed policy data.
- M1-S18, M1-S23, M1-S9, and M1-S20 consume the recorded intents and projections; they must not fork the ranking or redefine the record shapes — the shared domain is the single source.
- M1-S22 reconciles the caller-audience environment fact into the audit-identity convention (naming review, not a behavioral change); M1-S10 expands the digest around the delivered section.
- The `blockers` error family is the surface's failure vocabulary; promoting further failure classes to error-table rows requires a named consumer and a reviewed change, matching the delivered evidence-vs-identity discipline.
- The placeholder catalog and anchor groups evolve only through the owning story's reviewed contract edit (the brief's closed-set rule).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Typed question | A durable, validated question record with a closed type, audience, lane, and bounded content — the replacement for prose blockers. |
| Question type | One of the closed four: `decision-needed` (with ordered options), `spec-ambiguity`, `credential-missing` (variable name only), `external-wait`. |
| Audience | The routing field on every question: `owner` or `coordinator`; decides which identity may answer. |
| Confused-deputy guard | The routing refusal: a cross-audience answer is refused with the delegation policy named, unless policy-as-data delegates. |
| Delegation policy | The closed policy-as-data map of {question audience, answering audience} → allowed/refused; owner-signed, never runtime-invented. |
| Credential guard | The layered refusal of credential values on every content path; layer 1 matches registered secret values, layer 2 restricts `credential-missing` questions to the variable-name shape. |
| Variable-name shape | The declared name-pattern a `credential-missing` question text must match — the name, never the value. |
| Answer intent record | The durable answer data (DM-2): question id, answering audience, substance, time, and the `laneResume` projection — recorded here, applied by later actors. |
| `laneResume` | The per-answer resume projection: `boundary-note` or `attach-continue` (no session re-entry) when the adapter declares resume injection; `resume-prompt-reentry` fallback with `sessionReentry: true` and the prefill cost visible when it does not. |
| Resume-injection capability | The harness adapter's declared ability to inject an answer into a live session; an injectable fact in v0, delivered by M1-S11. |
| Prefill cost | The token cost of re-entering a session (full context re-prefill) — visibly marked whenever the fallback mode is recorded. |
| `applied` | The declared application posture on an answer payload: `false` in v0 (no applying actor exists); stable when M1-S18/M1-S23 add actors. |
| Pickup contract | The declared predicate: a coordinator-audience question at rank 1 of the digest ranking triggers coordinator wake or the next iteration — no question waits on the daily brief; enforced by M1-S23. |
| Collection cycle | The interval at which ranked surfaces re-read the world — per-invocation in v0, a daemon interval from M1-S18; the one-cycle surfacing bound holds under both. |
| `typed-questions` | The digest section and the brief surface id for ranked open questions; the brief placeholder of the same id retires with this change. |
| Blockers list | The `blockers list [--open]` rendering: open questions ranked, answered questions in a resolved group after, truncation declared. |

## 24. APPENDICES

### Appendix A — Planning-pack anchors for the `blockers` surface (proposed contract, M1-S16)

- Synopsis: `<binary> blockers list [--open]` / `<binary> blockers answer <id> [--choice <n>] [--text <text>]` / `<binary> blockers publish <type> --lane <id> "<question>" [--options a,b]`.
- Output: text ranked question lines; envelope `data` carries `questions[]` (id, type, lane, ref, question, options[], askedAt, age, rank) and on answer `applied`, `laneResume` (mode boundary-note, attach-continue — the contracts entry adds resume-prompt-reentry, which is authoritative here).
- Exit status: 0 listed or answered; 1 invalid type, unknown id, or a credential value was supplied (audience-mismatch pinned exit 1 by SC-M1-24); 2 platform faults.
- Errors: `blockers.invalid-type`, `blockers.unknown-id`, `blockers.credential-value-rejected` (man page ERRORS) plus `blockers.audience-mismatch` (SC-M1-24; the planning summary pins the four-row superset — DEC-9).
- Worked examples from the pack: `blockers answer q-8f21 --choice 2 --json` returns `answered`, `audience: coordinator`, `choice: "lite+escalation"`, `applied: true`, `laneResume` boundary-note/sessionReentry false; the cross-audience refusal returns `blockers.audience-mismatch` with "delegation policy: none"; the credential refusal returns `blockers.credential-value-rejected` with "credential questions carry the variable name only; the value comes from the environment".
- **Non-normative caveats on the worked examples:** the pack is illustrative — the pinned v0 posture (DEC-5) is authoritative, so the answer example's `applied: true` describes the post-M1-S18 posture and v0 records `applied: false`; the publish example's `--text` flag is outside the publish synopsis, illustrative of the guard firing on content generally — the guarded channels are the positional question text, the option values, and the answer `--text`; fixtures and goldens follow the pinned decisions, not the examples.

### Appendix B — Current-truth reuse map

| Reused truth | Source surface | What this change takes from it |
|---|---|---|
| `owner \| coordinator` audience dimension | Owner-gate SLA (audience seam) | The routing dimension for questions and answers — consumed, not redesigned |
| Policy-as-data pattern (closed map, owner-signed, validator-checked) | Owner-gate SLA / PDR-0003 | The delegation policy map (DM-4) |
| Deterministic rank key (class → oldest → id), declared truncation, bounds | Owner-gate SLA board | The shared ranking discipline (DEC-7) and NFR-4 values |
| Append-only additive record kinds, fenced append, verified reads, torn classification | State layer | The EVT-1/EVT-2 record substrate (DEC-11) |
| Fixed-section vocabulary, five-value states, closed reason set (`state-unreadable`), section-failures-are-payload-data | Status digest | The new `typed-questions` section's derivation and evidence model (DM-6) |
| Nine-surface totality, closed placeholder catalog, anchored-action groups | Brief | The placeholder retirement and the real `blocker-questions` anchor (DM-6) |
| `CommandResult` envelope, `DOMAIN_KINDS`, error-table sync gate, `{0,1,2}` projection, registered-secrets record | Result contract | Output/failure posture; layer 1 of the credential guard; the `blockers` kind and four rows |
| Branding seam | Branding | Injected binary name; the environment-fact naming discipline for the caller-audience variable |
| Lane vocabulary and injected lane reader | Watchdog and lane contracts | The `--lane <id>` declaration (existence verification deferred to M1-S17) |

### Appendix C — v0 recorded-versus-applied matrix

| Capability | Recorded here (real, local) | Applied here | Applied by (later) |
|---|---|---|---|
| Publish typed question | Yes — state record, validated, guarded | — | — |
| Rank in list / digest / brief | Yes — shared ranking on every invocation | — | M1-S18 adds the periodic cycle |
| Answer as data | Yes — intent record + projection, guarded, routed | — | — |
| Resume lane (boundary-note / attach-continue) | Projection recorded over injected capability facts | No — no session is touched | M1-S18 daemon / M1-S23 coordinator / M1-S9 `dispatch --resume` |
| Resume lane (resume-prompt-reentry fallback) | Recorded with `sessionReentry: true` + visible prefill cost | No | M1-S20-era coordinator loop executes re-entry |
| Coordinator wake on top-of-digest question | Predicate determinable from the digest payload | No | M1-S23 enforcement |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @spec-writer | Initial specification from the PM planning session (clarify_scope validated) and the M1 planning pack (contracts §blockers, blockers man page, interactions Session C, SC-M1-13/SC-M1-24, backlog M1-S16, backlog-ranking) |
| 1.1 | 2026-11-06 | @spec-writer | OQ-1 closed by TDR-0009 (credential guard stays two-layer per DEC-2, no token-shape pattern layer; deferred extension with named revisit triggers): OQ-1 resolution recorded, TDR-0009 linked under the Decision Log and §7.3/§12/DEC-2/RSK-2, AC-F3-3 refusal tied to the registered-value match (never shape alone), checklist line updated to resolved phrasing |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-230 (goal, tasks, five ACs, pinned decisions — recorded as DEC-2/3/5/8 and F capabilities, never re-derived), the PM planning summary, and the M1 planning pack (backlog M1-S16, backlog-ranking placement, contracts §blockers with shared contracts, blockers man page, interactions Session C, test-scenarios SC-M1-13/SC-M1-24, architecture intent table), plus the delivered current-truth specs (state layer, owner-gate SLA, status digest, brief, result contract, watchdog/lane contracts) and the GH-229 change spec as the structural and v0-posture precedent.
- Pack-vs-spec deviations are documented where the pack's status is "Proposed contract; refined at story delivery": the `--audience` publish flag (audience pinned on every question but absent from the synopsis), the four-row error superset (man page ERRORS and contracts each non-exhaustive; SC-M1-24 decisive), the three-mode `laneResume` set (man page OUTPUT lists two), and the v0 `applied: false` posture against the illustrative `applied: true` example (Appendix A caveats).
- Identity resolution (DEC-4) and the digest-section shape (DEC-6) were chosen where the pack leaves seams open, following the create-here/reconcile-later precedent (GH-229's gate-kind classification → M1-S4 reconciliation); both name their reconciliation story explicitly.
- Tech-neutral by design: no module names, file paths, or implementation steps; downstream plan authors derive placement from ADR-0003 and the delivered package tiers (contracts → core contracts, pure domain → core domain, ledgers → state, command → CLI, wiring → composition edge).
- Quantified NFRs reuse the delivered reference values (50 ms, 65 536 bytes, 24 lines / 4 096 bytes, 8-item cap, title/detail character caps) so the change matches the system's established bounds discipline; new bounds (options count/length, answer length) are declared, not discovered.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-230)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, EVT-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM-/EVT- ID and use Given/When/Then
- [x] Ticket AC covered by testable criteria (digest surfacing — AC-F6-1; cross-audience refusal with policy named — AC-F4-1; resume with capability conditioning and fallback cost — AC-F5-1/2/3; type validation — AC-F2-1/2; credential name-never-value — AC-F3-1/2/3)
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability (H/M/L) with mitigation and residual risk
- [x] Out-of-scope items prefixed `[OUT]` and name the deferred stories explicitly (M1-S18/GH-238, M1-S23/GH-241, M1-S9/GH-239, M1-S11/GH-233, M1-S22/GH-223, M1-S7, M1-S10/GH-243)
- [x] Resolved decision recorded: OQ-1 closed by TDR-0009 (linked under the Decision Log; security-residual acceptance pending human owner at PR review)
- [x] No implementation details (no code file paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (pack anchors summarized with caveats, not copied normatively)
- [x] Front matter validates per front_matter_rules
