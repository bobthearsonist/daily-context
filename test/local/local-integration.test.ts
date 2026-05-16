import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import test from "node:test";
import type { TFile, Vault } from "obsidian";
import { buildDailyContext } from "../../src/context";
import type { DateTagsApi } from "../../src/date-tags";
import type { DailyContextSettings } from "../../src/settings";
import type { DailyContext, DailyContextSourceKind } from "../../src/types";

interface LocalProfile {
  vaultRoot: string;
  outputContextPath?: string;
  settings: DailyContextSettings;
  dateTagsApi?: { baseTag?: string };
  cases: LocalCase[];
}

interface LocalCase {
  name: string;
  date: string;
  contextId?: string;
  dailyPath?: string;
  settings?: Partial<DailyContextSettings>;
  expect: {
    dateTagSource?: "convention" | "date-tags-api";
    sourceKinds?: Partial<Record<DailyContextSourceKind, { min?: number; max?: number }>>;
    requiredLabels?: string[];
    forbiddenContentPatterns?: string[];
  };
}

const profilePath = process.env.DAILY_CONTEXT_LOCAL_PROFILE;

test("local profile cases produce expected Daily Context metadata", async () => {
  assert.ok(profilePath, "DAILY_CONTEXT_LOCAL_PROFILE must be set.");
  const profile = readProfile(profilePath);
  const vault = localVault(profile.vaultRoot);
  const outputContexts: DailyContext[] = [];

  for (const localCase of profile.cases) {
    const settings = {
      ...profile.settings,
      ...localCase.settings,
      contexts: localCase.settings?.contexts ?? profile.settings.contexts,
      sectionHeadings: localCase.settings?.sectionHeadings ?? profile.settings.sectionHeadings,
      excludePathFragments: localCase.settings?.excludePathFragments ?? profile.settings.excludePathFragments,
    };
    const first = await buildDailyContext({
      vault,
      settings,
      date: localCase.date,
      request: {
        contextId: localCase.contextId,
        dailyPath: localCase.dailyPath,
      },
      dateTagsApi: dateTagsApi(profile),
    });
    const second = await buildDailyContext({
      vault,
      settings,
      date: localCase.date,
      request: {
        contextId: localCase.contextId,
        dailyPath: localCase.dailyPath,
      },
      dateTagsApi: dateTagsApi(profile),
    });

    assert.equal(first.contextHash, second.contextHash, `${localCase.name}: context hash should be stable`);
    assert.equal(first.dateTagSource, localCase.expect.dateTagSource ?? settings.dateTagSource, `${localCase.name}: dateTagSource`);
    assertSourceKindBounds(first, localCase);
    assertRequiredLabels(first, localCase);
    assertForbiddenPatterns(first, localCase);
    outputContexts.push(first);
  }

  if (profile.outputContextPath) {
    writeLocalOutput(profile.outputContextPath, outputContexts.length === 1 ? outputContexts[0] : outputContexts);
  }
});

function readProfile(path: string): LocalProfile {
  const absolutePath = resolve(path);
  assert.ok(absolutePath.endsWith(".local.json"), "Local profile path must end with .local.json.");
  return JSON.parse(readFileSync(absolutePath, "utf8")) as LocalProfile;
}

function dateTagsApi(profile: LocalProfile): DateTagsApi | null {
  const baseTag = profile.dateTagsApi?.baseTag;
  if (!baseTag) {
    return null;
  }

  return {
    version: 1,
    buildDateTag(date) {
      const [year, month, day] = date.split("-");
      return `${baseTag}/${year}/${month}/${day}`;
    },
  };
}

function assertSourceKindBounds(context: DailyContext, localCase: LocalCase): void {
  for (const [kind, bounds] of Object.entries(localCase.expect.sourceKinds ?? {}) as [
    DailyContextSourceKind,
    { min?: number; max?: number },
  ][]) {
    const count = context.sources.filter((source) => source.kind === kind).length;
    if (bounds.min !== undefined) {
      assert.ok(count >= bounds.min, `${localCase.name}: expected at least ${bounds.min} ${kind} sources, got ${count}`);
    }
    if (bounds.max !== undefined) {
      assert.ok(count <= bounds.max, `${localCase.name}: expected at most ${bounds.max} ${kind} sources, got ${count}`);
    }
  }
}

function assertRequiredLabels(context: DailyContext, localCase: LocalCase): void {
  const normalizedLabels = new Set(context.sources.map((source) => source.label.trim().toLowerCase()));
  for (const label of localCase.expect.requiredLabels ?? []) {
    assert.ok(normalizedLabels.has(label.trim().toLowerCase()), `${localCase.name}: missing required source label '${label}'`);
  }
}

function assertForbiddenPatterns(context: DailyContext, localCase: LocalCase): void {
  for (const pattern of localCase.expect.forbiddenContentPatterns ?? []) {
    assert.ok(
      context.sources.every((source) => !source.content?.includes(pattern)),
      `${localCase.name}: forbidden content pattern '${pattern}' was present in extracted sources`,
    );
  }
}

function writeLocalOutput(outputPath: string, payload: unknown): void {
  const absolutePath = resolve(outputPath);
  const allowedRoot = resolve("test/local/.output");
  const relativeOutput = relative(allowedRoot, absolutePath);
  assert.ok(
    !relativeOutput.startsWith("..") && !isAbsolute(relativeOutput),
    "Local output must be inside test/local/.output.",
  );
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function localVault(root: string): Vault {
  const vaultRoot = resolve(root);
  const files = collectMarkdownFiles(vaultRoot);
  return {
    getFileByPath(path: string) {
      return files.find((file) => file.path === path) ?? null;
    },
    getMarkdownFiles() {
      return files;
    },
    async read(file: TFile) {
      return readFileSync(join(vaultRoot, file.path), "utf8");
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
