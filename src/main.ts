import { Notice, Plugin, TFile } from "obsidian";
import { buildDailyContext } from "./context";
import { compactDate, normalizeDate } from "./date";
import { getDateTagsApi } from "./date-tags";
import { DEFAULT_SETTINGS, DailyContextSettingTab, type DailyContextSettings } from "./settings";
import { DAILY_CONTEXT_API_VERSION, type DailyContextApi, type DailyContextRequestOptions } from "./types";

export default class DailyContextPlugin extends Plugin {
  settings: DailyContextSettings = { ...DEFAULT_SETTINGS };
  api: DailyContextApi = {
    version: DAILY_CONTEXT_API_VERSION,
    getDailyContext: (date, options) => this.getDailyContext(date, options),
    writeDailyContextCache: (date, options) => this.writeDailyContextCache(date, options),
  };

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new DailyContextSettingTab(this.app, this));
    this.registerCommands();
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<DailyContextSettings> | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loaded,
      contexts: loaded?.contexts ?? DEFAULT_SETTINGS.contexts,
      sectionHeadings: loaded?.sectionHeadings ?? DEFAULT_SETTINGS.sectionHeadings,
      excludePathFragments: loaded?.excludePathFragments ?? DEFAULT_SETTINGS.excludePathFragments,
      stripQueryBlocks: loaded?.stripQueryBlocks ?? DEFAULT_SETTINGS.stripQueryBlocks,
    };
  }

  async saveSettings(): Promise<void> {
    this.settings.sectionHeadings = this.settings.sectionHeadings.map((entry) => entry.trim()).filter(Boolean);
    await this.saveData(this.settings);
  }

  async getDailyContext(date: string, options?: DailyContextRequestOptions) {
    return buildDailyContext({
      vault: this.app.vault,
      settings: this.settings,
      date,
      request: options,
      dateTagsApi: getDateTagsApi(this.app),
    });
  }

  async writeDailyContextCache(date: string, options?: DailyContextRequestOptions): Promise<string> {
    const context = await this.getDailyContext(date, options);
    const cachePath = `${this.settings.cacheFolder.replace(/\/+$/g, "")}/${context.date}.json`;
    await this.app.vault.adapter.mkdir(this.settings.cacheFolder);
    await this.app.vault.adapter.write(cachePath, `${JSON.stringify(context, null, 2)}\n`);
    return cachePath;
  }

  private registerCommands(): void {
    this.addCommand({
      id: "copy-today-context-json",
      name: "Copy today's context JSON",
      callback: () => {
        void this.copyContextJson(currentLocalDate());
      },
    });

    this.addCommand({
      id: "copy-active-note-date-context-json",
      name: "Copy context JSON for active note date",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const date = file instanceof TFile ? dateFromFile(file) : null;
        if (checking) {
          return date !== null;
        }

        if (!date) {
          new Notice("Daily Context: active note name is not a date.");
          return false;
        }

        void this.copyContextJson(date, { dailyPath: file?.path });
        return true;
      },
    });

    this.addCommand({
      id: "write-today-context-cache",
      name: "Write today's context cache",
      callback: () => {
        void this.writeDailyContextCache(currentLocalDate()).then((path) => {
          new Notice(`Daily Context: wrote ${path}`);
        });
      },
    });
  }

  private async copyContextJson(date: string, options?: DailyContextRequestOptions): Promise<void> {
    const context = await this.getDailyContext(date, options);
    await navigator.clipboard.writeText(JSON.stringify(context, null, 2));
    new Notice(`Daily Context: copied ${context.sources.length} sources for ${context.date}.`);
  }
}

function currentLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromFile(file: TFile): string | null {
  if (/^\d{8}$/.test(file.basename)) {
    return normalizeDate(file.basename);
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(file.basename)) {
    return normalizeDate(file.basename.slice(0, 10));
  }

  if (file.basename.includes(compactDate(currentLocalDate()))) {
    return currentLocalDate();
  }

  return null;
}
