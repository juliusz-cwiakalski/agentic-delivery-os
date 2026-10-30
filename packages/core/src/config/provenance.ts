import type { ConfigNodeOrigins, ConfigOrigin } from "#contracts";

export const descendants = (path: string, candidate: string): boolean =>
  candidate === path || candidate.startsWith(`${path}.`) || candidate.startsWith(`${path}[`);

export const removeOrigins = (origins: Record<string, ConfigOrigin>, path: string): void => {
  for (const key of Object.keys(origins)) if (descendants(path, key)) delete origins[key];
};

export const copyOrigins = (
  destination: Record<string, ConfigOrigin>,
  source: ConfigNodeOrigins,
  path: string,
): void => {
  for (const [key, origin] of Object.entries(source)) {
    if (descendants(path, key)) destination[key] = origin;
  }
};

export const originLabel = (origin: ConfigOrigin): string => {
  if (origin.layer === "environment") return `layer=environment env=${origin.env}`;
  if (origin.layer === "cli") return `layer=cli flag=${origin.flag}`;
  return `layer=${origin.layer} file=${origin.file} line=${origin.line}`;
};
