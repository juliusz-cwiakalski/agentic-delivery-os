---
ados_distribution: project-generated
id: TDR-0019
decision_type: tdr
status: Proposed
created: 2026-11-10
decision_date: null
last_updated: 2026-11-10
summary: "A dispatch resolves the declared truth-read credential reference and performs exactly one minimal bounded work-item read through a new optional preflight port before the queue lease is claimed: an unresolvable credential refuses pre-session as config.credential.missing (user, not_landed, exit 1) with a bounded summary naming the resolved key and the reference; the production preflight classifies the read outcome itself at the composition boundary from the returned failure's optional httpStatus and never forwards the adapter identity (401/403 -> provider.auth.rejected/exit 1; 5xx, any other status-bearing non-2xx, and a status-absent transport failure -> provider.outage/exit 2; a received-but-malformed 2xx -> the adapter-local provider.payload.invalid/exit 2; 404 -> input.value.rejected/exit 1 stating the provider reported the work item as absent); every mapped pair carries its own domain kind under a DispatchRunResult error union widened additively to admit provider; production always supplies the port while direct engine callers may omit it, the gh-keyring bridge is documentation plus an explicit operator export whose resolved key is registered for redaction, and the prerequisite is surfaced as identifier-only status evidence (an optional section-level credentialPrerequisite) with doctor parity and doctor unshipped."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os dispatch engine admission path
decision_scope: repo
review_date: null
classification:
  domains: [tooling, security, operations]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@pm (change GH-279, decisions D1/D4/D5 recorded in chg-GH-279-pm-notes; analysis and record by @decision-advisor)"
  decider: "Juliusz Ćwiąkalski (owner) — acceptance pending at the GH-279 PR review; the AI does not accept this record"
  contributors:
    - "@spec-writer (chg-GH-279-spec DEC-1, DEC-4, DEC-5, DEC-6, DEC-7, DEC-8; F-1, F-2, F-5, F-6; Appendix A/C)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-279 PR review — the provisioning and secret-surface posture is human-owned)"
  performers:
    - "@test-plan-writer (refusal, zero-side-effect, and secret-canary oracles)"
    - "@plan-writer (admission ordering and composition wiring)"
    - "@coder (delivery per spec and plan)"
  informed:
    - "Dispatch operators on gh-authenticated default installs (must export the key before upgrading)"
    - "M1-S9 operational owners (handover-gate reachability)"
    - "Bash fallback maintainers (unchanged authority read)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The production truth-read reference is renamed, re-keyed, or gains a fallback key: the refusal text, the provisioning guide, the status evidence, and the conformance pins must move in the same change."
  - "An operator or consumer asks for OS-keyring, ambient-environment, or chained-key resolution: that reopens the deny-by-default posture and needs an owner decision, never an engine-side fallback."
  - "One bounded single-entity work-item read proves an insufficient admission probe (for example it passes while artifact or CI truth stays unreadable): revisit the probe's read set rather than adding retries."
  - "A production composition supplies no preflight port, or a credential refusal is ever observed after a lease, spawn, or record write: reopen the ordering and wiring decisions."
  - "Any credential value, substring, or value-derived digest is observed in an envelope, human diagnostic, status digest, or record: reopen the rendering rule and the redaction path before further surface work."
  - "A non-interactive consumer is observed to treat the new pre-session refusal as the old attempt-stage outcome (for example by keying on `dispatch.state-unverified`/exit 2 and reading an attempt record that no longer exists): revisit the consumer compatibility note and the migration guidance, not the taxonomy."
  - "Doctor is proposed for the shipped prompt-required command set, or the status prerequisite facts need a new section, state, or finding code: that is a separate decision."
