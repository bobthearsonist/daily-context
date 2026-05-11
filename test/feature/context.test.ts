import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";
import type { TFile, Vault } from "obsidian";
import { buildDailyContext } from "../../src/context";
import type { DailyContextSettings } from "../../src/settings";

const FIXTURE_VAULT = resolve("tests/fixtures/vault");

test("buildDailyContext returns structured sources for a fixture daily note", async () => {
  const context = await buildDailyContext({
    vault: fixtureVault(FIXTURE_VAULT),
    settings: fixtureSettings(),
    date: "2026-05-11",
    request: { contextId: "personal" },
  });

  assert.equal(context.schemaVersion, 2);
  assert.equal(context.date, "2026-05-11");
  assert.equal(context.dateTag, "date/2026/05/11");
  assert.equal(context.dateTagSource, "convention");
  assert.match(context.contextHash, /^sha256:[a-f0-9]{64}$/);

  const sources = new Map(context.sources.map((source) => [source.kind, source]));
  assert.equal(sources.get("daily-prelude")?.content, "Morning context before queries.");
  assert.equal(sources.get("daily-section")?.label, "notes");
  assert.match(sources.get("daily-section")?.content ?? "", /Manual note/);
  assert.match(sources.get("ai-session")?.content ?? "", /Designed daily context provider/);
});

function fixtureSettings(): DailyContextSettings {
  return {
    contexts: [
      {
        id: "personal",
        dailyFolder: "0 Daily ADHD Brain Logs",
        sessionFolder: "0 AI Sessions",
      },
    ],
    dateTagSource: "convention",
    sectionHeadings: ["notes", "decisions", "blockers"],
    includePrelude: true,
    includeAiSessions: true,
    includeDateTaggedFiles: true,
    stripQueryBlocks: true,
    maxSourceBytes: 50_000,
    excludePathFragments: [".obsidian/", "-overview.json", "whiteboard.json", "whiteboard.html", "_Conflict."],
    cacheFolder: ".obsidian/plugins/daily-context/cache",
  };
}

test("buildDailyContext uses date-tags API tag and still matches legacy date tags", async () => {
  const context = await buildDailyContext({
    vault: fixtureVault(FIXTURE_VAULT),
    settings: { ...fixtureSettings(), dateTagSource: "date-tags-api" },
    date: "2026-05-11",
    request: { contextId: "personal" },
    dateTagsApi: {
      version: 1,
      buildDateTag: () => "custom-date/2026/05/11",
    },
  });

  assert.equal(context.dateTag, "custom-date/2026/05/11");
  assert.equal(context.dateTagSource, "date-tags-api");
  assert.ok(context.sources.some((source) => source.kind === "date-tagged-file"));
});

test("buildDailyContext requires date-tags API when configured", async () => {
  await assert.rejects(
    () =>
      buildDailyContext({
        vault: fixtureVault(FIXTURE_VAULT),
        settings: { ...fixtureSettings(), dateTagSource: "date-tags-api" },
        date: "2026-05-11",
        request: { contextId: "personal" },
      }),
    /Date Tags plugin API/,
  );
});

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
  walk(root, paths);
  return paths.sort().map((path) => {
    const basename = path.split("/").pop()?.replace(/\.md$/u, "") ?? path;
    return { path, basename, extension: "md" } as TFile;
  });
}

function walk(directory: string, paths: string[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath, paths);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      paths.push(relative(FIXTURE_VAULT, absolutePath).split("/").join("/"));
    }
  }
}
