import type { TFile, Vault } from "obsidian";
import { normalizePath } from "obsidian";
import { compactDate, dateTag, normalizeDate } from "./date";
import { hashJson, sha256Hash } from "./hash";
import { extractDaySection, parseDailyMarkdown } from "./parser";
import type { DailyContextSettings } from "./settings";
import {
  DAILY_CONTEXT_PARSER_VERSION,
  DAILY_CONTEXT_SCHEMA_VERSION,
  type DailyContext,
  type DailyContextGroup,
  type DailyContextRequestOptions,
  type DailyContextSource,
  type DailyContextSourceKind,
} from "./types";

interface BuildDailyContextOptions {
  vault: Vault;
  settings: DailyContextSettings;
  date: string;
  request?: DailyContextRequestOptions;
}

export async function buildDailyContext(options: BuildDailyContextOptions): Promise<DailyContext> {
  const normalizedDate = normalizeDate(options.date);
  const tag = dateTag(normalizedDate);
  const groups = selectedGroups(options.settings, options.request);
  const sources: DailyContextSource[] = [];

  for (const group of groups) {
    const dailyPath = options.request?.dailyPath ?? `${group.dailyFolder}/${compactDate(normalizedDate)}.md`;
    const dailyFile = options.vault.getFileByPath(normalizePath(dailyPath));
    if (dailyFile) {
      sources.push(...(await dailySources(options.vault, dailyFile, options.settings, options.request)));
    }

    if (shouldInclude("ai-session", options.settings.includeAiSessions, options.request)) {
      sources.push(...(await aiSessionSources(options.vault, group, normalizedDate, options.settings, options.request)));
    }
  }

  if (shouldInclude("date-tagged-file", options.settings.includeDateTaggedFiles, options.request)) {
    sources.push(...(await dateTaggedFileSources(options.vault, groups, tag, options.settings, options.request)));
  }

  const uniqueSources = dedupeSources(sources).sort((left, right) => left.id.localeCompare(right.id));
  const contextHash = await hashJson({
    parserVersion: DAILY_CONTEXT_PARSER_VERSION,
    date: normalizedDate,
    groups,
    sources: uniqueSources.map(({ id, kind, path, hash }) => ({ id, kind, path, hash })),
  });

  return {
    schemaVersion: DAILY_CONTEXT_SCHEMA_VERSION,
    parserVersion: DAILY_CONTEXT_PARSER_VERSION,
    generatedAt: new Date().toISOString(),
    date: normalizedDate,
    dateTag: tag,
    contextHash,
    contexts: groups,
    sources: uniqueSources,
  };
}

async function dailySources(
  vault: Vault,
  file: TFile,
  settings: DailyContextSettings,
  request: DailyContextRequestOptions | undefined,
): Promise<DailyContextSource[]> {
  const markdown = await readLimited(vault, file, settings, request);
  const parsed = await parseDailyMarkdown(markdown, { sectionHeadings: settings.sectionHeadings });
  const sources: DailyContextSource[] = [];

  if (shouldInclude("daily-prelude", settings.includePrelude, request) && parsed.prelude.length > 0) {
    sources.push({
      id: sourceId("daily-prelude", file.path, "prelude"),
      kind: "daily-prelude",
      path: file.path,
      label: "Daily prelude",
      hash: await sha256Hash(parsed.prelude),
      content: parsed.prelude,
    });
  }

  for (const section of parsed.sections) {
    if (shouldInclude("daily-section", true, request)) {
      sources.push({
        id: sourceId("daily-section", file.path, section.heading),
        kind: "daily-section",
        path: file.path,
        label: section.heading,
        hash: section.hash,
        content: section.content,
        sections: [section],
      });
    }
  }

  return sources;
}

