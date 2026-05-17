import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";
import type { TFile, Vault } from "obsidian";
import { buildDailyContext } from "../../src/context";
import type { DailyContextSettings } from "../../src/settings-model";
import type { DailyContextSourceKind } from "../../src/types";

const CONFIGURABLE_VAULT = resolve("tests/fixtures/configurable-vault");

const baseSettings: DailyContextSettings = {
  contexts: [
    { id: "journal", dailyFolder: "Journal", aiSessionFolders: ["Sessions"] },
    { id: "meeting-log", dailyFolder: "Logs", aiSessionFolders: ["Sessions"] },
    { id: "minimal", dailyFolder: "Minimal", aiSessionFolders: ["Sessions"] },
  ],
  dateTagSource: "convention",
  sectionHeadings: ["notes", "decisions", "outcomes"],
  includePrelude: true,
  includeAiSessions: true,
  includeDateTaggedFiles: true,
  stripQueryBlocks: true,
  maxSourceBytes: 50_000,
  excludePathFragments: [".obsidian/", "-overview.json", "whiteboard.json", "whiteboard.html", "_Conflict."],
  cacheFolder: ".obsidian/plugins/daily-context/cache",
};

test("buildDailyContext supports a configurable journal-style note shape", async () => {
  const context = await buildDailyContext({
    vault: fixtureVault(CONFIGURABLE_VAULT),
    settings: baseSettings,
    date: "2026-05-11",
    request: { contextId: "journal" },
  });

  assert.equal(context.dateTag, "date/2026/05/11");
  assert.equal(countByKind(context.sources, "daily-prelude"), 1);
  assert.equal(countByKind(context.sources, "ai-session"), 1);
  assert.equal(countByKind(context.sources, "date-tagged-file"), 1);
  assert.ok(sourceWithLabel(context.sources, "Notes")?.content?.includes("Journal note body"));
  assert.ok(sourceWithLabel(context.sources, "Decisions")?.content?.includes("Journal decision"));
  assert.ok(sourceWithLabel(context.sources, "Outcomes")?.content?.includes("Journal outcome"));
  assert.ok(context.sources.every((source) => !source.content?.includes("TABLE file.mtime")));
  assert.ok(context.sources.every((source) => !source.content?.includes("not done")));
  assert.ok(context.sources.every((source) => !source.path.includes("-overview.json")));
  assert.ok(context.sources.every((source) => !source.path.includes("_Conflict.")));
});

test("buildDailyContext uses configured headings for meeting-log note shapes", async () => {
  const context = await buildDailyContext({
    vault: fixtureVault(CONFIGURABLE_VAULT),
    settings: {
      ...baseSettings,
      sectionHeadings: ["summary", "decisions", "actions"],
    },
    date: "2026-05-11",
    request: { contextId: "meeting-log", dailyPath: "Logs/2026-05-11.md" },
  });

  assert.equal(countByKind(context.sources, "daily-prelude"), 0);
  assert.ok(sourceWithLabel(context.sources, "Summary")?.content?.includes("Meeting summary body"));
  assert.ok(sourceWithLabel(context.sources, "Actions")?.content?.includes("Meeting action"));
  assert.equal(context.sources.some((source) => source.path.startsWith("Journal/")), false);
  assert.ok(context.sources.some((source) => source.path === "Related/custom-related.md"));
  assert.equal(context.sources.some((source) => source.content?.includes("This heading should be ignored")), false);
});

test("buildDailyContext does not require a specific daily template shape", async () => {
  const context = await buildDailyContext({
    vault: fixtureVault(CONFIGURABLE_VAULT),
    settings: {
      ...baseSettings,
      sectionHeadings: ["entry"],
      includePrelude: true,
      includeAiSessions: false,
      includeDateTaggedFiles: false,
    },
    date: "20260511",
    request: { contextId: "minimal" },
  });

  assert.equal(context.date, "2026-05-11");
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].label, "Entry");
  assert.match(context.sources[0].content ?? "", /Minimal daily content/);
});

test("buildDailyContext can require Date Tags API tags while matching legacy aliases", async () => {
  const context = await buildDailyContext({
    vault: fixtureVault(CONFIGURABLE_VAULT),
    settings: {
      ...baseSettings,
      dateTagSource: "date-tags-api",
      sectionHeadings: ["summary", "actions"],
    },
    date: "2026-05-11",
    request: { contextId: "meeting-log", dailyPath: "Logs/2026-05-11.md" },
    dateTagsApi: {
      version: 1,
      buildDateTag: () => "custom-date/2026/05/11",
    },
  });

  assert.equal(context.dateTag, "custom-date/2026/05/11");
  assert.equal(context.dateTagSource, "date-tags-api");
  assert.ok(context.sources.some((source) => source.path === "Related/custom-related.md"));
  assert.ok(context.sources.some((source) => source.path === "Related/journal-related.md"));
});

test("buildDailyContext scans multiple configured AI session folders", async () => {
  const context = await buildDailyContext({
    vault: fixtureVault(CONFIGURABLE_VAULT),
    settings: {
      ...baseSettings,
      contexts: [{ id: "journal", dailyFolder: "Journal", aiSessionFolders: ["Sessions", "Archive Sessions"] }],
      includeDateTaggedFiles: true,
    },
    date: "2026-05-11",
    request: { contextId: "journal" },
  });

  assert.equal(countByKind(context.sources, "ai-session"), 2);
  assert.ok(context.sources.some((source) => source.kind === "ai-session" && source.path === "Archive Sessions/archive-session.md"));
  assert.equal(
    context.sources.some((source) => source.kind === "date-tagged-file" && source.path.startsWith("Archive Sessions/")),
    false,
  );
});

test("buildDailyContext honors explicit empty AI session folders", async () => {
  const context = await buildDailyContext({
    vault: fixtureVault(CONFIGURABLE_VAULT),
    settings: {
      ...baseSettings,
      contexts: [{ id: "journal", dailyFolder: "Journal", aiSessionFolders: [] }],
      includeDateTaggedFiles: false,
    },
    date: "2026-05-11",
    request: { contextId: "journal" },
  });

  assert.equal(countByKind(context.sources, "ai-session"), 0);
});

function countByKind(sources: { kind: DailyContextSourceKind }[], kind: DailyContextSourceKind): number {
  return sources.filter((source) => source.kind === kind).length;
}

function sourceWithLabel<T extends { label: string }>(sources: T[], label: string): T | undefined {
  return sources.find((source) => source.label === label);
}

function fixtureVault(root: string): Vault {
  const files = collectMarkdownFiles(root);
  return {
    getFileByPath(path: string) {
      return files.find((file) => file.path === path) ?? null;
    },
    getMarkdownFiles() {
      return files;
    },
    async read(file: TFile) {
      return readFileSync(join(root, file.path), "utf8");
    },
  } as unknown as Vault;
}

function collectMarkdownFiles(root: string): TFile[] {
  const paths: string[] = [];
  walk(root, root, paths);
  return paths.sort().map((path) => {
    const basename = path.split("/").pop()?.replace(/\.md$/u, "") ?? path;
    return { path, basename, extension: "md" } as TFile;
  });
}

function walk(root: string, directory: string, paths: string[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(root, absolutePath, paths);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      paths.push(relative(root, absolutePath).split("/").join("/"));
    }
  }
}
