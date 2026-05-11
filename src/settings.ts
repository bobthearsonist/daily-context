import type { App } from "obsidian";
import { PluginSettingTab, Setting } from "obsidian";
import type DailyContextPlugin from "./main";

export interface DailyContextGroupSettings {
  id: string;
  dailyFolder: string;
  sessionFolder: string;
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
      sessionFolder: "0 AI Sessions",
    },
    {
      id: "work",
      dailyFolder: "0 Profisee/Captains Log",
      sessionFolder: "0 Profisee/AI Sessions",
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

export class DailyContextSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: DailyContextPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Daily Context" });

    new Setting(containerEl)
      .setName("Date tag source")
      .setDesc("Choose whether Daily Context uses its built-in date/YYYY/MM/DD convention or requires the Date Tags plugin API.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("convention", "Built-in convention")
          .addOption("date-tags-api", "Date Tags plugin API")
          .setValue(this.plugin.settings.dateTagSource)
          .onChange(async (value) => {
            this.plugin.settings.dateTagSource = value as DailyContextSettings["dateTagSource"];
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Section headings")
      .setDesc("Comma-separated headings to extract from daily notes and date-tagged files.")
      .addText((text) =>
        text
          .setPlaceholder("notes, decisions, blockers")
          .setValue(this.plugin.settings.sectionHeadings.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.sectionHeadings = value
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Include daily prelude")
      .setDesc("Extract the headerless block after frontmatter and before headings/query blocks.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includePrelude).onChange(async (value) => {
          this.plugin.settings.includePrelude = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Include AI session docs")
      .setDesc("Include session documents tagged for the requested date.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeAiSessions).onChange(async (value) => {
          this.plugin.settings.includeAiSessions = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Include date-tagged files")
      .setDesc("Use date-tagged files as structured related context, excluding generated artifacts.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeDateTaggedFiles).onChange(async (value) => {
          this.plugin.settings.includeDateTaggedFiles = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Strip query blocks")
      .setDesc("Remove Dataview, DataviewJS, and Tasks fenced blocks from configured sections before exposing context.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.stripQueryBlocks).onChange(async (value) => {
          this.plugin.settings.stripQueryBlocks = value;
          await this.plugin.saveSettings();
        }),
      );
  }
}