async function aiSessionSources(
  vault: Vault,
  group: DailyContextGroup,
  date: string,
  settings: DailyContextSettings,
  request: DailyContextRequestOptions | undefined,
): Promise<DailyContextSource[]> {
  const files = markdownFiles(vault)
    .filter((file) => isUnderFolder(file.path, group.sessionFolder))
    .filter((file) => !isExcluded(file.path, settings));
  const sources: DailyContextSource[] = [];

  for (const file of files) {
    const markdown = await readLimited(vault, file, settings, request);
    if (!belongsToDate(file, markdown, date)) {
      continue;
    }

    const daySection = await extractDaySection(markdown, date);
    const content = daySection?.content || markdown;
    sources.push({
      id: sourceId("ai-session", file.path, daySection?.heading ?? date),
      kind: "ai-session",
      path: file.path,
      label: daySection?.heading ?? file.basename,
      hash: await sha256Hash(content),
      content,
      sections: daySection ? [daySection] : undefined,
    });
  }

  return sources;
}

async function dateTaggedFileSources(
  vault: Vault,
  groups: DailyContextGroup[],
  tag: string,
  settings: DailyContextSettings,
  request: DailyContextRequestOptions | undefined,
): Promise<DailyContextSource[]> {
  const sources: DailyContextSource[] = [];
  const dailyFolders = new Set(groups.map((group) => normalizePath(group.dailyFolder)));
  const sessionFolders = new Set(groups.map((group) => normalizePath(group.sessionFolder)));

  for (const file of markdownFiles(vault)) {
    if (
      isExcluded(file.path, settings) ||
      Array.from(dailyFolders).some((folder) => isUnderFolder(file.path, folder)) ||
      Array.from(sessionFolders).some((folder) => isUnderFolder(file.path, folder))
    ) {
      continue;
    }

    const markdown = await readLimited(vault, file, settings, request);
    if (!markdownIncludesDateTag(markdown, tag)) {
      continue;
    }

    const sections = await parseDailyMarkdown(markdown, { sectionHeadings: settings.sectionHeadings });
    if (sections.sections.length === 0) {
      continue;
    }

    for (const section of sections.sections) {
      sources.push({
        id: sourceId("date-tagged-file", file.path, section.heading),
        kind: "date-tagged-file",
        path: file.path,
        label: section.heading,
        hash: section.hash,
        content: section.content,
        sections: [section],
      });
    }
  }

  return sources;
}

function selectedGroups(settings: DailyContextSettings, request: DailyContextRequestOptions | undefined): DailyContextGroup[] {
  return settings.contexts
    .filter((group) => !request?.contextId || group.id === request.contextId)
    .map(({ id, dailyFolder, sessionFolder }) => ({ id, dailyFolder, sessionFolder }));
}

function shouldInclude(
  kind: DailyContextSourceKind,
  defaultEnabled: boolean,
  request: DailyContextRequestOptions | undefined,
): boolean {
  return defaultEnabled && (!request?.include || request.include.includes(kind));
}

async function readLimited(
  vault: Vault,
  file: TFile,
  settings: DailyContextSettings,
  request: DailyContextRequestOptions | undefined,
): Promise<string> {
  const maxBytes = request?.maxSourceBytes ?? settings.maxSourceBytes;
  const markdown = await vault.read(file);
  return markdown.length > maxBytes ? markdown.slice(0, maxBytes) : markdown;
}

function markdownFiles(vault: Vault): TFile[] {
  return vault.getMarkdownFiles();
}

function belongsToDate(file: TFile, markdown: string, date: string): boolean {
  return markdown.includes(`[[${compactDate(date)}]]`) || markdownIncludesDateTag(markdown, dateTag(date)) || file.path.includes(date);
}

function markdownIncludesDateTag(markdown: string, tag: string): boolean {
  return markdown.includes(tag) || markdown.includes(`#${tag}`);
}

function isUnderFolder(path: string, folder: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedFolder = normalizePath(folder).replace(/^\/+|\/+$/g, "");
  return normalizedPath === `${normalizedFolder}.md` || normalizedPath.startsWith(`${normalizedFolder}/`);
}

function isExcluded(path: string, settings: DailyContextSettings): boolean {
  return settings.excludePathFragments.some((fragment) => path.includes(fragment));
}

function sourceId(kind: DailyContextSourceKind, path: string, label: string): string {
  return `${kind}:${path}:${label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function dedupeSources(sources: DailyContextSource[]): DailyContextSource[] {
  return Array.from(new Map(sources.map((source) => [source.id, source])).values());
}
