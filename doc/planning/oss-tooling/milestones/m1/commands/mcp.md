# mcp(1)

Status: Delivered M1-S7 (GH-231); full MCP is planned in M3-S2.
Proposed contract scoped to the M3-S2 remainder.

## NAME

`mcp` - the minimal MCP surface over proven engines.

## SYNOPSIS

```
<binary> mcp serve
```

## DESCRIPTION

Thin MCP server mirroring the CLI scope over proven engines: status,
verify-artifact, gate report. No batch (M3-S2). Tool calls return the
same core results and stable error codes as the CLI; process exit
codes never propagate across the MCP boundary (the envelope stays a
CLI concern per ADR-0003).

## OUTPUT

MCP tool results carry the CLI `data` shapes (see per-command pages);
errors carry the error-table fields inside the tool payload.

## EXIT STATUS

0 server stopped cleanly; 1 configuration error; 2 transport fault.

## EXAMPLES

Tool call result for gate-report (client side shown):

```
result: {
  "overall": "pass",
  "gates": [
    { "id": "lifecycle-finalization", "verdict": "ok", "evidence": "phases 11/11" },
    { "id": "ci-on-pushed-sha", "verdict": "ok", "evidence": "pipeline 44821 on 9f21c0e" }
  ]
}
```

## ERRORS

Tool errors use the CLI error table (code, category, retryable,
consequence, remediationHint) inside the MCP error payload.

## SEE ALSO

[status.md](status.md), [verify-gates.md](verify-gates.md),
[verify-change.md](verify-change.md)
