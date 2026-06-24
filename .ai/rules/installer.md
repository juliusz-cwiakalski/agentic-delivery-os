# Installer Script Rules

Rules for AI agents creating or modifying installer scripts such as `scripts/install-zclaude.sh` and `scripts/install-text-to-image.sh`.

## Scope

Use this rule when writing Bash installers that download ADOS tools or install external CLI dependencies.

Pair with `.ai/rules/bash.md`; installer scripts must still follow the Bash safety rules.

## Core requirements

- Public one-line installers should stay compatible with macOS system Bash (`bash` 3.2+) when practical.
- Use strict mode: `set -Eeuo pipefail`, `set -o errtrace`, `shopt -s inherit_errexit 2>/dev/null || true`.
- Support `DRY_RUN=true` and `VERBOSE=true`.
- Support an install-dir override: `<TOOL_NAME_UPPER>_INSTALL_DIR`.
- Never use `sudo` automatically.
- Never use insecure downloads (`curl -k`, `curl --insecure`).
- Always ask before installing external dependencies.
- For `curl | bash` installers, read prompts from `/dev/tty`, not stdin.
- If no TTY is available, do not install dependencies automatically; print manual instructions.

## Download safety

- Prefer HTTPS URLs from official sources.
- Use `curl -fsSL` or `wget -qO-`.
- Respect standard proxy environment variables (`HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY`) by relying on curl/wget defaults.
- Download tools to a temporary file first, then `chmod +x` and move into place to avoid partial installs.
- Verify installed tools with `--version` when available.

## Platform detection

Use `uname -s`:

| Platform | Detection |
|---|---|
| Linux | `Linux` |
| WSL | `Linux` plus `/proc/version` contains `microsoft` |
| macOS | `Darwin` |
| Git Bash / MSYS | `MINGW*`, `MSYS*`, `CYGWIN*` |

Unsupported platforms should fail with clear manual instructions.

## Install directory selection

Choose the install directory in this order:

1. Explicit env override (`<TOOL_NAME_UPPER>_INSTALL_DIR`).
2. `~/.local/bin` if already in PATH.
3. `~/bin` if already in PATH.
4. First existing user-writable PATH directory under `$HOME`.
5. Fallback to `~/.local/bin` and print PATH setup instructions.

Do not silently write to privileged system directories.

## PATH management

- Check whether the install directory is already in PATH.
- If not, print the exact line to add:
  ```bash
  export PATH="$HOME/.local/bin:$PATH"
  ```
- Offer to append this line to the detected shell rc file, but ask first.
- Explain that the parent shell's current PATH cannot be changed by a child installer; users must open a new terminal or source the rc file.

Shell rc detection:

| Shell/platform | Preferred rc file |
|---|---|
| zsh | `~/.zshrc` |
| bash on Linux/WSL/Git Bash | `~/.bashrc` |
| bash on macOS | `~/.bash_profile` |
| unknown | `~/.profile` |

## External dependency installation

When a tool depends on another CLI, detect it first with `command -v`.

If missing:

1. Explain what is missing and why it is needed.
2. Print the official manual install command.
3. Ask whether to install automatically.
4. Use the official installer or package manager for the detected platform.
5. Verify the dependency after installation.
6. If verification fails, continue only if the primary tool can still be installed safely, and clearly state what remains for the user.

## Claude Code dependency rule

For installers that need Claude Code CLI (`claude`):

- Preferred Unix install (Linux/macOS/WSL):
  ```bash
  curl -fsSL https://claude.ai/install.sh | bash
  ```
- Windows PowerShell install:
  ```powershell
  irm https://claude.ai/install.ps1 | iex
  ```
- Windows CMD install:
  ```cmd
  curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
  ```
- In Git Bash, prefer invoking `powershell.exe` only after user confirmation; otherwise print the PowerShell/CMD commands.
- Do not prefer npm. `npm install -g @anthropic-ai/claude-code` is a fallback only when official native install is not viable and the user explicitly chooses it.

## User experience

Installer output should make the final state clear:

- Where the tool was installed.
- Whether dependencies were found or installed.
- Whether the install dir is in PATH.
- What command to run next.

Example final message:

```text
Installed: zclaude 1.0.0; claude 2.x.x
Done. Run 'zclaude' to get started.
```
