/**
 * Message sanitization, deterministic validation, and the template fallback
 * (GH-227 F-3, DEC-4, DEC-2).
 *
 * Everything verifiable is checked deterministically: the ref in the message
 * matches the resolved ref, the type is computed and in the allowlist, and no
 * fabricated tracker reference survives. Repository commitlint rules win when
 * present; its errors are fed back into the one retry. The deterministic
 * template is `<type>(<ref>): <plan-phase summary or top-path summary>`.
 */
import {
  COMMIT_MAX_BODY_CHARS,
  COMMIT_MAX_SUBJECT_CHARS,
  COMMIT_TYPES,
  type CommitMessageDraft,
  type CommitSkeleton,
  type CommitType,
  type CommitlintOutcome,
} from "#contracts";

const TRACKER_REF = /\b[A-Z][A-Z0-9]*-\d+\b/g;
const HEADER = /^([a-z]+)(\(([^)]+)\))?(!)?: (.+)$/;

const collapse = (value: string): string => value.replace(/\s+/g, " ").trim();

/** Remove fabricated tracker refs, keeping only the resolved ref. */
export const stripInventedRefs = (text: string, ref: string): string =>
  text.replace(TRACKER_REF, (candidate) => (candidate === ref ? candidate : "")).replace(/\s{2,}/g, " ").trim();

/** Sanitize a model draft in place-free fashion: never silently changes type. */
export const sanitizeCommitMessage = (
  draft: CommitMessageDraft,
  skeleton: CommitSkeleton,
): CommitMessageDraft => {
  const subject = collapse(stripInventedRefs(draft.subject.replace(/[\r\n]+/g, " "), skeleton.ref));
  const body =
    draft.body === undefined
      ? undefined
      : stripInventedRefs(draft.body, skeleton.ref)
          .replace(/\n{3,}/g, "\n\n")
          .trim();
  return {
    subject,
    ...(body === undefined || body.length === 0 ? {} : { body }),
    breaking: draft.breaking,
  };
};

/** The parsed header parts, or a classified shape failure. */
type ParsedHeader = {
  readonly type: string;
  readonly scope: string | undefined;
  readonly breaking: boolean;
  readonly description: string;
};

const parseHeader = (subject: string): ParsedHeader | undefined => {
  const match = HEADER.exec(subject);
  if (match === null) return undefined;
  return {
    type: match[1] as string,
    scope: match[3],
    breaking: match[4] === "!",
    description: match[5] as string,
  };
};

/** One validation input: the draft, the computed skeleton, and lint facts. */
export type CommitMessageValidationInput = {
  readonly draft: CommitMessageDraft;
  readonly skeleton: CommitSkeleton;
  readonly requiresBody: boolean;
  readonly commitlint?: CommitlintOutcome;
};

/** The deterministic validation result: errors are fed back to one retry. */
export type CommitMessageValidation = {
  readonly valid: boolean;
  readonly errors: readonly string[];
};

const isCommitType = (value: string): value is CommitType =>
  (COMMIT_TYPES as readonly string[]).includes(value);

/** Validate one candidate message against the computed skeleton and lint. */
export const validateCommitMessage = (
  input: CommitMessageValidationInput,
): CommitMessageValidation => {
  const errors: string[] = [];
  const { draft, skeleton } = input;
  const subject = collapse(draft.subject);
  if (subject.length === 0) errors.push("subject is empty");
  if (subject.length > COMMIT_MAX_SUBJECT_CHARS) {
    errors.push(`subject is ${subject.length} characters; the cap is ${COMMIT_MAX_SUBJECT_CHARS}`);
  }
  const header = parseHeader(subject);
  if (header === undefined) {
    errors.push("subject is not a conventional header `<type>(<scope>): <description>`");
  } else {
    if (!isCommitType(header.type)) errors.push(`type "${header.type}" is not in the allowed list`);
    if (header.type !== skeleton.type) {
      errors.push(`type must be the computed "${skeleton.type}", not "${header.type}"`);
    }
    if (header.scope !== skeleton.scope) {
      errors.push(`scope must be the resolved ref "${skeleton.scope}", not "${header.scope ?? ""}"`);
    }
    if (header.breaking !== draft.breaking) {
      errors.push("breaking marker must match the message's breaking flag");
    }
    if (header.description.trim().length === 0) errors.push("subject description is empty");
  }
  if (draft.body !== undefined && draft.body.length > COMMIT_MAX_BODY_CHARS) {
    errors.push(`body is ${draft.body.length} characters; the cap is ${COMMIT_MAX_BODY_CHARS}`);
  }
  if (input.requiresBody && (draft.body === undefined || draft.body.trim().length === 0)) {
    errors.push("a body is required because the pending work spans more than one area");
  }
  const refs = `${subject}\n${draft.body ?? ""}`.match(TRACKER_REF) ?? [];
  const invented = refs.filter((candidate) => candidate !== skeleton.ref);
  if (invented.length > 0) {
    errors.push(`invented tracker references are not allowed: ${[...new Set(invented)].join(", ")}`);
  }
  if (input.commitlint?.status === "invalid") {
    errors.push(...input.commitlint.errors);
  }
  return { valid: errors.length === 0, errors };
};

/** Render the atomic message exactly as git receives it. */
export const renderCommitMessage = (draft: CommitMessageDraft): string =>
  draft.body === undefined || draft.body.length === 0
    ? draft.subject
    : `${draft.subject}\n\n${draft.body}`;

/** The deterministic template subject, capped at the subject limit. */
export const templateSubject = (skeleton: CommitSkeleton, summary: string): string => {
  const base = `${skeleton.type}(${skeleton.scope}): ${collapse(summary)}`;
  return base.length <= COMMIT_MAX_SUBJECT_CHARS
    ? base
    : `${base.slice(0, COMMIT_MAX_SUBJECT_CHARS - 1).trimEnd()}…`;
};

/** The deterministic template fallback: no body, breaking defaults false. */
export const templateCommitMessage = (input: {
  readonly skeleton: CommitSkeleton;
  readonly planSummary?: string;
  readonly topPath?: string;
}): CommitMessageDraft => ({
  subject: templateSubject(
    input.skeleton,
    input.planSummary ?? input.topPath ?? "update the change workspace",
  ),
  breaking: input.skeleton.breaking,
});
