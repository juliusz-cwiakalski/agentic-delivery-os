/**
 * Live tenant configuration reader (GH-189 F-7, DEC-8, DEC-12, D-6).
 *
 * Lives under `tests/`, outside the production-source secret-read scan. It
 * returns non-secret settings, credential references, and a non-empty occupancy
 * classification for each token source key. It never stores, returns, logs, or
 * emits a token value.
 */
import type { CredentialReference } from "@delivery-os/core/contracts";

/** The injected environment record; a key may be absent, empty, or blank. */
export type LiveEnvironment = Readonly<Record<string, string | undefined>>;

/** The three documented live providers. */
export type LiveProviderName = "github" | "gitlab" | "jira";

/** The non-empty occupancy classification for a token source key. */
export type LiveOccupancy = "present" | "missing";

/** One provider's non-secret live configuration. */
export type LiveProviderConfig = {
  readonly provider: LiveProviderName;
  readonly settings: Readonly<Record<string, string>>;
  readonly credentialReference: CredentialReference;
  readonly occupancy: LiveOccupancy;
  readonly missingSettings: readonly string[];
};

/** The whole live configuration. */
export type LiveConfig = {
  readonly providers: readonly LiveProviderConfig[];
  readonly missingNames: readonly string[];
};

/** The documented non-secret setting names (spec §22). */
export const PROVIDER_LIVE_SETTINGS: Readonly<Record<LiveProviderName, readonly string[]>> = {
  github: [
    "CONFORMANCE_LIVE_GITHUB_BASE_URL",
    "CONFORMANCE_LIVE_GITHUB_OWNER",
    "CONFORMANCE_LIVE_GITHUB_REPO",
    "CONFORMANCE_LIVE_GITHUB_ISSUE_NUMBER",
    "CONFORMANCE_LIVE_GITHUB_PULL_NUMBER",
    "CONFORMANCE_LIVE_GITHUB_COMMIT_SHA",
  ],
  gitlab: [
    "CONFORMANCE_LIVE_GITLAB_BASE_URL",
    "CONFORMANCE_LIVE_GITLAB_PROJECT_PATH",
    "CONFORMANCE_LIVE_GITLAB_MR_IID",
    "CONFORMANCE_LIVE_GITLAB_COMMIT_SHA",
  ],
  jira: ["CONFORMANCE_LIVE_JIRA_BASE_URL", "CONFORMANCE_LIVE_JIRA_ISSUE_KEY"],
};

/** The documented token source keys (names only; never values). */
export const PROVIDER_LIVE_TOKEN_KEYS: Readonly<Record<LiveProviderName, string>> = {
  github: "CONFORMANCE_LIVE_GITHUB_TOKEN",
  gitlab: "CONFORMANCE_LIVE_GITLAB_TOKEN",
  jira: "CONFORMANCE_LIVE_JIRA_TOKEN",
};

const PROVIDERS: readonly LiveProviderName[] = ["github", "gitlab", "jira"];

const hasValue = (value: string | undefined): value is string =>
  typeof value === "string" && value.trim().length > 0;

const credentialReference = (tokenKey: string): CredentialReference => ({
  referenceName: tokenKey,
  sourceKey: { style: "literal", name: tokenKey },
});

/**
 * Read the injected environment into the live configuration model.
 *
 * A provider is configured only when every documented non-secret setting and
 * its token source key are present and non-empty (non-whitespace). Missing
 * lists carry names only.
 */
export const readLiveConfig = (environment: LiveEnvironment): LiveConfig => {
  const providers: LiveProviderConfig[] = [];
  const missingNames: string[] = [];
  for (const provider of PROVIDERS) {
    const settings: Record<string, string> = {};
    const missingSettings: string[] = [];
    for (const name of PROVIDER_LIVE_SETTINGS[provider]) {
      const value = environment[name];
      if (hasValue(value)) {
        settings[name] = value;
      } else {
        missingSettings.push(name);
      }
    }
    const tokenKey = PROVIDER_LIVE_TOKEN_KEYS[provider];
    const occupancy: LiveOccupancy = hasValue(environment[tokenKey]) ? "present" : "missing";
    if (occupancy === "missing") missingSettings.push(tokenKey);
    missingNames.push(...missingSettings);
    providers.push({
      provider,
      settings,
      credentialReference: credentialReference(tokenKey),
      occupancy,
      missingSettings,
    });
  }
  return { providers, missingNames };
};

/** True only when every documented setting and the token source key are non-empty. */
export const isConfigured = (entry: LiveProviderConfig): boolean =>
  entry.occupancy === "present" && entry.missingSettings.length === 0;
