---
id: TDR-0031
decision_type: tdr
status: Proposed
created: 2026-11-17
decision_date: null
last_updated: 2026-11-18
summary: "Make the GitHub adapter CLI-first by adding ONE second ProviderTransport that maps an already-shaped ProviderRequest onto `gh api` over an injected fixed-argv/no-shell child runner, selected at composition time by a bounded capability probe with an adapter-local typed refusal and the native-fetch transport as the fallback — no second client, no per-primitive transport fork, no per-request failover, no ambient `gh` credential store, and no growth of the secret-read allowlist."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider adapters (GitHub client subpath)"
decision_scope: repo
review_date: null
business_impact: "M3 EC-3 (`CLI-first, API fallback`) becomes a real, declared, offline-provable property of the reference adapter instead of prose, so every later adapter (GitLab `glab`, Jira MCP) has one transport pattern to copy rather than a second client family to invent."
customer_impact: "Operators whose GitHub access already works through `gh` (enterprise hosts, org policies, existing logins) get an adapter that prefers the vendor CLI and degrades to the API with a declared reason, instead of one that only speaks direct REST."
classification:
  domains: [architecture, security, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-338: @pm routed the CLI-first transport question to a record during clarify_scope)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-338 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-338 clarify_scope: pm-notes decision and current-state facts)"
    - "@decision-advisor (repository analysis and this record)"
    - "@readiness-reviewer (GH-338 DoR iteration 1: N10 reconciliation pointer to ADR-0005) — recorded 2026-11-17"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-338 PR review — this record refines the meaning of an admitted I/O subpath)"
  performers:
    - "@coder (GH-338 delivery: transport factory, probe, runner seam, composition selection, fixtures)"
    - "@doc-syncer (adapter-ports / client-seeds / conformance spec reconciliation)"
  informed:
    - "M3-S3 GitLab code-host adapter (GH-337) — same CLI-first pattern with `glab`"
    - "M3-S5 adapter conformance and parity suite (GH-339)"
    - "Merge, verify, closeout, and status consumers of the GitHub client"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A pinned `gh` version cannot report a usable HTTP status for a variant of `gh api` invocation the adapter needs: the probe must refuse rather than let the client lose 404/`httpStatus` fidelity; reopen the transport choice for that invocation class."
  - "Mid-run CLI failure proves frequent enough to matter operationally: add a DECLARED read-only failover driven by a request-class flag, never by guessing read-versus-write from the HTTP method, and never for a write."
  - "A provider subpath needs runtime APIs beyond network I/O and a bounded fixed-argv child invocation (a cache, a temp file, a long-lived CLI process): that is a new reviewed extension to ADR-0005, not an extension of this record."
  - "Per-primitive transport divergence becomes real (a high-level CLI subcommand that is materially better than the generic API caller for one primitive): decide that primitive alone, with the normalization cost stated; do not turn the transport into a primitive dispatcher."
  - "The operator needs to prove which transport served a given run beyond the declared matrix and probe result: add an observable transport declaration at the composition edge; never widen the normalized primitive views for it."
