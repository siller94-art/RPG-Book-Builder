import type { CampaignProject } from "./models";
import { starterSrd } from "./srdData";

const KEY = "rpg-book-builder.campaign.v1";

export const emptyProject = (): CampaignProject => ({
  schemaVersion: 1,
  name: "My Campaign",
  entries: [...starterSrd],
});

export function loadProject(): CampaignProject {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProject();
    const value = JSON.parse(raw) as CampaignProject;
    return value.schemaVersion === 1 ? value : emptyProject();
  } catch {
    return emptyProject();
  }
}

export function saveProject(project: CampaignProject) {
  localStorage.setItem(KEY, JSON.stringify(project));
}

export function downloadProject(project: CampaignProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "campaign"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
