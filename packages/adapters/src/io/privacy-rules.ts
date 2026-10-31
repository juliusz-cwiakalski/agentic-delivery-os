/**
 * The pure, dependency-free privacy-literal vocabulary (F-1, DM-3, DEC-2).
 *
 * One definition set is consumed by both the repository file guard
 * (`scripts/checks/privacy-literals.ts`) and the envelope content policy
 * (`./envelope-content-policy.ts`), so file scanning and emitter scanning
 * cannot drift. This module has zero module imports: the codec consumes it
 * without a runtime import, and the check imports it across the dev edge.
 *
 * Everything here is data or a pure function. There is no ambient read, no
 * clock, no randomness, and no I/O.
 */

/** One committed generic rule definition. Patterns are code, never data. */
export type PrivacyRuleDefinition = {
  readonly id: string;
  readonly recognizerClass: string;
  readonly severity: "error";
  readonly patternSource: string;
  readonly flags: string;
  readonly minimumMatchLength: number;
};

/**
 * The seven v1 generic rules. Thresholds are deliberately conservative
 * (high specificity over recall) so the live baseline tunes upward, never
 * downward.
 */
export const PRIVACY_RULES = [
  {
    id: "secret.provider-token-prefix",
    recognizerClass: "provider-token-prefix",
    severity: "error",
    patternSource:
      "\\b(?:(?:ghp|gho|ghu|ghs|ghr|github_pat|glpat|xox[abposr])[_-]|AKIA|ASIA|AIza|ya29)[A-Za-z0-9_-]{16,}\\b",
    flags: "g",
    minimumMatchLength: 24,
  },
  {
    id: "secret.private-key-block",
    recognizerClass: "private-key-block",
    severity: "error",
    patternSource: "-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----",
    flags: "g",
    minimumMatchLength: 20,
  },
  {
    id: "secret.web-token",
    recognizerClass: "web-token",
    severity: "error",
    patternSource: "\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\b",
    flags: "g",
    minimumMatchLength: 30,
  },
  {
    id: "secret.bearer-credential",
    recognizerClass: "bearer-credential",
    severity: "error",
    patternSource: "\\b[Bb]earer\\s+[A-Za-z0-9._~+/=-]{16,}\\b",
    flags: "g",
    minimumMatchLength: 24,
  },
  {
    id: "secret.credential-assignment",
    recognizerClass: "credential-assignment",
    severity: "error",
    patternSource:
      "\\b(?:[A-Za-z0-9]+[_-]){0,4}(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|client[_-]?secret|auth[_-]?token|credential)\\b\\s*[:=]\\s*[\"']?[A-Za-z0-9_+/=.-]{8,}[\"']?",
    flags: "gi",
    minimumMatchLength: 14,
  },
  {
    id: "secret.connection-string-credential",
    recognizerClass: "connection-string-credential",
    severity: "error",
    patternSource: "\\b[a-z][a-z0-9+.-]{1,20}://[^\\s:/@]+:[^\\s/@]+@[^\\s]+",
    flags: "gi",
    minimumMatchLength: 16,
  },
  {
    id: "private.absolute-user-path",
    recognizerClass: "absolute-user-path",
    severity: "error",
    patternSource:
      "(?:[A-Za-z]:[\\\\/]Users[\\\\/]|/Users/|/home/)[A-Za-z0-9._-]{2,}(?:[\\\\/][^\\s\"'<>|)]*)?",
    flags: "g",
    minimumMatchLength: 12,
  },
] as const satisfies readonly PrivacyRuleDefinition[];

/** The committed rule ids, derived from the one definition set. */
export const PRIVACY_RULE_IDS: readonly string[] = PRIVACY_RULES.map((rule) => rule.id);

/** One committed placeholder-suppression class (data, not path inference). */
export type PrivacySuppressionClass = {
  readonly id: string;
  readonly markers: readonly string[];
};

/**
 * Marker classes that identify clearly fabricated spans. Suppression is
 * scoped to the matched span: a markerless value still fires everywhere.
 */
export const PRIVACY_SUPPRESSION_CLASSES = [
  {
    id: "documentation-placeholder",
    markers: ["your-", "your_", "<your", "replace-me", "replace_me", "change-me", "changeme"],
  },
  {
    id: "redaction-marker",
    markers: ["redacted", "[redacted]", "****", "***"],
  },
  {
    id: "fabricated-sample",
    markers: [
      "fake-",
      "fake_",
      "example-",
      "example_",
      "sample-",
      "sample_",
      "synthetic-",
      "synthetic_",
      "dummy-",
      "dummy_",
      "test-",
      "test_",
      "-test-",
      "_test_",
      "canary-",
      "canary_",
      "mock-",
      "mock_",
      "placeholder",
      "fixture-",
      "fixture_",
    ],
  },
] as const satisfies readonly PrivacySuppressionClass[];

/** Versioned domain separator for hashed-literal entries (TDR-0005 §2). */
export const PRIVACY_HASH_DOMAIN = "privacy.literal.v1" as const;

