# Survey — AI-agent-facing error design

| | |
|--|--|
| Change | GH-172 — M0-S3: Result contract and error table |
| Artifact | Companion research artifact (per PM decision 2026-10-30); not part of the distributable doc set |
| Status | Complete — verdict in §4, impact in §5 |
| Author | @spec-writer |
| Date | 2026-10-30 |

---

## 1. Purpose and method

The GH-172 ticket includes a short survey of AI-agent-facing error design — problem-details style
structures and tool-use error guidance — to validate or refine the error-code convention specified
in `chg-GH-172-spec.md` (stable symbolic hierarchical codes plus structured fields: category,
retryable, consequence, remediation hint).

Method: survey public, stable contract designs that are known to be consumed by machines or by
reasoning agents; extract the recurring elements; record an explicit adopt / adapt / reject verdict
per element and state how it lands in (or changes) the convention under validation. Evolving
vendor APIs are surveyed as of the authoring date; the verdicts attach to the structural elements,
not to version-specific payloads.

## 2. Surveyed designs

### 2.1 Problem Details for HTTP APIs (RFC 9457; obsoletes RFC 7807)

- A JSON object with `type` (a URI reference identifying the problem type), `title` (short
  human-readable summary), `status` (the HTTP status code), `detail` (human-readable explanation
  specific to this occurrence), and `instance` (URI identifying this occurrence). Extension
  members are encouraged for additional information.
- **Strengths:** a small, stable, always-present shape; an explicit extensibility channel; designed
  so machines can branch on `type` while humans read `title`/`detail`.
- **Mismatch for a process surface:** `status` is coupled to HTTP transport semantics, and
  `type`-as-URI presumes web resolution. A command-line envelope has no HTTP layer, and requiring
  URI dereference for error identity would couple agents to network availability for diagnosis.

### 2.2 Canonical status enum + typed detail extensions (Google API error model lineage)

- An error payload with `code` (numeric), `status` (a small canonical enum such as
  `INVALID_ARGUMENT`, `NOT_FOUND`, `UNAVAILABLE`), `message` (developer-facing summary), and a
  `details[]` array of typed extensions. A standard `retryInfo` extension signals retryability,
  optionally with a retry delay.
- **Strengths:** the closed enum is reliably machine-branchable; the typed extension channel lets
  payloads evolve without breaking shape; retryability is explicit exactly where agent behavior
  depends on it.
- **Mismatch:** the canonical enum conflates cause and responsibility, and its values lean on HTTP
  resource semantics that do not map cleanly onto command execution.

### 2.3 Exit-code tables (POSIX convention; BSD `sysexits` lineage)

- BSD `sysexits.h` is the classic table-driven projection of failure classes onto exit codes
  (`EX_USAGE`, `EX_DATAERR`, `EX_NOINPUT`, `EX_UNAVAILABLE`, `EX_TEMPFAIL`, …). POSIX fixes only
  the bare conventions (0 success, non-zero failure).
- **Lesson:** projecting failures onto exit codes *from a table* is old and sound — the table, not
  the call site, is the model. But numeric diversification (64, 69, 75, …) became per-tool
  folklore: no caller or agent can rely on another tool's numbers. A small fixed projection
  (success / one responsible-party class / another) plus structured fields for everything richer
  beats a wide numeric vocabulary.

### 2.4 Tool-use error guidance (LLM tool-use surfaces, as of authoring)

- **Anthropic tool use:** tool execution failures are returned to the model as tool results
  carrying an `is_error` flag; the error content enters the model's context so it can read what
  went wrong and self-correct. Guidance favors content that says what happened and what to try.
- **OpenAI function calling:** tool outputs are fed back as tool-role messages; errors are
  structured content the model reads, not process crashes.
- **Model Context Protocol (MCP):** tool *execution* errors are returned as results carrying an
  `isError` flag plus content (agent-visible), deliberately distinct from *protocol-level*
  JSON-RPC errors with numeric codes. The design separates "the tool ran and failed" from "the
  call never reached the tool".
- **Cross-cutting:** in every tool-use design, errors are **data returned to a reasoning agent**.
  Stable identity and explicit flags let the agent condition behavior (retry, escalate, report);
  prose is read for nuance but never used as identity. Notably, **none** of the surveyed designs
  makes the *consequence of the attempted operation* (did the mutation land?) a first-class field —
  agents must infer it from code semantics, which is precisely the retry-unsafe gap: without it,
  a retry risks double-apply.

## 3. Cross-cutting findings

1. **Stable machine-readable identity is load-bearing everywhere.** Every design gives failures a
   stable identifier that machines branch on; where identity degrades to prose, consumers regress
   to string-matching folklore.
2. **Retryability is expressed explicitly where agent behavior depends on it** (the `retryInfo`
   lineage; transient hints).
