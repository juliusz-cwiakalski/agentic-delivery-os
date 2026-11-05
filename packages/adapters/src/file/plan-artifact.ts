/**
 * Read-only delivery-plan artifact reader (GH-226 F-1, F-13; DEC-7).
 *
 * Locates the change folder through the same convention as pm-notes, prefers
 * `chg-<ref>-plan.yaml` over the legacy `chg-<ref>-plan.md` (OQ-4), and returns
 * text, absence, or a classified unreadable outcome. No writes, no spawns, no
 * network, and no clock.
 */
import { planArtifactPath } from "@delivery-os/core/contracts";
import type { PlanArtifactRead } from "@delivery-os/core/contracts";
import type { PmNotesFileSystemFacts } from "./pm-notes-parser.js";

const REF_PATTERN = /^[A-Z]+-[0-9]+$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export type PlanArtifactRequest = {
  readonly changeRef: string;
  readonly changesDirectory: string;
  readonly fs: PmNotesFileSystemFacts;
};

const safeList = (fs: PmNotesFileSystemFacts, path: string): readonly string[] => {
  try {
    return fs.listDirectory(path);
  } catch {
    return [];
  }
};

const locateChangeFolder = (request: PlanArtifactRequest): string | undefined => {
  if (!REF_PATTERN.test(request.changeRef)) return undefined;
  const { fs, changesDirectory, changeRef } = request;
  if (!fs.exists(changesDirectory)) return undefined;
  for (const month of [...safeList(fs, changesDirectory)]
    .filter((name) => MONTH_PATTERN.test(name))
    .sort()) {
    const monthDirectory = `${changesDirectory}/${month}`;
    for (const folder of [...safeList(fs, monthDirectory)].sort()) {
      if (folder.includes(`--${changeRef}--`)) return `${monthDirectory}/${folder}`;
    }
  }
  return undefined;
};

/** Read one change ref's plan artifact with YAML-before-markdown precedence. */
export const readPlanArtifact = (request: PlanArtifactRequest): PlanArtifactRead => {
  const folder = locateChangeFolder(request);
  if (folder === undefined) {
    return { ok: false, reason: "absent", workItemRef: request.changeRef };
  }
  const yamlPath = planArtifactPath(request.changeRef, "yaml");
  const markdownPath = planArtifactPath(request.changeRef, "markdown");
  const yamlFile = `${folder}/${yamlPath}`;
  const markdownFile = `${folder}/${markdownPath}`;
  if (!request.fs.exists(yamlFile) && !request.fs.exists(markdownFile)) {
    return { ok: false, reason: "absent", workItemRef: request.changeRef };
  }
  const yaml = request.fs.exists(yamlFile);
  const file = yaml ? yamlFile : markdownFile;
  const path = yaml ? yamlPath : markdownPath;
  const kind = yaml ? "yaml" : "markdown";
  try {
    return {
      ok: true,
      artifact: { kind, path },
      text: request.fs.readText(file),
    };
  } catch {
    return { ok: false, reason: "unreadable", workItemRef: request.changeRef, path };
  }
};