links:
  related_changes: ["GH-279"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-10--GH-279--dispatch-credential-preflight/chg-GH-279-spec.md"
  contracts:
    - "packages/core/src/contracts/credentials.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/contracts/dispatch.ts"
  diagrams: []
  decisions: ["TDR-0005", "TDR-0012", "TDR-0020"]
  experiments: []
  metrics: []
  roadmap_items: ["M1-S9"]
---

# TDR-0019: Dispatch Admission Credential Preflight — Pre-Session Refusal, Named Source, Documentation-Only Bridge

## Context

- **FACT:** `delivery-os dispatch <ref>` resolves a harness, claims the repository queue lease, spawns or resumes through the harness session port, watches progress, collects evidence, and only then performs the truth read that decides whether the delivered work can be verified (`packages/core/src/app/dispatch.ts`, `runDispatch`: the lease is claimed at entry and `readTruth` runs after the session; spec §2.1).
- **FACT:** The production truth-read credential reference is declared data: reference `github-read` over a literal source key named `GITHUB_TOKEN` (`packages/cli/src/production.ts`). No alternative key, prefix, keyring source, or fallback chain exists.
- **FACT:** The environment-backed credential port derives the source key from the reference — a literal name verbatim, a prefixed name as brand prefix plus suffix — and both an absent key and an empty value fail as `config.credential.missing` with `domainKind: config`, category `user`, `retryable: false`, consequence `not_landed`, projection `user-validation` (exit `1`); whitespace counts as a value (`packages/adapters/src/credentials/index.ts`; `resolveCredentialSourceKey`, `credentialMissing`, `materialFrom`).
- **FACT:** On a default install where only `gh` is authenticated in the OS keyring, `GITHUB_TOKEN` is unset, so every dispatch runs a full delivery session — which may deliver work — and then classifies `state-unverified` at exit `2`, with a `last_message` that names an error code and never the missing key (spec §2.1, observed production evidence 2026-11-10).
- **FACT:** The delivered provider read carries no admission classification. `packages/adapters/src/github/client.ts` (`get`) maps **only** HTTP `404` to the internal `provider.not-found` marker; every other non-2xx response returns the adapter-local `provider.payload.invalid` **with** `httpStatus`; a transport throw returns `provider.payload.invalid` **without** `httpStatus`; and a malformed `2xx` payload also returns `provider.payload.invalid` with no transport status, because the normalizers never receive the response status (`packages/adapters/src/io/provider-transport.ts:45-95`; `packages/adapters/src/github/normalize.ts`). The optional `httpStatus` on the delivered failure shape is therefore the only delivered discriminator, and it is absent on **both** the transport throw and the malformed `2xx` case, so the raw adapter result cannot by itself tell those two apart.
- **FACT:** The engine already has an optional `ports.admission` seam, but it is a restart/resume admission decision: it runs after the queue-lease claim and appends an attempt record when it refuses (`packages/core/src/app/dispatch.ts`, `DispatchAdmission`; lease claim at entry, admission block before the spawn/resume block). It is not a pre-session precondition and cannot serve as this seam.
- **FACT:** Two delivered composition suites pin the current behaviour: a refusing credential port still spawns once and yields `result=state-unverified` with one attempt record (`tests/structure/dispatch-composition.test.ts`, spec §2.2 PP-7).
- **FACT:** The status digest already models the prerequisite but not its name: credential-dependent sections become `unknown` with reason `credential-unavailable`, and no section, count, or finding names the missing key (`doc/spec/features/feature-status-digest.md`; `packages/core/src/domain/status.ts`). Doctor's `tracker.credential-unavailable` hint substitutes `{envVar}`, and doctor is outside the shipped prompt-required command set (spec §2.1).
- **FACT:** The closed delivery-result vocabulary, projection classes, and `{0, 1, 2}` exits are ratified by TDR-0005; the credential-guard posture (named values refused, names only in diagnostics) is precedent in TDR-0012.
- **Trigger:** GH-279. A real dispatch of GH-241 delivered its work — eleven complete phases, an open PR — yet its verdict could not be verified because the engine could not read truth. The work was delivered; the verdict was unverifiable. The chosen policy is to refuse delivery on an unprovisioned install rather than deliver without a verdict. No evidence shows that GH-241's delivered work was discarded, so this record does not claim it as wasted work.

## Problem Framing (Clarified)

The engine asks its verification question after it has paid for the answer. Two different facts are conflated:

1. **Admission** — can this engine verify at all right now? This is a precondition: a one-second, side-effect-free answer that depends only on the declared credential reference and basic reachability.
2. **Outcome** — what did this attempt deliver? This is an attempt-stage result whose cost is legitimately a session.

Because admission is evaluated inside the outcome path, its failure is reported as an outcome token (`state-unverified`) and its cost is a full session. That produces two distinct harms: a **delivered-but-unverifiable attempt** — work may be complete while its verdict cannot be trusted and cannot be named — and an **unnameable prerequisite**, where the operator receives an error code and no key name, so the only actionable fact in the situation never reaches them.

The real trade-off must be stated plainly: on an unprovisioned install, the chosen policy **refuses delivery** rather than allowing a delivery whose verdict cannot be verified. That is a compatibility-visible choice, not a free improvement; the alternative is to keep delivering work the engine cannot vouch for. GH-241 evidences the delivered-but-unverifiable outcome, not discarded work, and this record claims no waste beyond the session spent without a trustworthy verdict.

Underneath sits a provisioning-story gap. The system deliberately reads exactly one declared environment key (deny-by-default), while the environment most operators actually have is an authenticated `gh` keyring the product is forbidden to read. Nothing documents the bridge, so "the engine is broken" and "the prerequisite is unmet" are indistinguishable from the outside.

Desired outcomes: refuse before any dispatch side effect; name the exact prerequisite and one remediation without ever rendering material; map a failing admission read to the declared identity that describes what actually happened rather than one blanket identity; keep a stable typed identity so automation branches on tokens rather than prose; leave the secret surface exactly as narrow; make the prerequisite visible before work is queued; and change no token, exit, configuration key, or command.

One consequence of that fourth outcome is a placement decision, not a message decision. The adapter does not classify admission: it distinguishes only an HTTP `404` absence from everything else and reports the rest as the adapter-local payload failure, with the received status when there was one. Admission classification therefore belongs to the **production preflight at the composition boundary**, which inspects the returned failure's optional `httpStatus` and produces the declared admission identity; forwarding the adapter identity would collapse credential rejection and provider outage into one payload fault, and would leave a received malformed `2xx` indistinguishable from a transport throw.

## Constraints (Hard Requirements)

### C-1: The refusal precedes every dispatch side effect

- **Statement:** An unresolvable truth-read credential or a failing minimal admission read refuses before any queue-lease claim, spawn, resume, or dispatch-ledger record write. On that path: 0 leases, 0 sessions, 0 branches, 0 worktrees, 0 attempt records, 0 divergence records, 0 handover records, 0 writes to the dispatch, attempt, divergence, handover, and authority ledgers, and 0 authority-view changes. The invocation audit ledger is out of scope for this change: a pre-session refusal is not durably recorded there, so repeated misconfiguration is not observable after the fact (accepted residual).
- **Source:** AC (chg-GH-279-spec AC-F1-1, AC-F1-2, G-1, NFR-3) + spec F-1.6/NFR-3 (invocation audit excluded, RSK-12)
- **Verification:** test (zero-spawn and zero-dispatch-ledger-write spies on the composed dispatch path; the invocation audit ledger is excluded by scope)
- **Negotiable:** no

### C-2: Names, never values

- **Statement:** Every credential refusal names the fully derived source key (literal name verbatim, prefixed name as prefix plus suffix) and the credential reference, in both the machine envelope and the human diagnostic, and no path renders, echoes, hashes, truncates-for-display, or otherwise exposes the credential value or any part of it. The same holds for the status prerequisite evidence.
- **Source:** AC (AC-F2-1, AC-F2-2, AC-F2-3, AC-F6-1; NFR-2, DM-1)
- **Verification:** test (planted-secret canary across envelope, human text, status digest, and records) + code review
- **Negotiable:** no

### C-3: Typed identity preserved; no new identity, token, or exit

- **Statement:** An unresolvable credential carries `config.credential.missing` (user, non-retryable, `not_landed`, exit `1`). A failing minimal read is **classified by the production preflight at the composition boundary from the returned failure's optional `httpStatus`** — never by forwarding the adapter identity — and maps by outcome onto an **existing declared row**, is never a blanket identity, and is never collapsed into `dispatch.state-unverified`: HTTP `401`/`403` → `provider.auth.rejected`; any `5xx` → `provider.outage`; a status-bearing non-2xx that is neither → `provider.outage`; a status-absent failure (a transport throw, no response received) → `provider.outage`; a received-but-malformed `2xx` → the existing adapter-local `provider.payload.invalid` at its delivered projection; HTTP `404` → `input.value.rejected` with a bounded summary stating that **the provider reported the work item as absent**. Every mapped pair is carried with its own domain kind — `provider` for `provider.auth.rejected`, `provider.outage`, and `provider.payload.invalid`; `input` for `input.value.rejected` — so `classifyDomainKind` resolves the row instead of containing a kind/code mismatch as `fallback.internal`, which requires `DispatchRunResult`'s error union to admit `provider` additively. The transport's internal `provider.not-found` marker is consumed at the preflight boundary and is not exposed as an identity. The change adds 0 delivery-result tokens, 0 error-table identities, 0 new error identities, and 0 exits outside `{0, 1, 2}`.
- **Source:** prior decision (TDR-0005) + AC (AC-F1-3, F-2.4, DEC-7, NFR-8, NFR-13) + internal standard (`packages/core/src/contracts/error-table.ts`; `packages/cli/src/classify.ts`; `packages/core/src/app/dispatch.ts`)
- **Verification:** test (one case per mapped branch asserting identity **and** domain kind **and** projection **and** exit; the malformed-`2xx`-versus-transport-throw pair asserted separately; error-table sync, taxonomy equality) + code review
- **Negotiable:** no

### C-4: The secret-read surface does not widen

- **Statement:** No OS-keyring read, no ambient or parent-environment inheritance, no fallback key name, and no new `process.env` read outside the credential adapter; the secret-read allowlist gains no entry. The `gh` bridge exists only as documentation plus an operator-performed explicit export. Deny-by-default and the declared-reference model are unchanged.
- **Source:** AC (AC-F5-1, F-5.3, DEC-4; NG-2, NG-3, NFR-9)
- **Verification:** test (secret-read boundary check, env-read allowlist) + code review + audit
- **Negotiable:** no

### C-5: The engine stays runtime-neutral and I/O-free

- **Statement:** The preflight enters the engine as a **new optional `preflight` port**, explicitly distinct from the delivered `ports.admission` seam (`ports.admission` is a restart/resume decision that runs after the queue-lease claim and appends an attempt record when it refuses). The `preflight` port runs before `claimLease` and before the spawn/resume block. A direct engine caller that supplies none keeps the current run order and outcome; the production composition is required to supply it and a composition test proves the wiring, so production cannot silently keep the defect.
- **Source:** AC (F-1.1, F-1.2, F-1.7, DEC-6, RSK-7) + internal standard (ADR-0003 tier rules)
- **Verification:** test (composition wiring assertion; ordering assertion that `preflight` precedes `claimLease` and spawn/resume; dependency-cruiser boundaries) + code review
- **Negotiable:** no

### C-6: Disclosure only — the product still provisions nothing

- **Statement:** The change adds no command, flag, configuration key, or shipped command, and does not move `doctor` into the prompt-required inventory. The operator surface is the preflight, identifier-only status evidence within the existing digest schema version, and documentation.
- **Source:** internal standard (spec NG-1, DEC-5, DEC-8) + AC (AC-F6-2, AC-F6-3, NFR-8)
- **Verification:** test (help inventory and doc-conformance pins) + audit
- **Negotiable:** no

> **Table stakes:** the TDR-0005 token/exit taxonomy, the TDR-0012 name-only diagnostic posture and its registered-value redaction chokepoint, the delivered per-request timeout, the closed error-table count, and the bash fallback's authority read. Every eligible alternative below satisfies them and they are not scored again.

## Decision Drivers

1. **Fail before the unverifiable step** — the whole operator value is converting a delivered-but-unverifiable attempt into a one-second refusal (G-1, PP-1), and making the resulting trade-off (refuse rather than deliver without a verdict) explicit.
2. **An actionable prerequisite** — a refusal that does not name the key is unactionable; naming it without the value is the change's entire signal-to-risk ratio (G-2, PP-2).
3. **Stable machine identity** — coordinators and agents must branch on tokens and error identities, not on prose; the identity set must not grow (DEC-7, G-7).
4. **Secret-surface integrity** — a supported provisioning story must not widen what the engine may read; deny-by-default is the property being protected, not the obstacle (G-5, DEC-4).
5. **Reversibility and low ceremony** — an optional port, no new identity, no new configuration: the smallest change that removes the defect and can be reverted without migration (project decision principle: reversibility, paved road).
6. **Visible before queueing** — the prerequisite should be discoverable where the decision to spend work is made, not only when it is already spent (G-6).
7. **Determinism and diagnosability** — identical injected inputs (clock, id factory, environment) produce byte-identical refusals; the refusal is classified and rendered like any other classified failure (the invocation audit ledger is out of scope, so it is not durably audited) (NFR-4).

## Decision Rights (DACI)

- **Driver:** `@pm` — the change owner for GH-279; decisions D1/D4/D5 are recorded in `chg-GH-279-pm-notes.yaml`, analysis and record by `@decision-advisor`.
- **Decider / Approver:** Juliusz Ćwiąkalski — the one accountable human authority. **Acceptance is pending at the GH-279 PR review**; this record claims no acceptance, stays `Proposed` with `decision_date: null`, and grants no authority in the interim.
- **Contributors:** `@spec-writer` (DEC-1, DEC-4…DEC-8, F-1/F-2/F-5/F-6, Appendix A/C, the observed production evidence), `@decision-advisor` (analysis, record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` during delivery; the human owner at PR review — the provisioning posture and the added admission read are owner-visible consequences, not implementation details.
- **Performers:** `@test-plan-writer` (refusal, zero-side-effect, canary oracles), `@plan-writer` (ordering and composition wiring), `@coder` (delivery).
- **Informed:** dispatch operators on gh-authenticated installs; M1-S9 operational owners (the handover gate's reachability depends on provisionability); bash fallback maintainers (unchanged).
- **Timing and escalation:** recorded during GH-279 specification, before delivery. Implementation may proceed with acceptance pending (TDR-0003/TDR-0005/TDR-0012 precedent). Unresolved disagreement escalates to the owner.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The engine claims the lease and spawns before it reads truth, so a credential failure is discovered only after a session. | FACT | `packages/core/src/app/dispatch.ts` `runDispatch`; spec §2.1 | The defect's cost model would be wrong; the preflight would be a nicety, not a fix | High |
| Production declares `github-read` over the literal key `GITHUB_TOKEN` and no other source. | FACT | `packages/cli/src/production.ts` | The refusal text, guide, and status evidence would name the wrong key | High |
| An absent or empty key fails as `config.credential.missing` (user, `not_landed`, exit 1); whitespace is a value. | FACT | `packages/adapters/src/credentials/index.ts` | The refusal would carry the wrong identity or a fabricated success | High |
| The delivered read path performs no admission classification: `packages/adapters/src/github/client.ts` maps only HTTP `404` to the internal `provider.not-found`; every other non-2xx returns the adapter-local `provider.payload.invalid` with `httpStatus`; a transport throw returns it without `httpStatus`; a malformed `2xx` payload also returns it without a transport status. | FACT | `packages/adapters/src/github/client.ts` (`get`); `packages/adapters/src/io/provider-transport.ts:45-95`; `packages/adapters/src/github/normalize.ts`; spec F-2.4/NFR-13 | Forwarding the adapter identity would collapse credential rejection and outage into one payload fault, and a received malformed `2xx` could not be told apart from a transport throw | High |
| The rows each admission outcome maps to already exist and declare their own domain kinds: `provider.auth.rejected`, `provider.outage`, and the adapter-local `provider.payload.invalid` are `kind: "provider"`; `input.value.rejected` is `kind: "input"`. `classifyDomainKind`/`classifyThrown` contain a kind/code mismatch as `fallback.internal`, and `DispatchRunResult`'s error union admits only `input`/`queue`/`state`/`harness`/`dispatch`. | FACT | `packages/core/src/contracts/error-table.ts`; `packages/cli/src/classify.ts`; `packages/core/src/app/dispatch.ts` (`DispatchRunResult`) | A provider pair returned under the narrower union, or carried with the wrong kind, would surface as `fallback.internal` and lose its identity, projection, and exit | High |
| The delivered `ports.admission` seam runs after the lease claim and appends an attempt record on refusal; it is not a pre-session precondition. | FACT | `packages/core/src/app/dispatch.ts` (`runDispatch`; `DispatchAdmission`) | The new preflight could be confused with, or wired through, the wrong seam | High |
| Two composition suites currently assert spawn-then-`state-unverified` for a refusing credential port. | FACT | `tests/structure/dispatch-composition.test.ts`; spec PP-7 | The change could ship with the defect still pinned as expected behaviour | High |
| GH-241 delivered its work (eleven complete phases, an open PR) but its verdict was unverifiable; no evidence shows the delivered work was discarded. | FACT | spec §2.1; observed production evidence 2026-11-10 | The harm would be misdescribed as wasted work rather than an unverifiable delivery | High |
| One bounded single-entity work-item read is a sufficient admission probe for credential validity and basic reachability. | ASSUMPTION | spec A-2 | A read that passes while artifact/CI truth stays unreadable leaves a residual late-discovery path (RSK-1) | Medium |
| On a default gh-authenticated install, `gh auth token` can supply the value for an explicit operator export; the product never runs it. | ASSUMPTION | spec A-3 | The documented bridge would not work as written on some installs | Medium |
| The added read can be addressed separately from the post-session truth read in fixtures (shared transport). | ASSUMPTION | spec A-9, RSK-11 | The two failure populations could not be asserted separately | Medium |
| Denominator for the operator impact: how many existing installs rely on `gh` alone. | TO-CONFIRM | Not measured; `docs`/telemetry do not exist for it | The upgrade blast radius (RSK-2) could be under- or over-stated | Low |
| How many non-interactive consumers (automation, wrappers, CI jobs) branch on `dispatch.state-unverified`/exit `2` and expect an attempt record on a refused dispatch. | TO-CONFIRM | No in-repo consumer is known to depend on it; external population unmeasured (spec §18) | The compatibility break (R-1) could affect more automation than the change admits | Low |
| An exported environment value is readable through same-user process inspection and `/proc/<pid>/environ` for every process that inherits it; the product cannot revoke that exposure. | FACT | POSIX process-environment semantics; spec F-5.4 | The bridge would be described as safer than it is | High |
| The change registers the resolved truth-read key for redaction at the runtime edge when present, consuming injected environment facts and adding no ambient read. | FACT | spec F-5.8; `registerEdgeSecrets` at `packages/cli/src/edge.ts` | The documented bridge would not be redacted on product-rendered surfaces | High |
| Whether operators want a standalone read-only probe (`dispatch --check` shape) in addition to dispatch-time admission. | TO-CONFIRM | Deferred (spec §7.3); no request recorded | A convenience surface may be requested later; it does not change this decision | — |

## Mental Models & Techniques Used

- **First principles:** separate *admission* (a precondition about the engine's ability to verify) from *outcome* (a fact about the attempt). The defect is a category error — a precondition evaluated in the outcome path — not a missing error code.
- **Inversion:** how would an operator be made to spend the most before discovering a one-second precondition? Let them run a full session and then deliver work whose verdict can never be trusted. How would the secret surface be widened? Let "provisioning convenience" read the keyring. Each inversion names a constraint (C-1, C-4).
- **Second-order thinking:** naming the key turns a mysterious failure into a prerequisite and makes the upgrade cost visible; the chosen refusal deliberately converts "deliver without a verdict" into "refuse before delivery", which is a real compatibility cost — mitigated by documentation in the same change and a refusal that states the fix, not a silent fallback.
- **Systems thinking:** credential port → reference declaration → production composition → refusal text → guide → status digest → handover-gate reachability. A change at one node that skips the others yields a correct engine that no default install can use.
- **Opportunity cost:** one extra bounded read per admitted dispatch buys removal of an unverifiable delivery per unprovisioned attempt; the asymmetry is in verdict trust, not in rescued work.
- **KISS / least vocabulary:** reuse the existing identities, exits, and digest shapes; the only structural addition is one optional `preflight` port, and the rest is prose.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 side-effect-free | C-2 names only | C-3 identity stable | C-4 surface intact | C-5 engine neutral | C-6 disclosure only | Eligibility |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| ALT-0 do nothing | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | Not eligible |
| ALT-1 recorded attempt-stage refusal, exit 2 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | Not eligible |
| ALT-2 implicit keyring/ambient resolution | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | Not eligible |
| ALT-3 selected pre-session preflight | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Eligible |
| ALT-4 ship `doctor` (or add `dispatch --check`) as the prerequisite surface | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | Not eligible |
| ALT-5 mandatory (non-optional) preflight port | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Not eligible |
| ALT-6 one synthetic `provider.payload.invalid` for every admission-read failure | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | Not eligible |

Legend: ✅ passes · ❌ fails. No alternative relies on an accepted-risk exception.

### Alternative 0 — Do Nothing / Keep Post-Session Discovery

- **Eligibility:** Not eligible (fails C-1 and C-2).
- **Summary:** Ship no admission check; keep discovering the credential problem after the session, optionally with a slightly richer `state-unverified` message.
- **Constraint compliance:** Fails C-1 (a session, a lease, a branch, and an attempt record exist before the refusal) and C-2 (the identity is a code; nothing names the key).
- **Driver fit:** Worst on drivers 1 and 2.
- **Pros:** No added read, no behavior change, no upgrade risk.
- **Cons:** Every unprovisioned attempt delivers work whose verdict cannot be trusted; the prerequisite stays unnameable; the two pinned composition suites keep defending the defect.
- **Why rejected:** It preserves exactly the two harms the change exists to remove — unverifiable delivery and an unnameable prerequisite — and delays the prerequisite until after a full session.

### Alternative 1 — Recorded Attempt-Stage Refusal at Exit 2

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Keep the current run order; when the credential is missing, refuse *at attempt stage* — append one attempt record carrying the refusal, name the key and the reference in the diagnostic, and exit `2` under `state-unverified`.
- **Constraint compliance:** Passes C-2 (the message can name the key), C-3 (no new identity), C-4, C-5, C-6; fails C-1 because the lease, the session, the branch, and an attempt record exist before the refusal, which is exactly the side effect being eliminated.
- **Driver fit:** Good on drivers 2 and 3, fatal on driver 1; it also muddies the audit truth by manufacturing an attempt that never attempted anything.
- **Pros:** Audit trail shows the refusal as a dispatch outcome; no ordering change; smaller diff.
- **Cons:** Still completes a session whose verdict is only an outcome token; conflates a precondition with an outcome; an attempt record with no session misrepresents the ledger; consumers cannot distinguish "nothing started" from "attempt failed" (spec §22).
- **Why rejected:** It makes the refusal *better described* while leaving it *after the session*. The single property that matters — nothing started — is unavailable by construction once the session exists.

### Alternative 2 — Implicit Keyring / Ambient-Environment Resolution

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** When the declared key is unset, fall back to the OS keyring (or run `gh auth token`, or try `GH_TOKEN`, or inherit the parent environment) so a default gh-authenticated install simply works.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-5, C-6; fails C-4 decisively — it widens the secret-read surface, makes the engine's credential source implicit and environment-dependent, and cannot state which source produced a value without leaking provenance.
- **Driver fit:** Best on driver 1 by eliminating the problem's frequency, worst on driver 4, which is a `negotiable: no` gate.
- **Pros:** Zero operator action; the defect becomes almost unobservable.
- **Cons:** Deny-by-default is gone in practice; the engine reads material it was never given; every future consumer inherits an implicit source; failure diagnosis becomes guesswork about which fallback fired.
- **Why rejected:** Disqualifying constraint violation. It trades a named, documented prerequisite for an unnamed one — the inverse of the change's purpose.

### Alternative 3 — Selected: Pre-Session Preflight as an Optional Injected Port

- **Eligibility:** Eligible (passes C-1…C-6).
- **Summary:** After harness resolution and input validation and before `claimLease` and the spawn/resume block, resolve the declared reference through the credential port and, when it resolves, perform exactly one minimal bounded work-item read. Refuse on either failure with a bounded single-line summary naming the resolved key, the reference, and one remediation; **classify the read outcome in the production preflight at the composition boundary from the returned failure's optional `httpStatus`** and map it onto its existing row (`401`/`403` → `provider.auth.rejected`, `5xx`/other non-2xx/transport throw → `provider.outage`, received-but-malformed `2xx` → adapter-local `provider.payload.invalid`, `404` → `input.value.rejected` with the provider-reported absence). Enter the engine as a **new optional `preflight` port** distinct from `ports.admission`; supply it in production; document the explicit export bridge; surface the same facts as identifier-only status evidence.
- **Constraint compliance:** Passes all six by construction — the refusal precedes every dispatch-ledger effect (C-1), renders names only (C-2), maps every read failure to an existing declared identity and exit (C-3), adds no secret read (C-4), keeps the engine neutral and proves production wiring (C-5), and ships no command, flag, or key (C-6).
- **Driver fit:** Best overall — it is the only alternative that serves driver 1 without paying driver 4.
- **Pros:** Converts an unverifiable delivery into a pre-session refusal; names the prerequisite; maps failures to the row that describes them; adds one bounded read only when the credential resolves; reversible without migration; no new contract surface.
- **Cons:** Adds a network round trip to admission and therefore a new refusal class for transient provider trouble (RSK-1); changes the observable failure mode for unprovisioned installs from delivered-but-unverifiable to refused (RSK-2, R-1).
- **Why chosen:** See Decision.

### Alternative 4 — Ship `doctor`, or Add a `dispatch --check` Probe, as the Prerequisite Surface

- **Eligibility:** Not eligible (fails C-1 and C-6).
- **Summary:** Expose the prerequisite through a separate diagnostic surface — ship `doctor` with its credential check, or add a read-only `dispatch --check` probe — and leave admission unchanged.
- **Constraint compliance:** Fails C-6 (a shipped command or a new flag outside the declared inventory) and C-1 (dispatch still discovers the problem after the session; a separate probe is opt-in and therefore not an admission gate).
- **Driver fit:** Good on driver 6 only; drivers 1–3 unserved.
- **Pros:** No change to the dispatch path; the surface is voluntarily runnable.
- **Cons:** The operator must already suspect the problem; nothing refuses; the inventory moves, which the change explicitly does not do.
- **Why rejected:** A prerequisite that must be checked manually is not an admission gate, and shipping a command is a separate decision with its own inventory consequences.

### Alternative 5 — Mandatory (Non-Optional) Preflight Port

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Make the preflight a required engine port so no composition can forget it; every direct engine caller must supply one.
- **Constraint compliance:** Fails C-5: a required port breaks direct engine callers and pushes I/O composition knowledge into the runtime-neutral core contract.
- **Driver fit:** Strong on the production-wiring risk (RSK-7), weak on driver 5.
- **Pros:** The defect cannot survive an unwired production composition by construction.
- **Cons:** The engine stops being usable without a preflight; every existing test and in-process consumer must synthesize one; the optionality that protects the engine's neutrality is lost for a wiring risk that a single composition test covers.
- **Why rejected:** The same protection is obtained by one assertion at the composition boundary, without changing the engine contract.

### Alternative 6 — One Synthetic `provider.payload.invalid` for Every Admission-Read Failure

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Keep the pre-session ordering and the named credential refusal, but classify **every** failing minimal read — authentication, transport, timeout, `5xx`, malformed payload, and `404` — as the adapter-local `provider.payload.invalid`.
- **Constraint compliance:** Passes C-1, C-2, C-4, C-5, C-6; fails C-3 because it replaces the existing rows that describe each outcome with one blanket platform identity. A `401`/`403` becomes a non-retryable platform failure at exit `2` instead of a user-actionable `provider.auth.rejected` at exit `1`; a provider-reported absence becomes a malformed-payload report instead of `input.value.rejected` naming the ref; a transient outage loses its retryable `provider.outage` identity.
- **Driver fit:** Weak on drivers 2 and 3: the operator is told to repair the wrong thing, and automation that branches on identity cannot distinguish a bad token from a provider-reported absence.
- **Pros:** One identity, the smallest diagnostic surface, no mapping table.
- **Cons:** It is the same diagnostic collapse the change removes on the resolve path, relocated to admission; retryability, remediation, exit, and the named ref are all lost for the cases that need them most.
- **Why rejected:** Existing declared rows already describe every admission-read outcome accurately; a blanket identity needs no new vocabulary but misreports the failure, category, retryability, and exit the operator depends on.

## Decision

- **Decision:** **ALT-3.** A dispatch performs a pre-session credential and truth-read preflight, and the prerequisite is disclosed by name, in a form the operator can act on.

1. **Ordering.** The preflight runs after harness resolution and input validation and **before** the queue-lease claim (`claimLease`), before the spawn/resume block, and before any attempt, divergence, or handover record can exist. It applies to a fresh dispatch and a resume alike.
2. **Resolution.** The preflight resolves the declared truth-read reference through the credential port. In production that is `github-read` over the literal key `GITHUB_TOKEN`; no fallback key, prefix, or keyring source is consulted.
3. **Missing credential.** When resolution fails, the preflight refuses **without issuing any request**, so zero requests leave the process. The refusal is the ordinary top-level error envelope with `config.credential.missing` (user, non-retryable, `not_landed`, exit `1`) and a bounded single-line summary naming the resolved key, the reference, and one remediation. No lease, session, branch, worktree, attempt record, divergence record, or authority write is created; the p100 latency is under two seconds.
4. **Failing read, classified by the preflight.** When resolution succeeds, the preflight performs exactly one minimal bounded work-item read: no pagination, no retries, the delivered per-request timeout. **The adapter does not classify this outcome and its identity is not forwarded:** `packages/adapters/src/github/client.ts` returns the internal `provider.not-found` only for HTTP `404`, and the adapter-local `provider.payload.invalid` for every other failure — with `httpStatus` when a response was received, without it when the transport threw, and without it for a malformed `2xx` payload because the normalizers never see the status. The production preflight implementation, composed where the `github-read` reference is declared, therefore inspects the returned failure's optional `httpStatus` (`packages/adapters/src/io/provider-transport.ts:45-95`) and decides the admission identity itself:
   - `httpStatus` `401` or `403` → `provider.auth.rejected` (`kind: "provider"`; user, non-retryable, `not_landed`, `user-validation`, exit `1`).
   - `httpStatus` `5xx` → `provider.outage` (`kind: "provider"`; transient, retryable, `not_landed`, `platform-provider`, exit `2`).
   - `httpStatus` `404` → `input.value.rejected` (`kind: "input"`; user, non-retryable, `not_landed`, `user-validation`, exit `1`) with a bounded summary stating that **the provider reported the work item as absent**. The internal `provider.not-found` marker is consumed here and is never exposed as an identity.
   - A status-bearing non-2xx that is none of those (for example `400`, `422`, `429`) → `provider.outage`, because the provider answered but the answer is not an admission fact.
   - A status-absent failure → `provider.outage`: once the read stamps a received response's status on every decode failure (next bullet), a status-absent failure can only mean no response was received, i.e. the transport threw.
   - A **received-but-malformed `2xx`** → the existing adapter-local `provider.payload.invalid` (`kind: "provider"`; platform, non-retryable, `unknown`, `platform-provider`, exit `2`). This case must stay distinguishable from the transport throw, and the chosen mechanism is an **additive discriminator on the failure shape: populate the received status, which the decode path currently drops, onto the decode failure.** The bounded read stamps `httpStatus` (the `2xx` it received) onto the normalizer's `provider.payload.invalid` failure, so a malformed `2xx` carries a status and a transport throw carries none; no new field, code, row, or identity is added, and the `httpStatus` contract already means "the structured, secret-free HTTP status when a response was received". Verification must assert both halves of the pair (malformed `2xx` with a stamped status → `provider.payload.invalid`; transport throw with no status → `provider.outage`).
   - A failure that already carries the declared credential identity (`config.credential.missing`, returned when the read itself re-resolves the reference) is surfaced as that identity, not as an outage: the prerequisite is the same one the preflight resolved, and a missing key must never be reported as provider trouble.
   Every branch is carried with the domain kind its row declares (`provider` for the three provider identities, `input` for `input.value.rejected`), because `classifyDomainKind`/`classifyThrown` contain a kind/code mismatch as `fallback.internal`; `DispatchRunResult`'s error union is widened additively to admit `provider` so those pairs can leave the engine at all. No new error identity is introduced and no identity is collapsed into `dispatch.state-unverified`.
5. **New optional `preflight` port, mandatory wiring.** The preflight enters the engine as an optional `preflight` port, explicitly distinct from the delivered `ports.admission` seam (which runs after `claimLease` and appends an attempt record when it refuses). A direct caller that supplies none keeps the current run order and outcome. Production always supplies it, and a composition test asserts both the wiring and that a refusing credential port yields zero spawns and a typed refusal.
6. **No residue.** A successful preflight leaves no record of its own and does not alter the run; the post-session truth read is unchanged.
7. **Provisioning is an operator act.** The `gh`-keyring bridge is documentation plus an explicit export in the operator's own shell (`export GITHUB_TOKEN="$(gh auth token)"`, command-substitution form, value never printed); the engine never reads the keyring, never inherits ambient variables implicitly, and never falls back to another key. The guide states the exposure and the controls: an exported value is readable by same-user processes and through `/proc/<pid>/environ` for every process that inherits it, so the token should be dedicated to this purpose, least-privilege and read-scoped to the smallest repository set the provider supports, short-lived, rotated and revoked on a schedule and after any suspected exposure, exported only for the command's lifetime where practical, and unset afterward. The change registers the resolved truth-read key for redaction at the runtime edge, so product-rendered surfaces redact it; shell history, process listings, and other same-user processes remain outside the product's control (accepted residual).
8. **Disclosure surface.** Status reports the prerequisite as failed credential evidence in the credential-dependent sections with the existing closed reason `credential-unavailable`, and carries the identifier-only facts in an **optional section-level `credentialPrerequisite` node on the status evidence record — `{ referenceName, sourceKey }` — present only when a credential-dependent source actually failed.** It is not an extension of the bounded `sources[]` entry shape: the additive data is a section-level prerequisite descriptor, so no existing field on a source entry changes meaning, no per-source bound is reinterpreted, and the closed finding/section/state vocabulary is untouched within the existing digest schema version — no new section, state, finding code, or count. Doctor keeps parity through its existing `tracker.credential-unavailable` hint and stays outside the shipped prompt-required command set in this change; shipping doctor is a separate decision.
9. **Unchanged surfaces.** `state-unverified` keeps its delivered meaning for a post-session truth failure and its exit `2`; the token set, projection classes, error-table identities, configuration keys, command inventory, credential reference model, and bash fallback are unchanged. The admission-read mapping reuses existing rows only; it introduces no new error identity and no internal marker exposed as one. The only contract widening is additive and narrow: `DispatchRunResult`'s error `kind` union admits `provider`, so a mapped provider row can leave the engine typed.

- **Rationale (tied to drivers):** The engine already knows what it needs; it merely asks too late. Moving the question to admission replaces a delivered-but-unverifiable attempt with a pre-session refusal (driver 1) at the cost of one bounded read, and lets the refusal carry the only fact that helps — the key name (driver 2) — while mapping each read failure to the identity that describes it, so every identity and exit stays meaningful (driver 3). Documentation-only provisioning is the smallest bridge that does not widen the secret surface (driver 4). The `preflight` port keeps the engine's neutrality and makes the change reversible without migration (driver 5), and the status evidence puts the prerequisite where the decision to spend work is actually made (driver 6), deterministically (driver 7). The price is explicit: an unprovisioned install now refuses delivery instead of delivering work without a verdict.
- **Decider:** Juliusz Ćwiąkalski — acceptance pending at the GH-279 PR review; not claimed by this record.
- **Conditions for revisit:** See `revisit_triggers`; the primary ones are a reference/key change, any request for implicit key resolution, a read that is an insufficient probe, an unwired production composition, and any credential-material escape.

### Constraint Compliance Attestation

The chosen alternative satisfies every constraint. The accepted residuals (invocation-audit observability, operator-side bridge exposure, the compatibility break for non-interactive consumers, and the ambiguity of a provider-reported `404`) are recorded in Negative Outcomes; none is an exception to a `negotiable: no` constraint.

- **C-1** — the preflight is ordered before `claimLease`, the spawn/resume block, and every dispatch-ledger write, and the missing-credential path issues no request at all; the composed-path tests assert zero spawns, zero dispatch-ledger records, and zero writes to the dispatch/attempt/divergence/handover/authority ledgers (the invocation audit ledger is out of scope) (AC-F1-1/AC-F1-2, NFR-3).
- **C-2** — both the machine envelope and the human diagnostic render the derived key name and the reference name only; a planted-secret canary covers envelope, human, digest, and record paths (AC-F2-1…AC-F2-3, NFR-2).
- **C-3** — `config.credential.missing` and each mapped read outcome are delivered rows; the production preflight decides the outcome from the returned `httpStatus` rather than forwarding the adapter identity, every pair carries the domain kind its row declares, `DispatchRunResult` admits `provider` additively, and no blanket identity, new token, new identity, or exit outside `{0, 1, 2}` is introduced (AC-F1-3, DEC-7, NFR-8/NFR-13).
- **C-4** — resolution still goes through the single declared reference and the credential adapter; the bridge is prose plus an operator command (AC-F5-1, DEC-4, NFR-9).
- **C-5** — the new `preflight` port is optional in the engine contract, distinct from `ports.admission`, ordered before `claimLease` and the spawn/resume block, and mandatory in production composition, proven by wiring and ordering assertions (F-1.1/F-1.2/F-1.7, DEC-6).
- **C-6** — no command, flag, configuration key, or shipped-command inventory change; the status addition is optional identifier-only data (AC-F6-2/AC-F6-3, DEC-5, DEC-8).

## Trade-offs & Consequences

### Positive Outcomes

- The failure is discovered before the delivery consequence: a one-second, dispatch-side-effect-free refusal replaces a delivered-but-unverifiable attempt, and the "nothing started" property becomes reportable (spec §22).
- The prerequisite becomes nameable and therefore fixable: one line names the key, the reference, and the remedy, in both machine and human form.
- Each admission-read failure is diagnosable rather than collapsed: authentication, outage, malformed payload, and a provider-reported absence keep their own category, retryability, remediation, and exit, and each is carried with the domain kind its row declares.
- The adapter stays unclassified: the outcome decision lives at the composition boundary where the declared reference lives, so the adapter's internal `provider.not-found` marker never becomes an identity and the engine receives only a classified refusal.
- The secret surface is untouched: exactly one declared key through one declared reference, no keyring, no ambient inheritance, no fallback chain.
- A supported provisioning path exists for the install type most operators actually have, and it is an explicit operator act whose exposure is documented (history hygiene, command substitution, least privilege, rotation) and whose value is registered for redaction.
- No contract churn: no new token, identity, exit, configuration key, or command; the handover gate's reachability is no longer blocked by an unprovisionable prerequisite.
- Existing installs get a truthful diagnostic signal: a precondition refusal is distinguishable from an attempt-stage outcome because there is no attempt record to misread (though the refusal itself is not durably audited in this change).

### Negative Outcomes

- **The chosen policy refuses delivery on an unprovisioned install (accepted, mitigated).** This is the real trade-off: work that previously would have been delivered — but without a verdict — is now refused before the session. Every install that relied on `gh` alone must export `GITHUB_TOKEN` (or declare another supported reference) before upgrading. The refusal text, the provisioning guide, the reference page, and the PR description carry the message in the same change, so the failure is loud, immediate, and self-explaining rather than a silent unverifiable delivery (spec §18, RSK-2).
- **Breaking admission change for non-interactive consumers (accepted, documented).** Automation that keyed on `dispatch.state-unverified`/exit `2` and expected an attempt record for an unprovisioned dispatch now sees a pre-session refusal: `config.credential.missing`/exit `1` (unresolvable credential) or `provider.auth.rejected`/exit `1` (`401`/`403`), with no attempt record to read; outage, other non-2xx answers, and transport failures surface `provider.outage`/exit `2`, a malformed `2xx` surfaces `provider.payload.invalid`/exit `2`, and a work item the provider reports as absent surfaces `input.value.rejected`/exit `1`. The taxonomy does not change; the event class does, so this is a behaviour-breaking release for automation even though no contract row is added. The reference page, the release note/changelog, and the PR description state the new class and that a precondition failure must not be parsed as an attempt outcome (R-1).
- **`404` cannot separate absent from invisible (accepted residual).** A private resource outside the credential's visibility also returns `404`, so `input.value.rejected` describes the provider's answer, not a proven typo. The mitigation is wording and remediation: the summary states that the provider reported the work item as absent and names the reference, and the remedy names both checks — confirm the reference, and confirm the repository scope/visibility of the credential (R-4).
- **A pre-session refusal is not durably recorded (accepted residual).** The invocation audit ledger is out of scope for this change, so a misconfigured install that refuses repeatedly leaves no durable record; the operator sees the refusal only in that invocation's output (and whatever the caller retains). Repeated misconfiguration is therefore not observable after the fact from the product's own state (RSK-12).
- **Operator-side bridge exposure (accepted residual).** Exporting a broad-scope token into the environment exposes it to same-user processes and `/proc/<pid>/environ` for the lifetime of the shell and every process that inherits it; the product cannot revoke that exposure. Least-privilege scoping, short expiry, rotation/revocation, command-lifetime export, and unsetting are documentation controls, not enforcement. The change registers the resolved key for redaction at the runtime edge, so product-rendered surfaces mask it, but shell history, process listings, and other same-user processes remain outside the product's control (RSK-4).
- **One extra bounded read per admitted dispatch.** A transient provider problem at admission can now refuse work that a later attempt might have completed; the mitigation is that the refusal carries the mapped identity and its remediation, so the operator fixes reachability rather than credentials, and no retry loop or retry storm is added (RSK-1).
- **A new operator concept to learn.** Runbooks must distinguish a precondition refusal (nothing started) from an attempt-stage outcome (an attempt exists) — documented as a maintenance obligation (spec §22).
- **Diagnostic disclosure is now part of the product surface.** The key name and reference become contract-visible in refusals and in status evidence, so a future reference rename has a documentation and test obligation in the same change (revisit trigger 1).

### Accepted Residual Risk Register

| ID | Residual | Why accepted | Bound / mitigation |
|---|---|---|---|
| R-1 | Breaking admission change for non-interactive consumers: automation keyed on `dispatch.state-unverified`/exit `2` now sees `config.credential.missing`/exit `1`, `provider.auth.rejected`/exit `1`, `provider.outage`/exit `2`, `provider.payload.invalid`/exit `2`, or `input.value.rejected`/exit `1`, with no attempt record. | The chosen policy deliberately refuses delivery on an unprovisioned install; keeping the old event shape would preserve the unverifiable-delivery defect. | The taxonomy is unchanged; the reference page, release note, and PR description state the new event class; no in-repo consumer is known to depend on the old shape; external population is TO-CONFIRM (revisit trigger 6). |
| R-2 | A pre-session refusal is not durably recorded: the invocation audit ledger is out of scope, so repeated misconfiguration is not observable after the fact. | Extending the audit ledger is a separate contract change; it is not needed to remove the unverifiable-delivery defect. | The refusal is fully visible in the invocation envelope and human diagnostic; the limitation is documented; a future audit change can close it. |
| R-3 | Operator-side bridge exposure: an exported token is readable by same-user processes and `/proc/<pid>/environ`; shell history and process listings are outside product control. | Deny-by-default forbids the engine from reading the keyring or inheriting ambient variables; an explicit operator export is the narrowest supported bridge. | Least-privilege scoping, short expiry, rotation/revocation, command-lifetime export, and unsetting are documented; the resolved key is registered for redaction so product-rendered surfaces mask it. |
| R-4 | HTTP `404` is ambiguous: a private resource the credential cannot see also returns `404`, so the admission read cannot separate "the work item does not exist" from "the credential cannot see it". | The provider deliberately does not disclose the existence of resources the credential cannot read; no bounded read can separate the two, and the alternatives (a blanket payload identity or an outage) misreport a user-actionable prerequisite. | The summary is worded as **the provider reporting the work item as absent** and names the reference; it never asserts that the reference itself is wrong. The remediation names both checks — confirm the reference, and confirm the credential's repository scope/visibility — so a visibility problem is not mistaken for a typo. |

### Unresolved Questions

- [ ] Measure the population of installs that rely on `gh` alone so the upgrade message can be targeted (owner: `@pm`, ticket/GH-279 PR description; not blocking delivery).
- [ ] Identify external non-interactive consumers that branch on the old attempt-stage outcome so the compatibility note can be targeted; no in-repo consumer is known to (owner: `@pm`, GH-279 PR description; not blocking delivery).
- [ ] Decide separately whether a standalone read-only probe (`dispatch --check` shape) or shipping `doctor` is worth a command-surface change; both are explicitly deferred, not rejected on merit (owner: Juliusz Ćwiąkalski, spec §7.3).
- [ ] Extend the same admission preflight to daemon-driven lane launches on the shared lane seam (owner: the resident-daemon change; spec §7.3).

## Implementation Plan

1. **Contracts and declarations:** no new identity or exit; the new optional `preflight` port shape, the additive `provider` member on `DispatchRunResult`'s error `kind` union, and the optional section-level `credentialPrerequisite` node (`{ referenceName, sourceKey }`, present only when a credential-dependent source failed) are declared additively within existing contracts. The error table and taxonomy stay at their current count with the sync check green.
2. **Engine and composition:** insert the `preflight` port between input validation and `claimLease`, before the spawn/resume block and distinct from `ports.admission`; perform one bounded read; **classify its outcome in the production preflight at the composition boundary** from the returned failure's optional `httpStatus` (401/403, 5xx, other non-2xx, transport throw, malformed `2xx`, 404), carry the row's domain kind, and return the typed refusal; stamp the received `2xx` status onto the decode failure at the read so a malformed payload stays distinguishable from a transport throw. Wire the port in production and prove the wiring, ordering, classification, and zero-spawn behavior in the composition suite. Invert the pinned assertions rather than deleting them (AC-F1-1…AC-F1-5, RSK-8).
3. **Surfaces:** render the named-key refusal in machine and human modes; add the optional section-level `credentialPrerequisite` facts to the credential-dependent status sections; keep doctor's hint covered by a parity test while the shipped inventory stays pinned.
4. **Documentation:** a provisioning guide (exact key, reference, explicit export bridge, no implicit inheritance, history hygiene, least-privilege scoping, rotation/revocation, registered-redaction statement) with its distribution marker; the dispatch reference page updated with ordering, the read-outcome identity/kind/exit mapping (including that a reported `404` means the provider reports the item as absent, not that the ref is proven wrong), the non-interactive consumer compatibility note, and the resolution path; feature specs reconciled after delivery.
5. **Rollout:** single PR to `main-tools`, no feature flag — the refusal is the feature; the PR repeats the export-before-upgrade message and records one real credentialed dispatch that reaches a verdict other than `state-unverified`, with no token committed, printed, or attached.

## Verification Criteria

- **Refusal precedes every dispatch-ledger effect:** for a refusing credential port — 0 spawns, 0 resumes, 0 leases, 0 branches, 0 attempt/divergence/handover records, 0 writes to the dispatch/attempt/divergence/handover/authority ledgers (Target: 0 each; Window: composition and admission suites; AC-F1-1/AC-F1-2). The invocation audit ledger is excluded by scope.
- **Refusal latency:** missing-credential refusal p100 < 2 000 ms on the reference environment with 0 network requests in that path (Target: < 2 s; Window: NFR-1 measurement).
- **Named prerequisite:** 100% of credential refusals name the resolved key and the reference in both machine and human form, including the fully derived prefixed form, and carry `config.credential.missing` under `kind: "config"` with its delivered projection and exit `1` (Target: 100%; Window: AC-F2-1/AC-F2-2).
- **Read-outcome mapping:** 100% of admission read failures map to the declared row, domain kind, projection, and exit — `401`/`403` → `provider.auth.rejected`/`provider`/`user-validation`/exit `1`; `5xx` and any other status-bearing non-2xx → `provider.outage`/`provider`/`platform-provider`/exit `2`; malformed `2xx` → `provider.payload.invalid`/`provider`/`platform-provider`/exit `2`; status-absent transport throw → `provider.outage`/`provider`/`platform-provider`/exit `2`; `404` → `input.value.rejected`/`input`/`user-validation`/exit `1` with the reference named and the summary stating the provider reported the item as absent (Target: 100%; Window: AC-F1-3/F-2.4, NFR-13).
- **Outcome-discrimination integrity:** the malformed-`2xx`-and-transport-throw pair is asserted separately — a malformed `2xx` carries the received status stamped onto the payload failure and classifies `provider.payload.invalid`, a transport throw carries no status and classifies `provider.outage` (Target: 2 of 2; Window: admission suite).
- **Classification placement:** 0 admission outcomes are decided by forwarding the adapter identity; 100% are decided by the production preflight from the returned failure's `httpStatus`; 0 provider pairs classify as `fallback.internal` (Target: 0 / 100% / 0; Window: composition and classification suites).
- **Secret non-disclosure:** 0 occurrences of a registered planted value in any envelope, diagnostic, summary, digest, evidence reference, or record (Target: 0; Window: canary suite, NFR-2).
- **Identity stability:** 0 new tokens, 0 new error-table identities, 0 new error identities, 0 exits outside `{0, 1, 2}`, 0 new configuration keys, 0 commands or flags (Target: 0 each; Window: taxonomy/error-table/help pins, NFR-8).
- **Boundary integrity:** 0 new environment reads outside the credential adapter; the secret-read boundary check stays green (Target: 0; Window: boundary suite, NFR-9).
- **Wiring and ordering integrity:** the production composition supplies the `preflight` port; `preflight` precedes `claimLease` and spawn/resume; a refusing credential port yields a typed refusal with 0 spawns (Target: 1 of 1; Window: composition suite, RSK-7).
- **Operator visibility:** `status` reports the prerequisite as failed credential evidence with `credential-unavailable`, carries `{ referenceName, sourceKey }` on the optional section-level `credentialPrerequisite` node of each affected section (present only when that credential-dependent source failed, never on a healthy section), and exits `0` with all nine sections (Target: 1 of 1; Window: AC-F6-1/AC-F6-2).
- **Real evidence:** one real credentialed dispatch reaches a verdict other than `state-unverified` (Target: 1 of 1; Window: PR evidence, spec §18).

## Confidence Rating

**High.** Every load-bearing fact is repo-local and read directly: the admission order, the delivered `ports.admission` seam, the declared reference and its literal key, the credential port's derivation and failure identity, the delivered read path's single `404` marker and status-bearing payload failure, the rows and domain kinds each admission outcome maps to, the two composition suites that pin the replaced behavior, and the status/doctor credential posture. The residual uncertainty is bounded and named: the admission probe's sufficiency (ASSUMPTION), the real install population affected by the upgrade and the external consumer population (TO-CONFIRM), the accepted transient-read cost, the unrecorded pre-session refusal (invocation audit out of scope), and the operator-side exposure of an exported token. AI-generated confidence is not evidence; the owner's decision at the GH-279 PR review is the authoritative signal, and the record stays `Proposed` until then.

## References

- [GH-279 specification](../changes/2026-11/2026-11-10--GH-279--dispatch-credential-preflight/chg-GH-279-spec.md) — §1, §2.1, §3, G-1/G-2/G-5/G-6/G-7, F-1, F-2, F-5, F-6, DEC-1, DEC-4…DEC-8, DM-1/DM-4, NFR-1…NFR-3/NFR-6/NFR-8/NFR-9/NFR-13, RSK-1/RSK-2/RSK-4/RSK-7/RSK-8/RSK-12, §18, §21, §22, AC-F1…AC-F6, Appendix A/C.
- [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — the closed token vocabulary, projection classes, and the `{0, 1, 2}` exit rule.
- [TDR-0012](TDR-0012-blockers-credential-guard-pattern-deferral.md) — the name-only credential diagnostic posture and its registered-value residual reasoning.
- `packages/core/src/app/dispatch.ts` — `runDispatch`: current admission order (lease claim at entry, truth read after the session), and `DispatchRunResult`'s error `kind` union that gains `provider` additively.
- `packages/cli/src/production.ts` — the `github-read` reference declaration, the process-environment credential port, and the composition boundary where the read outcome is classified.
- `packages/adapters/src/credentials/index.ts` — `resolveCredentialSourceKey`, the `config.credential.missing` identity, and the empty-versus-whitespace rule.
- `packages/adapters/src/io/provider-transport.ts` — the adapter-local `provider.payload.invalid` identity, the optional `httpStatus` (present only when a response was received), and the internal `provider.not-found` marker.
- `packages/adapters/src/github/client.ts` — `get`: only HTTP `404` becomes `provider.not-found`; every other non-2xx becomes `provider.payload.invalid` with the status; the transport throw becomes it without a status. `readWorkItem` is the bounded read the preflight uses.
- `packages/adapters/src/github/normalize.ts` — the malformed-`2xx` path that returns `provider.payload.invalid` without a transport status, which the bounded read stamps with the received status.
- `packages/core/src/contracts/error-table.ts` — the existing `provider.auth.rejected`, `provider.outage`, and `input.value.rejected` rows, their projections, and their `provider`/`input` domain kinds.
- `packages/cli/src/classify.ts` — `classifyDomainKind`, the adapter-local payload entry, and the `fallback.internal` containment path.
- `packages/cli/src/edge.ts` — `registerEdgeSecrets`, the runtime-edge registration the bridge's resolved key uses for redaction.
- `packages/core/src/domain/status.ts` — the `credential-unavailable` reason on credential-dependent sections.
- `tests/structure/dispatch-composition.test.ts` — the composition assertions this decision inverts.