3. **Errors-as-data:** the failure path must produce the same structured shape as the success path
   (`isError` lineage). A failure that crashes the output channel is a contract failure of its own.
4. **Prose fields are secondary.** `title`/`detail`/`message` aid humans and give agents nuance;
   none of the designs treats prose as identity.
5. **Mutation consequence is a surveyed gap.** No design records whether the attempted operation
   landed. For tool-using agents this is the difference between safe retry and double-apply —
   the strongest candidate for this convention to add, with `unknown` as an explicit first-class
   value because "we don't know" is a real and honest state.
6. **Structured extension channels are how contracts evolve** without breaking shape
   (`details[]`; problem-details extensions).

## 4. Verdict — adopt / adapt / reject

| # | Element | Lineage | Verdict | How it lands in the convention (chg-GH-172-spec.md) |
|---|---------|---------|---------|------------------------------------------------------|
| 1 | Stable hierarchical symbolic identity | problem-details `type`; canonical status | **Adopt** | The app error code: stable symbolic `domain.reason.detail` (e.g., `provider.quota.exceeded`), resolving to a documented table entry. |
| 2 | `type` as dereferenceable URI | RFC 9457 | **Adapt** | Keep the stable symbolic string; drop the URI resolution requirement. The namespace is documented in the error table itself. |
| 3 | HTTP-status coupling | RFC 9457 | **Reject** | The envelope is a process surface. The exit-code projection replaces transport status. |
| 4 | Canonical status enum | Google error model lineage | **Adapt** | The category enum (`user` / `platform` / `transient` / `permanent`) as a classification axis on every error — responsibility and persistence of the failure, not transport status. |
| 5 | Explicit retryability signal | `retryInfo` lineage | **Adopt** | `retryable` boolean on every error, so agents can branch without guessing. |
| 6 | Mutation consequence as first-class field | None surveyed (gap, finding 5) | **Adopt (novel)** | `consequence`: `landed` / `not_landed` / `unknown`, with `unknown` first-class. Retained and highlighted as this convention's contribution beyond the surveyed designs; motivated by retry safety. |
| 7 | Errors-as-data on the failure path | tool-use `isError` lineage | **Adopt** | Machine output always emits a valid envelope — success, classified failure, or broken command (contained via the fallback table entry). |
| 8 | Structured extension channel | `details[]`; RFC 9457 extensions | **Adapt** | Structured fields are fixed on every error (category, retryable, consequence, remediation hint); the envelope evolves additively within a `schemaVersion` rather than via open extension maps at v1. |
| 9 | Prose fields as secondary identity | `title`/`detail`/`message` | **Adapt** | An optional non-identifying summary plus an action-first `remediationHint`; prose is never the identity and never carries secret material. |
| 10 | Numeric exit-code diversification | `sysexits` lineage | **Adapt** | Keep the table-driven projection principle; fix the projection at exactly {0, 1, 2} derived from the table — no per-error numbers (folklore prevention). |
| 11 | Stack traces / raw diagnostics in machine output | Common practice | **Reject** | A broken command is contained to a valid fallback-entry envelope; diagnostics belong to human-oriented output and logs, never the machine envelope. |

## 5. Impact on the convention

The convention specified in `chg-GH-172-spec.md` **stands validated**, with these refinements
recorded:

- **Remediation hints are action-first** (what the caller should do next), inherited from the
  tool-use guidance that error content should enable self-correction (verdicts 9, §2.4).
- **The category enum is fixed at four values** (`user` / `platform` / `transient` /
  `permanent`), and the exit-code projection is derived from the table entry — the richer
  classification nuance deliberately stays out of the three exit codes (verdicts 4, 10).
- **`consequence` with first-class `unknown` is retained** as the convention's novel element;
  the survey confirms no mainstream design provides it and that retry safety requires it
  (verdict 6).
- **Envelope evolution is additive within `schemaVersion`** for v1, mirroring the
  extension-channel lineage; breaking shape changes require a new schema version (verdict 8).

No element of the surveyed designs contradicts the convention; the rejected elements (3, 11) are
surface mismatches, not structural disagreements.

## 6. References

- RFC 9457, *Problem Details for HTTP APIs* (obsoletes RFC 7807).
- Google API Design Guide — errors; Google Cloud API error model (`status` enum, `details[]`,
  `retryInfo`) as of authoring.
- BSD `sysexits.h` — table-driven exit-code projection precedent.
- Anthropic tool-use documentation (`is_error` on tool results); OpenAI function-calling
  documentation (tool-role error feedback); Model Context Protocol specification
  (`CallToolResult.isError` vs. JSON-RPC protocol errors) — all as of authoring.
- `chg-GH-172-spec.md` — the convention under validation (same change folder).
