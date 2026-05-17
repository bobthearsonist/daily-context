export interface DailyContextGroupSettings {
  id: string;
  dailyFolder: string;
  aiSessionFolders: string[];
}

export interface DailyContextSettings {
  contexts: DailyContextGroupSettings[];
  dateTagSource: "convention" | "date-tags-api";
  sectionHeadings: string[];
  includePrelude: boolean;
  includeAiSessions: boolean;
  includeDateTaggedFiles: boolean;
  stripQueryBlocks: boolean;
  maxSourceBytes: number;
  excludePathFragments: string[];
  cacheFolder: string;
}

export const DEFAULT_SETTINGS: DailyContextSettings = {
  contexts: [
    {
      id: "personal",
      dailyFolder: "0 Daily ADHD Brain Logs",
      aiSessionFolders: ["0 AI Sessions"],
    },
    {
      id: "work",
      dailyFolder: "0 Profisee/Captains Log",
      aiSessionFolders: ["0 Profisee/AI Sessions"],
    },
  ],
  dateTagSource: "convention",
  sectionHeadings: ["notes", "decisions", "blockers", "outcomes", "follow ups", "follow-ups"],
  includePrelude: true,
  includeAiSessions: true,
  includeDateTaggedFiles: true,
  stripQueryBlocks: true,
  maxSourceBytes: 50_000,
  excludePathFragments: [
    ".obsidian/",
    "-overview.json",
    "whiteboard.json",
    "whiteboard.html",
    "_Conflict.",
  ],
  cacheFolder: ".obsidian/plugins/daily-context/cache",
};

export type PersistedDailyContextSettings = Partial<Omit<DailyContextSettings, "contexts">> & {
  contexts?: LegacyDailyContextGroupSettings[];
};

interface LegacyDailyContextGroupSettings {
  id?: string;
  dailyFolder?: string;
  sessionFolder?: string;
  aiSessionFolders?: string[];
}

export function normalizeSettings(loaded: PersistedDailyContextSettings | null | undefined): DailyContextSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...loaded,
    contexts: normalizeContexts(loaded?.contexts),
    dateTagSource: loaded?.dateTagSource ?? DEFAULT_SETTINGS.dateTagSource,
    sectionHeadings: loaded?.sectionHeadings ?? DEFAULT_SETTINGS.sectionHeadings,
    excludePathFragments: loaded?.excludePathFragments ?? DEFAULT_SETTINGS.excludePathFragments,
    stripQueryBlocks: loaded?.stripQueryBlocks ?? DEFAULT_SETTINGS.stripQueryBlocks,
  };
}

export function normalizeContexts(contexts: LegacyDailyContextGroupSettings[] | undefined): DailyContextGroupSettings[] {
  if (!contexts) {
    return DEFAULT_SETTINGS.contexts;
  }

  return contexts.map((context, index) => {
    const defaultContext = DEFAULT_SETTINGS.contexts.find((entry) => entry.id === context.id) ?? DEFAULT_SETTINGS.contexts[index];
    return {
      id: context.id?.trim() || defaultContext?.id || `context-${index + 1}`,
      dailyFolder: normalizeFolder(context.dailyFolder ?? defaultContext?.dailyFolder ?? ""),
      aiSessionFolders: normalizeAiSessionFolders(context, defaultContext),
    };
  });
}

function normalizeAiSessionFolders(
  context: LegacyDailyContextGroupSettings,
  defaultContext: DailyContextGroupSettings | undefined,
): string[] {
  if (Array.isArray(context.aiSessionFolders)) {
    return normalizeFolderList(context.aiSessionFolders);
  }

  if (context.sessionFolder) {
    return normalizeFolderList([context.sessionFolder]);
  }

  return defaultContext ? [...defaultContext.aiSessionFolders] : [];
}

function normalizeFolderList(folders: string[]): string[] {
  return Array.from(new Set(folders.map(normalizeFolder).filter(Boolean)));
}

function normalizeFolder(folder: string): string {
  return folder.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
}