links:
  related_changes: ["GH-338"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-17--GH-338--github-adapter-completion/chg-GH-338-pm-notes.yaml"
    - "doc/spec/features/feature-provider-client-seeds.md"
    - "doc/spec/features/feature-adapter-ports.md"
  contracts:
    - "packages/adapters/src/io/provider-transport.ts"
    - "packages/adapters/src/github/client.ts"
    - "packages/adapters/src/github/index.ts"
  diagrams: []
  decisions: ["ADR-0003", "ADR-0005", "TDR-0008"]
  experiments: []
  metrics: []
  roadmap_items: ["M3-S4", "M3-S3", "M3-S5"]
---

# TDR-0031: GitHub Adapter CLI-First Transport — One `ProviderTransport` over `gh api` with a Probe-Gated API Fallback

## Context

- **FACT:** The GitHub client is direct REST/GraphQL over an injected, fetch-shaped transport: `ProviderTransport` is `{ send(request: { url, method, headers, body?, timeoutMs? }) => Promise<{ status, body }> }`, clients accept it as an optional construction input, and the production default is a private native-`fetch` transport inside the subpath (`packages/adapters/src/io/provider-transport.ts`, `packages/adapters/src/github/client.ts`, read 2026-11-17).
- **FACT:** Every GitHub primitive — including the GraphQL review-thread read and the `resolveReviewThread` mutation — already flows through `send`, so a transport-level swap covers every primitive without touching composition or normalization logic (`packages/adapters/src/github/client.ts`, read 2026-11-17).
- **FACT:** No vendor-CLI seam exists anywhere in `packages/` today. The production child-process sites are `adapters ./host` (harness spawn), `adapters ./git` (local git seam), and `./daemon/supervisor.ts` (GH-338 clarify-scope pm-notes, 2026-11-17).
- **FACT:** `adapters ./git` is the delivered pattern for a bounded child invocation: fixed-argv array, `shell: false` implied by `execFile`, an injected `GitChildRunner` seam with an `execFile` production default, a bounded timeout with `SIGKILL`, and a non-zero exit treated as data rather than a throw (`packages/adapters/src/git/index.ts`, read 2026-11-17).
- **FACT:** M3 EC-3 requires each adapter to prefer the vendor CLI with a direct API fallback and an explicit capability matrix per adapter and per primitive; the story task list names `gh` (`doc/planning/oss-tooling/milestones/m3/README.md`, read 2026-11-17).
- **FACT:** The conformance mock tier runs offline: tenants are declarative exact-URL routes replayed through the production client factories with an injected transport, a throwing-`fetch` guard asserts zero live network calls, and tenant configuration is env-only (`doc/spec/features/feature-adapter-conformance.md`, read 2026-11-17). A search of the conformance sources found the fetch guard and **no equivalent child-process guard** (searched 2026-11-17).
- **FACT:** The secret-read boundary allowlist has exactly five entries, exactly one of them `credential-material` (the `credentials` subpath), and provider sources read no ambient environment (`doc/spec/features/feature-adapter-ports.md`, read 2026-11-17).
- **FACT:** `.dependency-cruiser.cjs` admits `^packages/adapters/src/github/` as a whole for runtime APIs, so a `node:child_process` import there is *mechanically* permitted today; ADR-0005's own revisit trigger states that "a provider subpath wants runtime APIs beyond network I/O (e.g., filesystem or process access)" is "a new reviewed extension, not covered by this record" (both read 2026-11-17).
- **FACT:** Credentials are environment-only, resolved through `CredentialPort`; GH-338's applied default is credential name `GITHUB_TOKEN` (M3 OQ-M3-08; GH-338 pm-notes, 2026-11-17).
- **FACT:** `adapters ./github` exports the client factory, its input/return types, the adapter contract, and the bounded deploy-trace reader family; the native-fetch transport itself stays private (`packages/adapters/src/github/index.ts`, read 2026-11-17). Note: `feature-provider-client-seeds.md` still states that the subpath exports five names, which the delivered deploy-trace exports already exceed — a doc-drift consequence for the phase-7 reconciliation, not a fact this decision depends on.

## Problem Framing (Clarified)

The requirement is a **transport preference**, not a second client. Today the client owns three separable concerns: (a) request shaping (paths, query parameters, GraphQL payloads, headers), (b) transport (bytes on the wire), and (c) normalization (untrusted payload → primitive view). "CLI-first" only changes (b): the vendor CLI is used as an *authenticated API caller* (`gh api`), not as a second source of provider semantics.

Framed that way, the decision is not "CLI or API" but five narrow questions:

1. **What is the CLI seam?** A second `ProviderTransport` implementation (the existing seam) or a second client family (a parallel surface).
2. **Where is it chosen and refused?** A probe at the composition edge with an adapter-local typed refusal, or a per-request decision inside the transport.
3. **How do offline determinism and the secret boundary survive?** The child invocation must be injectable, and the credential must arrive as data rather than from ambient environment or `gh`'s own credential store.
4. **Does the swap change what consumers see?** It must not: `GitHubClientOptions.transport` stays the only seam, and normalized views, failure identities, `httpStatus`, and `pageItemCount` must be identical across transports.
5. **What happens when the CLI breaks mid-run?** A write retried on the other transport could land twice; that risk must be designed out, not mitigated by prose.

The trap to avoid is visible in the alternatives: any option that gives the same primitive two semantic implementations converts one normalization contract into two and makes the conformance suite unprovable.

## Constraints (Hard Requirements)

### C-1: CLI-first with an explicit, declared fallback

- **Statement:** The GitHub adapter must prefer the vendor CLI transport and fall back to the direct API transport, with the preference and fallback declared as inspectable data per adapter and per primitive.
- **Source:** M3 EC-3; GH-338 tasks and AC.
- **Verification:** Demonstration plus review of the declared matrix; conformance/reference-behavior test asserting the declaration covers every closed operation.
- **Negotiable:** no.

### C-2: Offline determinism with zero live child processes in the mock tier

- **Statement:** Every CLI-path test must run with zero live network calls **and** zero live child processes; the child invocation must be reachable only through an injected seam.
- **Source:** M3 OQ-M3-09; adapter-conformance spec (mock tier); GH-338 pm-notes current-state fact.
- **Verification:** Test — injected fake runner plus a child-process guard in the mock tier; determinism (same fixture replayed twice yields identical results).
- **Negotiable:** no.

### C-3: Credential exclusivity and secret hygiene

- **Statement:** Sole credential acquisition remains `CredentialPort`; the transport reads no ambient environment; resolved material never appears in argv, stdout, stderr, diagnostics, or failure detail.
- **Source:** Secret-read boundary invariant; M3 OQ-M3-08; ADR-0005 C-1.
- **Verification:** Test — secret-read invariant (entry count unchanged, planted violations still fire), golden argv/env assertions proving no secret in argv, and failure-detail assertions proving no provider prose crosses.
- **Negotiable:** no.

### C-4: One normalization implementation; no parallel adapter surface

- **Statement:** The CLI path must reuse the delivered client, request shaping, and normalizers; no second client family, no provider-native type, and no consumer-visible API change.
- **Source:** ADR-0003 DEC-6; provider-surface structure tests; `ProviderTransport` seam as delivered.
- **Verification:** Test — `provider-surface` purity, `GitHubClientOptions`/`createGitHubClient` signature unchanged, and normalized outputs identical across transports for the same fixture.
- **Negotiable:** no.

### C-5: Minimal contract and confinement growth

- **Statement:** No new core contract type, no new closed operation, no new adapter subpath; the child-process edge is admitted by an exact, reason-bearing subpath entry whose meaning is recorded.
- **Source:** Additive-v1 discipline; ADR-0005 exact-path allowance.
- **Verification:** Test plus review — `core ./contracts` inventory unchanged; `ADAPTER_OPERATIONS` unchanged; dependency-cruiser entries stay exact-path with reasons.
- **Negotiable:** no.

### C-6: Failure-classification fidelity across the transport swap

- **Statement:** 404 stays a definitive `provider.not-found`; any other non-2xx stays `provider.payload.invalid` carrying the structured `httpStatus`; a thrown/timed-out request stays `provider.payload.invalid` with no status; a bounded page still reports the provider's `pageItemCount`.
- **Source:** Provider-client-seeds spec (GitHub error mapping and `httpStatus`); merge/verify consumers that classify from status.
- **Verification:** Test — parity fixtures comparing normalized results and failure identities across the CLI and API transports for the same route table.
- **Negotiable:** no.

### C-7: Bounded, non-interactive child execution

- **Statement:** Exactly one argv array per invocation, no shell, no pagination, no retry, no interactive prompt, a bounded timeout, a bounded output buffer, and a closed set of environment variables constructed by the adapter.
- **Source:** `adapters ./git` precedent; NFR boundedness; determinism priority.
- **Verification:** Test — golden argv/env cases, timeout case, oversized-output case, and a case proving `--paginate` is never emitted.
- **Negotiable:** no.

### C-8: Provider I/O lives in the provider subpath

- **Statement:** The argv mapping and the child-process edge stay inside `packages/adapters/src/github/`; the transport must not route provider I/O through another adapter subpath.
- **Source:** ADR-0005 driver 5 ("one home for provider I/O").
- **Verification:** Review plus boundary tests (no `github` → `host`/`git` coupling for provider transport).
- **Negotiable:** no.

## Decision Drivers

1. **Operator-parity of the access path.** The adapter should work wherever the operator's own `gh` already works — enterprise hosts, policy-managed identities, org-level CLI configuration — rather than only where a raw token happens to be usable. *(The gate form of "CLI-first" is C-1; this driver is the value behind it, and it is the ranking factor the gate cannot express.)*
2. **Blast radius of vendor-CLI drift.** Flags and output shapes move between `gh` releases. One place to adapt when they move beats N places that must agree.
3. **Implementation economy.** How much new code and test surface buys full primitive coverage (including GraphQL), not just coverage of a subset.
4. **Cognitive load for the next adapter author.** GitLab (`glab`) and Jira (MCP) should copy one pattern, not choose between two.
5. **Reversibility cost of being wrong.** A wrong transport choice must be undone by a composition change, not a consumer migration.

*(Overlap check: each of these five is a continuous preference used to rank options; none of them duplicates a pass/fail gate above. The gates decide eligibility — offline determinism, secret hygiene, normalization unity, failure fidelity, bounded execution, and the provider I/O home appear only as constraints.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-338 clarify_scope routed this call here).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-338 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (GH-338 scope and current-state facts); `@decision-advisor` (analysis and record); `@spec-writer` (constraints carried into the change spec once written).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-338; the owner for final acceptance of this record.
- **Performers:** `@coder` (transport factory, probe, runner seam, composition selection, fixtures); `@doc-syncer` (spec reconciliation).
- **Informed:** M3-S3 GitLab adapter (GH-337), M3-S5 conformance suite (GH-339), and the merge/verify/closeout/status consumers of the GitHub client.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The GitHub client is transport-agnostic and every primitive (including GraphQL) flows through `ProviderTransport.send`. | FACT | `packages/adapters/src/github/client.ts` (read 2026-11-17) | A transport-level swap would not cover all primitives, forcing a per-primitive scheme. | High |
| `ProviderTransport` is a two-field contract (`send` in, `{status, body}` out) with no header access. | FACT | `packages/adapters/src/io/provider-transport.ts` (read 2026-11-17) | Status recovery would need a contract change instead of an in-transport parse. | High |
| No vendor-CLI seam exists in `packages/` today; the delivered child-process sites are `host`, `git`, and `daemon/supervisor.ts`. | FACT | GH-338 pm-notes clarify_scope note; `packages/adapters/src/{host,git}` (read 2026-11-17) | The "new seam" framing would be wrong. | High |
| `gh api` is a generic authenticated REST/GraphQL caller with `--method`, `--header`, `--input`, `--include`, and `--hostname`. | ASSUMPTION (documented CLI surface; version-pinned at the probe) | `gh` CLI documentation | If a required flag is unavailable on the pinned version, the probe refuses and the API transport serves; no silent degradation. | Medium-High |
| `--include` output exposes the final HTTP status line, so `httpStatus` and 404 classification survive the round-trip. | ASSUMPTION (hard requirement of the transport) | `gh` CLI documentation; fixture at implementation | Without it, C-6 fails and the CLI transport must report itself unusable rather than lie about status. | Medium |
| `GH_TOKEN` / `GH_ENTERPRISE_TOKEN` are the documented non-interactive token variables, and `GH_HOST` / `--hostname` address a non-`github.com` base URL. | ASSUMPTION (exact variable set proven by a golden-env fixture) | `gh` CLI documentation | A different variable set is a fixture fix inside the same design; no decision change. | Medium |
| `gh` reads its own host configuration and stored login unless redirected. | ASSUMPTION | `gh` CLI behaviour | If unredirected, an instance declaring credential reference X could act as the operator's stored account Y — the credential declaration would be a lie. | Medium-High |
| `pageItemCount` is derived from the response body array length, not from response headers. | FACT | `packages/adapters/src/github/normalize.ts` consumers of `{items, pageItemCount}`; tenant fixture (read 2026-11-17) | A body-only round-trip would lose page-size fidelity. | High |
| The conformance mock tier installs a throwing-`fetch` guard and no child-process guard. | FACT | `tests/conformance/mock-conformance.test.ts` (searched 2026-11-17) | C-2 would be unenforced for child processes; this change adds the guard. | High |
| `.dependency-cruiser.cjs` already admits `packages/adapters/src/github/` wholesale, so `node:child_process` is mechanically permitted there today. | FACT | `.dependency-cruiser.cjs` (read 2026-11-17) | If it were not admitted, this record would have to widen the mechanical allowlist, a larger change. | High |
| ADR-0005 explicitly excludes process access from its intent and routes it to a new reviewed extension. | FACT | `doc/decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md` revisit trigger (read 2026-11-17) | Without that clause, this record would be narrower (transport only). | High |
| A merge/comment/PR write re-issued on a second transport can land twice. | FACT (design fact) | Write semantics; delivered merge-integrity discipline (`merge-transaction.ts` lands at most once) | Per-request failover would be unsafe for writes; the decision forbids it. | High |

## Mental Models & Techniques Used

- **First principles:** What is the minimum a "CLI-first adapter" must be? A transport that speaks the same wire protocol through the vendor CLI. Request shaping and normalization are independent of it, so the seam is already in the right place.
- **Inversion:** What makes CLI-first dangerous? A second normalization path, ambient credentials from `gh`'s store, a secret in argv, silent per-request failover on writes, and loss of HTTP status. Each is excluded by C-3, C-4, C-6, C-7, and an explicit no-failover rule.
- **Second-order thinking:** Vendor CLI flag drift is a *certainty* over time. One probe plus one argv-mapping module converts drift into a bounded, testable failure at a single place; a second client converts it into divergent semantics.
- **Systems thinking:** The transport sits under five consumer engines (verify, merge, closeout, status, doctor) that classify from status and body. Preserving those two facts preserves the whole system's behavior.
- **Opportunity cost:** Every hour spent on a second client family is an hour not spent on the parity suite that EC-4 needs.
- **KISS / bounded execution:** One argv array, one timeout, one output cap, one status parse.
- **Reversibility:** The transport is a composition input; reverting to API-only is one construction-site change plus a declaration update.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 CLI-first | C-2 offline determinism | C-3 secret hygiene | C-4 one normalization | C-5 minimal growth | C-6 failure fidelity | C-7 bounded child | C-8 I/O home |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 API-only (status quo) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 one `ProviderTransport` over `gh api` (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 separate `createGitHubCliClient` family | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ | ✅ | ✅ |
| ALT-3 per-primitive high-level CLI subcommands | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ✅ | ✅ |
| ALT-4 CLI transport with the process edge in `./host` | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❌ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception.

### Alternative 0 — Do Nothing (API-only, as delivered)

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Keep the private native-fetch transport as the only transport; declare CLI-first as future work.
- **Constraint compliance:** Passes C-2…C-8 trivially; fails C-1 because EC-3 and the story's task list require the CLI preference to be delivered, not promised.
- **Driver fit:** Strong on drivers 2, 3, and 5 (no drift surface, no new code, nothing to reverse) but delivers nothing for driver 1 and gives the next adapter no pattern (driver 4).
- **Pros:** Zero new surface; zero new risk.
- **Cons:** EC-3 unmet; GitLab/Jira inherit no pattern; the story's AC cannot be met.
- **Why rejected:** It fails the eligibility gate.

### Alternative 1 — One Second `ProviderTransport` over `gh api`, Probe-Gated (chosen)

- **Eligibility:** Eligible.
- **Summary:** A `ProviderTransport` implementation that maps an already-shaped `ProviderRequest` onto a fixed `gh api` argv, over an injected fixed-argv/no-shell child runner, with a bounded capability probe at the composition edge; the native-fetch transport remains the fallback and the offline default.
- **Constraint compliance:** Passes all of C-1…C-8 (matrix above): the client, request shaping, and normalizers are reused unchanged (C-4); the runner is injected so the mock tier spawns nothing (C-2); credentials arrive as constructed child environment data (C-3); the edge stays in `./github` (C-8); status and body are reconstructed so failure classification is unchanged (C-6).
- **Driver fit:** Best on all five: operator parity (1), one drift surface (2), full primitive coverage from one seam (3), one pattern to copy (4), composition-level reversal (5).
- **Pros:** One place to fix CLI drift; every primitive covered at once, including GraphQL; the trap catalog and conformance suite prove the CLI path with a fake runner; the API path remains the deterministic default.
- **Cons:** A new bounded process edge inside a provider subpath (recorded refinement of ADR-0005's meaning); a new adapter-local refusal vocabulary for probe failure; the CLI path needs a golden argv/env test layer that does not exist yet.
- **Why chosen:** It is the only eligible option that satisfies EC-3 without forking the normalization layer or the failure taxonomy.

### Alternative 2 — A Separate `createGitHubCliClient` Family

- **Eligibility:** Not eligible (fails C-4; C-5 via an accepted-risk exception at best).
- **Summary:** Build a second client whose members shell out to `gh`, leaving the REST client untouched.
- **Constraint compliance:** Fails C-4 — two clients mean two normalization implementations and two surfaces whose behavior must be proven; provider-native CLI output shapes would need a second normalizer set.
- **Driver fit:** Weak on drivers 2, 3, and 4: two drift surfaces, two code paths, and a pattern with a fork in it.
- **Pros:** Conceptual separation; the REST client stays untouched.
- **Cons:** Duplicate normalization and duplicated quirk fixes; the conformance adapter registry would need two builders per provider; consumer code would choose a client.
- **Why rejected:** It is exactly the parallel surface ADR-0003 DEC-6 forbids, and it doubles the maintenance surface for a solo maintainer.

### Alternative 3 — Per-Primitive Transport Selection via High-Level CLI Subcommands

- **Eligibility:** Not eligible (fails C-4 and C-6; C-2 and C-3 at risk).
- **Summary:** Use `gh pr create`, `gh pr merge`, `gh pr comment`, and similar high-level commands for the writes where they are "materially better", and the REST client for everything else.
- **Constraint compliance:** Fails C-4 (the client gains a second composition path per primitive) and C-6 (high-level commands impose their own exit codes, prompts, and error surface, which would have to be re-mapped into the same failure identities — a second taxonomy). C-2 and C-3 are at risk because each high-level command brings its own configuration and prompting behaviour.
- **Driver fit:** Weak on drivers 2, 3, and 4: a drift surface per command family, two semantic layers, and a pattern nobody should copy.
- **Pros:** Each high-level command encapsulates provider-specific mechanics.
- **Cons:** Two semantic implementations per primitive; the offline matrix grows per command; the low-level `gh api` form is always available and is what the request shaping already produces.
- **Why rejected:** The "materially better" premise does not hold when the CLI is used as a generic API caller: `gh pr merge --squash --subject --body` and `PUT /repos/{o}/{r}/pulls/{n}/merge` differ in ergonomics, not in provider semantics, and only the latter fits an already-shaped `ProviderRequest`.

### Alternative 4 — CLI Transport with the Process Edge in `adapters ./host`

- **Eligibility:** Not eligible (fails C-8).
- **Summary:** Put a generic fixed-argv child runner in `./host` (already the child-process home) and inject it into the `./github` CLI transport.
- **Constraint compliance:** Fails C-8 — provider I/O would be split across two admitted subpaths, and the `host` subpath's declared meaning (the harness spawn edge) would blur; C-5 is also at risk because the split needs its own recorded rationale.
- **Driver fit:** Slightly better on driver 3 (reuses an existing child-process module) but worse on drivers 2 and 5 (two subpaths to keep in step; reversal is no longer one composition change), and it fails C-8 outright.
- **Pros:** No new process edge inside a provider subpath.
- **Cons:** Two-subpath coupling for one feature; the `./git` precedent (runner beside its argv allowlist) is deliberately not followed.
- **Why rejected:** It moves the risk away from the code that owns it.

## Decision

- **Decision:** Adopt ALT-1. The GitHub adapter becomes CLI-first through **one** new `ProviderTransport` implementation, selected at composition time by a bounded capability probe:
  1. **Transport factory.** `createGithubCliTransport({ runner?, environment, hostname, timeoutMs?, maxResponseBytes? })` returns a `ProviderTransport`. `hostname` is REQUIRED construction data — the declared `gh api --hostname` host identity — so no code path can re-derive a host from a request URL. It maps the already-shaped request to a fixed argv (`api <path> --method <METHOD> --hostname <hostname> --include`, with `--input -` and the serialized body on stdin when a body exists), never emits `--paginate`, `--jq`, or a shell, and terminates on one bounded timeout.
  2. **Child runner seam.** An adapter-local runner type — same shape as the delivered `GitChildRunner` (file, args, `{ timeout, killSignal: "SIGKILL", cwd?, env?, maxBuffer? }` → `{ stdout, stderr, status, timedOut }`) — with an `execFile` production default and full test injection. Defined locally, not in `core ./contracts`.
  3. **Credential handling.** The transport consumes the request's `Authorization` header, removes it from the forwarded headers, and constructs the child environment as data: the token variables, the host variable, an isolated `GH_CONFIG_DIR` (so `gh` can never fall back to an operator's stored login), `GH_PROMPT_DISABLED=1`, `NO_COLOR=1`, and the update-notifier suppressor. No secret enters argv. No ambient environment is read. The environment is absolute in every case (the injected temporary directory when absolute, the operating system's temporary directory otherwise) and isolates `GH_CONFIG_DIR`/`XDG_CONFIG_HOME`, `XDG_STATE_HOME` and `XDG_CACHE_HOME` under that base; `HOME` is never forwarded.
  4. **Response reconstruction.** Parse the FIRST HTTP status block from the `--include` output and the remaining bytes as JSON, returning `{ status, body }`. The scan stops at that block's pre-body region, so a body line shaped like a status line can never override the real status; a block whose body region begins with another status line is an intermediate response (a proxy preamble or a bodyless redirect hop) and the scan continues. 404 and `httpStatus` are derived by the client from the status, and `pageItemCount` from the body's array length, so all three survive unchanged. Provider prose on stderr is never forwarded into a failure detail; the detail names the exit code only.
  5. **Probe and refusal.** `probeGithubCli({ runner, minimumVersion })` performs one bounded `gh --version` invocation and returns a closed result: `{ ok: true, version }` or `{ ok: false, code }` with `provider.cli.unavailable` | `provider.cli.version-unsupported` | `provider.cli.capability-unsupported`. The code set is adapter-local: no error-table row, no schema change. The probe runs at composition time, never at module load, and never in the mock tier.
  6. **Selection and fallback.** The composition probes once, then injects either the CLI transport or the exported native-fetch transport according to a closed composition-level policy, `prefer-cli | api-only` (default `prefer-cli`), recording the declared degradation when it falls back. There is **no per-request failover in v1**: a mid-run CLI failure surfaces as `provider.payload.invalid` with no status, exactly like any transport failure, and a write is never re-issued on the other transport (a second landing is unrecoverable).
  7. **Declared matrix.** `GITHUB_TRANSPORT_MATRIX` is adapter-local declared data covering every closed adapter operation with `{ preferred: "gh", fallback: "api" }`. The matrix is deliberately uniform in v1 because `gh api` is transport-level, not primitive-level; a future per-primitive divergence must be decided on its own (revisit trigger).
  8. **Consumer transparency.** `createGitHubClient` keeps its delivered shape and `GithubClientOptions` gains exactly one additive optional member — the injected `workflowMap` TDR-0034 §1 declares — so every existing call site and option object keeps compiling and nothing is removed, retyped, or made required. `transport` remains the only transport seam, so no consumer changes. The native-fetch factory becomes an export so composition can choose explicitly.
  9. **Recorded confinement refinement.** The bounded fixed-argv `gh` invocation lives in `packages/adapters/src/github/` (mirroring `./git`). This record states that the `github` runtime-API admission now covers that bounded child invocation in addition to network I/O; the secret-read allowlist stays at five entries with zero growth, and no wildcard or pattern widening is introduced. **This is the "new reviewed extension" ADR-0005's process-access revisit trigger requires**: ADR-0005 admits provider client subpaths for network I/O and routes any process access to a reviewed extension, and this record is that extension, scoped to one bounded fixed-argv, no-shell invocation inside the same subpath. ADR-0005 carries the matching editorial pointer back to this record; neither record's decision statement is rewritten.
- **Rationale (tied to drivers):** It is the only option that serves operator-parity of the access path (driver 1) while satisfying the CLI-first gate (C-1), keeps one drift surface (driver 2), delivers full primitive coverage from one seam (driver 3), gives the next adapter a pattern to copy (driver 4), and is reversible as a composition change (driver 5).
- **Decider:** Juliusz Ćwiąkalski — human acceptance at the GH-338 PR review; this record stays `Proposed` until then.
- **Conditions for revisit:** See `revisit_triggers`; notably a `gh` version that cannot report status, a demonstrated need for mid-run read failover, and any request for runtime APIs beyond network I/O plus bounded fixed-argv child invocation in a provider subpath.

**Amendment (2026-11-18, GH-338 review iteration 1).** Three corrections to the decision text, none of which changes the chosen alternative. (a) `hostname` is required construction data holding the declared host identity, not an optional override: the delivered transport had derived it from the request URL, and `gh api --hostname api.github.com` resolves `api.api.github.com`, so every production request failed while the injected-runner suite stayed green. The mapping is exact (`api.github.com` -> `github.com`; every other host, including a GHES host that begins with `api.`, unchanged) and composition computes it once from the declared instance address. (b) The child environment is absolute in every case: the injected temporary directory when it is absolute and the operating system's temporary directory otherwise, with `GH_CONFIG_DIR`/`XDG_CONFIG_HOME`, `XDG_STATE_HOME` and `XDG_CACHE_HOME` isolated under that base and `HOME` never forwarded. Without that rule `gh` resolves its state root relative to the caller's working directory and writes into the checkout. (c) Decision item 8 now states the one additive optional `GithubClientOptions` member TDR-0034 §1 declares, so this record and that one no longer disagree about a delivered contract's shape. The process edge is additionally proven offline against a stub `gh` on an injected `PATH`, per item 5's golden-argv intent.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies every constraint C-1 through C-8. No accepted-risk exceptions are taken.

Two deliberate, recorded consequences rather than exceptions:

- The `github` runtime-API admission gains a *meaning* (bounded fixed-argv child invocation) without a mechanical allowlist change; this is stated here because ADR-0005 routes process access to a new reviewed extension rather than to its own text.
- A mid-run CLI failure has no in-run recovery by design; that is a safety property (no double-landed writes), and it is bounded by the fact that the next command invocation re-probes.

## Trade-offs & Consequences

### Positive Outcomes

- EC-3 becomes mechanical: the reference adapter prefers `gh`, declares the fallback per primitive, and proves the CLI path offline through a fake runner.
- Exactly one normalization implementation and one failure taxonomy remain; the trap catalog keeps proving the production client regardless of transport.
- 404, `httpStatus`, and page-size fidelity are preserved, so verify, merge, closeout, status, and doctor keep their existing classification behavior.
- The seam is reversible: reverting to API-only is a construction-site change plus a declaration update.
- GitLab (`glab`) and Jira (MCP) inherit a pattern instead of inventing one.

### Negative Outcomes

- A new process edge exists in a provider subpath, with the usual risks (spawn cost per request, a CLI on `PATH`, version drift). Mitigated by the probe, the exact-path admission, and the bounded invocation.
- Every GitHub request under the CLI transport pays a process spawn; the API transport remains available and can be pinned (`api-only`).
- A mid-run CLI failure fails the command instead of transparently continuing on the API; operators see a classified failure rather than an invisible retry.
- The adapter-local probe refuses with codes that are not error-table identities, so consumers must not confuse them with lifecycle failures (documented; no error-table row).
- A new golden argv/env test layer is required; without it the CLI path is unproven.

### Unresolved Questions

- [ ] Exact flag and environment-variable set of the pinned minimum `gh` version, and the exact `--include` output shape for status recovery (owner: `@coder`, proven by fixtures in the GH-338 change).
- [x] Whether `--include` output can carry more than one status block (redirect/proxy cases) and which status the transport must treat as final — **closed 2026-11-18 (GH-338 review iteration 1)**: the first status block is authoritative, a leading headerless/bodyless preamble or a bodyless redirect hop is skipped, and an unparsable block is refused rather than assumed to be a success. A last-status-line rule is rejected because a body line shaped like a status line would override the real status.
- [ ] Whether the operator needs a `cli-only` mode (prove the CLI is actually used) in addition to `prefer-cli`/`api-only` (owner: GH-338 spec; default is no new mode).
- [ ] Whether a transport-in-use declaration should be surfaced beyond the composition (owner: future observability change; never by widening normalized views).

## Implementation Plan

1. **Transport module (`./github`).** Add the CLI transport factory, the local child-runner seam with its `execFile` default, the argv builder, the child-environment builder, the `--include` status/body parser, and the probe with its closed refusal codes. Keep the contracts tier and the operation set untouched.
2. **Client surface.** Export the native-fetch transport factory from `./github` (additive export) so composition can choose; leave `createGitHubClient` and `GithubClientOptions` unchanged apart from documentation.
3. **Declared matrix.** Add `GITHUB_TRANSPORT_MATRIX` as adapter-local declared data covering every closed operation, and document it in the adapter contract reference.
4. **Composition.** Probe once at the composition edge, select the transport, and record the degradation when falling back. No retries, no per-request failover, no probe at module load.
5. **Conformance and tests.** Add the fake-runner CLI replay: golden argv and child-environment assertions (no secret in argv, isolated config dir, no `--paginate`), status/body parity against the same tenant routes, 404/`httpStatus` parity, timeout and oversized-output cases, and parity of normalized outputs across transports. Add a child-process guard to the mock tier beside the existing throwing-`fetch` guard.
6. **Boundary and secret checks.** Keep the dependency-cruiser subpath entries exact and reason-bearing; update the `github` entry comment to name the bounded child invocation; assert the secret-read allowlist count is unchanged and planted violations still fire.
7. **Docs.** Reconcile `feature-provider-client-seeds.md` (transport section, export list, maintenance), `feature-adapter-ports.md` (confinement wording for the `github` subpath), and `feature-adapter-conformance.md` (offline guarantee now covers child processes); record the reference behavior in the adapter-contract reference document.

## Verification Criteria

- Metric: declared transport matrix covers 100% of `ADAPTER_OPERATIONS`, each with a preferred CLI transport and an API fallback — Target: exact coverage — Window: GH-338 CI.
- Metric: normalized output parity — the same tenant route replayed through the CLI and the API transport yields identical normalized views and identical failure identities — Target: 100% of replayed routes — Window: GH-338 CI, offline.
- Metric: child-process containment in the mock tier — Target: zero live child processes (guard fires on any attempt) — Window: GH-338 CI.
- Metric: secret hygiene — zero occurrences of resolved material in recorded argv, and the isolated config directory present in every recorded child environment — Target: 100% of CLI invocations in tests — Window: GH-338 CI.
- Metric: failure fidelity — 404 → `provider.not-found`; other non-2xx → `provider.payload.invalid` with `httpStatus`; transport failure → `provider.payload.invalid` without status — Target: exact, across both transports — Window: GH-338 CI.
- Metric: boundary and secret invariants — secret-read allowlist count unchanged (5, one `credential-material`), planted violations still fire, confinement entries exact-path — Target: unchanged — Window: GH-338 CI.

## Confidence Rating

**High** for the seam choice and its mechanics: the transport is already the only place the wire is touched, the child-runner pattern is delivered in `./git`, and the confinement and secret-read invariants are verified in the current source. **Medium** for the exact `gh api` surface (status recovery, token/host variables) until the pinned-version probe and golden fixtures exist; the design degrades safely because a probe failure selects the API transport rather than producing a lying client.

## References

- GH-338 change workspace (clarify-scope decisions, current-state facts, applied defaults Q-03/Q-04/Q-07): `doc/changes/2026-11/2026-11-17--GH-338--github-adapter-completion/chg-GH-338-pm-notes.yaml`
- M3 blueprint — goal, EC-3, M3-S4 tasks, risk table (`CLI flag drift` → capability probe): `doc/planning/oss-tooling/milestones/m3/README.md`
- M3 architecture — boundary invariant 5 (`CLI-first, API-fallback`): `doc/planning/oss-tooling/milestones/m3/architecture.md`
- Delivered transport seam: `packages/adapters/src/io/provider-transport.ts`
- Delivered GitHub client and public surface: `packages/adapters/src/github/client.ts`, `packages/adapters/src/github/index.ts`
- Delivered fixed-argv child seam precedent: `packages/adapters/src/git/index.ts`
- Conformance mock tier and its offline guard: `doc/spec/features/feature-adapter-conformance.md`, `tests/conformance/mock-conformance.test.ts`
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — tier rules, no parallel adapter surface, runtime-API confinement
- [ADR-0005](ADR-0005-runtime-confinement-provider-client-subpaths.md) — provider subpath I/O admission, "one home for provider I/O", and the process-access revisit trigger; **refined by this record** for the `packages/adapters/src/github/` subpath (see Decision item 9 — the bounded child invocation is the reviewed extension that ADR-0005 routes process access to)
- [TDR-0008](TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) — additive-within-v1 discipline (the constraint this record deliberately does *not* need to invoke)
