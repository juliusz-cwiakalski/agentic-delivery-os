/**
 * GH-301 secret fixtures: one runtime builder per privacy recognizer class.
 *
 * Positive tokens are assembled from non-matching fragments at call time, so
 * the committed source carries no contiguous secret-shaped value and the
 * repository privacy guard has nothing to match. Marker-carrying literals are
 * the deliberate suppressed half: both guards suppress them by the same rule.
 */

const assemble = (fragments: readonly string[], suffix: string): string =>
  `${fragments.join("")}${suffix}`;

/** One builder per delivered recognizer class. */
export const secretTokenFor = (recognizerClass: string): string => {
  switch (recognizerClass) {
    case "provider-token-prefix":
      return assemble(["gh", "p", "_"], "a".repeat(20));
    case "private-key-block":
      return assemble(["-----BEGIN ", "PRIVATE KEY", "-----"], "");
    case "web-token":
      return assemble(["ey", "J", "a".repeat(9), ".", "b".repeat(9), "."], "c".repeat(9));
    case "bearer-credential":
      return assemble(["Bear", "er "], "a".repeat(20));
    case "credential-assignment":
      return assemble(["pass", "word", ": "], "a1".repeat(11));
    case "connection-string-credential":
      return assemble(["post", "gres://", "app:"], `${"a".repeat(20)}@db.example.com`);
    case "absolute-user-path":
      return assemble(["/ho", "me/", "quill", "bert"], "");
    default:
      throw new Error(`no secret builder for recognizer class ${recognizerClass}`);
  }
};
