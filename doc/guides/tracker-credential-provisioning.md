---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/guides/tracker-credential-provisioning.md
ados_distribution: redistributable
---
# Tracker Credential Provisioning

How to provision the truth-read credential the typed dispatch engine requires,
and why the product never reads it for you.

## The required prerequisite

A dispatch resolves one declared credential reference, `github-read`, before it
claims a queue lease or spawns a session. In the shipped configuration that
reference maps to the exact environment key `GITHUB_TOKEN`.

The mapping is declared data, not a convention the engine guesses: the reference
carries its own source key, and only an environment source is supported. The
engine reads exactly that key through the credential port. It never reads the
OS keyring, never inherits an ambient variable implicitly, and declares no
fallback key chain. Provisioning is an explicit operator act.

## The explicit `gh` bridge

If your `gh` CLI is already authenticated, export the key in your own shell.
Command substitution keeps the value off the terminal and out of your history:

```sh
export GITHUB_TOKEN="$(gh auth token)"
```

Then re-run dispatch. The product does not invoke `gh` at any point; the command
above runs in your shell, under your control.

Because `export` places the token in the process environment, treat the value as
readable by same-user processes and by `/proc`. Do not run the export in a shell
whose history is shared, and do not paste a token into a command line. The
exported value is also visible to any child process you later start from that
shell.

## Least privilege, rotation, and revocation

Export a read-scoped credential where the provider supports one. The truth-read
reference needs only read access to the work item and the repository the
dispatch is verifying; do not export an administrative token.

Rotate any token you export into an environment on a schedule your security
policy defines, and revoke it immediately if it may have leaked. After a
rotation, export the new value in the shell and re-run; no engine configuration
changes.

## When the key is set but rejected

- `provider.auth.rejected`: the provider rejected the credential. Correct the
  value or rotate the token, then retry.
- `provider.outage`: the provider could not complete the read. Retry when the
  provider is available.
- `provider.payload.invalid`: the provider answered with a payload the adapter
  could not parse. Treat this as a provider or adapter fault.
- `input.value.rejected` with a 404: the provider reported the work item as
  absent for this credential. Verify the reference **and** check the token's
  scope and repository access first. A private resource the credential cannot
  see answers 404 exactly like an absent one at this surface.

## Redaction

The config-catalog path does not register the truth-read key for serialization
redaction. The resolved key is registered for serialization redaction at the
runtime edge whenever it is present, using the injected environment facts and
the declared reference; this adds no ambient read and no new allowlist entry.
That registration is why a diagnostic cannot echo the value.

## Diagnostics are names only

Refusals name the resolved key and the reference, never the value. If the engine
reports that `GITHUB_TOKEN` is unset for `github-read`, the fix is the explicit
export above or a declared credential reference that maps to another environment
key.