/** Versioned domain separator for content-free fingerprints (TDR-0005 §3). */
export const PRIVACY_FINGERPRINT_DOMAIN = "privacy.fingerprint.v1" as const;

/** The NFR-9 registry bounds, fixed as code (never registry data). */
export const PRIVACY_CAPS = {
  maxEntries: 256,
  maxEntriesPerClass: 128,
  maxDistinctLengths: 32,
  minLength: 4,
  maxLength: 512,
  digestHexLength: 64,
  maxRegistryBytes: 262144,
} as const;

/** The maximum literal length accepted by the authoring mode. */
export const PRIVACY_MAX_LITERAL_LENGTH = PRIVACY_CAPS.maxLength;

/** One generic-rule match, carrying the matched span for suppression only. */
export type GenericRuleMatch = {
  readonly id: string;
  readonly line: number;
  readonly start: number;
  readonly end: number;
  readonly matchedText: string;
  readonly suppressionClass: string | null;
};

/**
 * Normalize a literal exactly once: trim, then lowercase. Entry building and
 * window matching both call this function, so the two paths cannot drift.
 */
export const normalizeLiteral = (literal: string): string => literal.trim().toLowerCase();

/** The versioned preimage hashed for a registry entry (domained + normalized). */
export const privacyDigestInput = (literal: string): string =>
  `${PRIVACY_HASH_DOMAIN}:${normalizeLiteral(literal)}`;

/** The suppression class whose marker appears inside the matched span, if any. */
export const suppressionClassFor = (matchedText: string): string | null => {
  const lowered = matchedText.toLowerCase();
  for (const suppressionClass of PRIVACY_SUPPRESSION_CLASSES) {
    if (suppressionClass.markers.some((marker) => lowered.includes(marker))) {
      return suppressionClass.id;
    }
  }
  return null;
};

const lineAt = (text: string, index: number): number => {
  let line = 1;
  for (let cursor = 0; cursor < index && cursor < text.length; cursor += 1) {
    if (text[cursor] === "\n") line += 1;
  }
  return line;
};

/**
 * Evaluate every committed generic rule against one text and return the
 * matches. Suppressed spans are retained with their class so the tests can
 * prove the suppression is real and narrow; callers decide whether to report.
 */
export const matchGenericRules = (text: string): GenericRuleMatch[] => {
  const matches: GenericRuleMatch[] = [];
  for (const rule of PRIVACY_RULES) {
    const pattern = new RegExp(rule.patternSource, rule.flags);
    for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
      const matchedText = match[0];
      if (matchedText.length < rule.minimumMatchLength) continue;
      matches.push({
        id: rule.id,
        line: lineAt(text, match.index),
        start: match.index,
        end: match.index + matchedText.length,
        matchedText,
        suppressionClass: suppressionClassFor(matchedText),
      });
    }
  }
  return matches;
};

/** One candidate-window hit: where it started and the digest of its window. */
export type CandidateWindowMatch = {
  readonly length: number;
  readonly index: number;
  readonly line: number;
  readonly digest: string;
};

/** A digest function injected by the caller (check edge or emitter). */
export type PrivacyDigest = (normalizedWindow: string) => string;

/**
 * Enumerate fixed-length candidate windows for each distinct registered
 * length and hand every window's digest to the injected matcher. Windows
 * whose normalized length differs from the registered length are skipped
 * before digesting, so whitespace at a window edge never produces a match.
 */
export const findWindowMatches = (
  text: string,
  lengths: readonly number[],
  digest: PrivacyDigest,
  isMatch: (digest: string) => boolean,
): CandidateWindowMatch[] => {
  const distinct = [...new Set(lengths)]
    .filter((length) => length >= PRIVACY_CAPS.minLength && length <= PRIVACY_CAPS.maxLength)
    .sort((left, right) => left - right);
  const matches: CandidateWindowMatch[] = [];
  if (distinct.length > PRIVACY_CAPS.maxDistinctLengths) return matches;
  for (const length of distinct) {
    for (let index = 0; index + length <= text.length; index += 1) {
      const window = text.slice(index, index + length);
      const normalized = normalizeLiteral(window);
      if (normalized.length !== length) continue;
      const windowDigest = digest(normalized);
      if (!isMatch(windowDigest)) continue;
      matches.push({ length, index, line: lineAt(text, index), digest: windowDigest });
    }
  }
  return matches;
};

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

/**
 * A short, stable, identifier-only fingerprint. FNV-1a-64 over the versioned
 * fingerprint domain plus the rule/entry id, rendered as lowercase hex and
 * never derived from content.
 */
export const privacyFingerprint = (id: string): string => {
  const preimage = `${PRIVACY_FINGERPRINT_DOMAIN}:${id}`;
  let hash = FNV_OFFSET_BASIS;
  for (const character of preimage) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = (hash * FNV_PRIME) & UINT64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
};
