import type { CampaignProject, ContentEntry } from "./models";

export interface FoundryTransferPackage {
  format: "rpg-book-builder-foundry";
  version: 1;
  exportedAt: string;
  entries: ContentEntry[];
}

export function createFoundryPackage(project: CampaignProject): FoundryTransferPackage {
  return {
    format: "rpg-book-builder-foundry",
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: project.entries,
  };
}

export function downloadFoundryPackage(project: CampaignProject) {
  const data = createFoundryPackage(project);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "foundry-import.json";
  a.click();
  URL.revokeObjectURL(url);
}
