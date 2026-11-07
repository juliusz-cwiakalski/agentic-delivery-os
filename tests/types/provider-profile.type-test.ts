/**
 * TC-PROFILE-001 / TC-PROFILE-030 type discipline — the closed unions cannot be
 * widened by a caller, the capability vocabulary is closed, and an env-record
 * name is a validated branded type rather than a bare string.
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it;
 * `tests/types/tsconfig.json` compiles it through the root `typecheck` script.
 */
import type {
  EnvRecordName,
  PacingClass,
  ProfileCapability,
} from "../../packages/core/src/contracts/provider-profile";

type IsAssignable<A, B> = [A] extends [B] ? true : false;
type Expect<T extends true> = T;

type JudgementSeat = Expect<IsAssignable<"judgment", PacingClass>>;
type ExecutionSeat = Expect<IsAssignable<"execution", PacingClass>>;
type UnknownPacingClassRejected = Expect<
  IsAssignable<"coordinator", PacingClass> extends false ? true : false
>;
type WidenedPacingClassRejected = Expect<
  IsAssignable<string, PacingClass> extends false ? true : false
>;

type VisionCapable = Expect<IsAssignable<"vision-capable", ProfileCapability>>;
type TextOnly = Expect<IsAssignable<"text-only", ProfileCapability>>;
type UnknownCapabilityRejected = Expect<
  IsAssignable<"audio-capable", ProfileCapability> extends false ? true : false
>;
type WidenedCapabilityRejected = Expect<
  IsAssignable<string, ProfileCapability> extends false ? true : false
>;

type BrandedNameAccepts = Expect<IsAssignable<EnvRecordName, string>>;
type BareStringRejected = Expect<IsAssignable<string, EnvRecordName> extends false ? true : false>;

export type Probes = [
  JudgementSeat,
  ExecutionSeat,
  UnknownPacingClassRejected,
  WidenedPacingClassRejected,
  VisionCapable,
  TextOnly,
  UnknownCapabilityRejected,
  WidenedCapabilityRejected,
  BrandedNameAccepts,
  BareStringRejected,
];
