// External destinations the renderer may open from the title bar. The renderer only names a
// key; the URL is fixed here, so a compromised page cannot open arbitrary addresses.
// Ported from the SlashAPP Electron starters (SlashStitch 0.2.x title bar).

const REPOSITORY = "https://github.com/slashmad/slashpcb";

export const APP_LINKS = {
  sponsor: "https://github.com/sponsors/slashmad",
  source: REPOSITORY,
  releases: `${REPOSITORY}/releases`,
} as const;

export interface BugReportContext {
  version: string;
  platform: string;
  arch: string;
  osRelease: string;
  electron: string;
}

/** A pre-filled GitHub issue: environment only, no paths, file names or personal data. */
export function bugReportUrl(ctx: BugReportContext): string {
  const body = [
    "**What happened?**", "", "", "**Steps to reproduce**", "1. ", "", "**Expected result**", "", "",
    "**Environment**",
    `- SlashPCB ${ctx.version}`,
    `- ${ctx.platform} ${ctx.osRelease} (${ctx.arch})`,
    `- Electron ${ctx.electron}`,
    "",
  ].join("\n");
  return `${REPOSITORY}/issues/new?labels=bug&body=${encodeURIComponent(body)}`;
}

/** URL for a renderer link key, or null for anything unknown. */
export function linkFor(key: unknown, ctx: BugReportContext): string | null {
  if (key === "bug") return bugReportUrl(ctx);
  return typeof key === "string" && Object.hasOwn(APP_LINKS, key) ? APP_LINKS[key as keyof typeof APP_LINKS] : null;
}
