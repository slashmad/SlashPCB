// Application title bar, ported from the SlashAPP Electron starters (SlashStitch 0.2.x): identity and
// project on the left, Sponsor / Report a bug / About / version on the right. The bar is a window drag
// region; the OS overlays the native window controls at the right (Windows/Linux) or the traffic
// lights at the left (macOS). Links are fixed URLs in src/main/app-links.ts.
import { useEffect, useRef, useState } from "react";
import licenseText from "../../../LICENSE?raw";
import { api } from "../api";
import { useT } from "../i18n";

type LinkKey = "sponsor" | "bug" | "source" | "releases";
const openLink = (key: LinkKey) => void api.openLink(key);

const Heart = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 14s-5.5-3.4-5.5-7.4A3 3 0 0 1 8 4.4a3 3 0 0 1 5.5 2.2C13.5 10.6 8 14 8 14z" fill="currentColor" />
  </svg>
);
const Bug = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <rect x="4.5" y="5" width="7" height="8.5" rx="3.5" />
    <path d="M6 5V4a2 2 0 0 1 4 0v1M8 8v5M2.5 8.5h2M11.5 8.5h2M3 4.5l1.8 1.3M13 4.5l-1.8 1.3M3 13l1.8-1.3M13 13l-1.8-1.3" />
  </svg>
);
const Info = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="8" cy="8" r="6.2" />
    <path d="M8 7.2v4M8 4.8v.1" />
  </svg>
);

export function TitleBar({
  appName,
  platform,
  version,
  projectName,
  projectPath,
  showSponsor,
  onShowSponsor,
}: {
  appName: string;
  platform: string;
  version: string;
  projectName: string | null;
  projectPath: string | null;
  showSponsor: boolean;
  onShowSponsor: (show: boolean) => void;
}) {
  const t = useT();
  const [aboutOpen, setAboutOpen] = useState(false);
  const about = useRef<HTMLDivElement>(null);
  const aboutButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aboutOpen) return;
    const close = (e: MouseEvent) => {
      if (about.current && !about.current.contains(e.target as Node)) setAboutOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAboutOpen(false);
        aboutButton.current?.focus();
      }
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", key);
    };
  }, [aboutOpen]);

  const aboutLabel = t("tb.about", { app: appName });
  return (
    <header className={`titlebar titlebar-${platform === "darwin" ? "mac" : "overlay"}`}>
      <img className="titlebar-icon" src="./icon-64.png" alt="" width={18} height={18} />
      <span className="titlebar-name">{appName}</span>
      {projectName && (
        <>
          <span className="titlebar-sep" aria-hidden="true" />
          <span className="titlebar-project" title={projectPath ?? projectName}>{projectName}</span>
        </>
      )}
      <span className="titlebar-drag" />
      {showSponsor && (
        <span className="titlebar-sponsor">
          <button className="tb-pill tb-sponsor" onClick={() => openLink("sponsor")} title={t("tb.sponsorTitle", { app: appName })}>
            <Heart />
            {t("tb.sponsor")}
          </button>
          <button className="tb-dismiss" onClick={() => onShowSponsor(false)} aria-label={t("tb.hideSponsor")} title={t("tb.hideSponsorTitle")}>
            ×
          </button>
        </span>
      )}
      <button className="tb-pill" onClick={() => openLink("bug")} title={t("tb.bugTitle")}>
        <Bug />
        {t("tb.bug")}
      </button>
      <div className="titlebar-about" ref={about}>
        <button
          ref={aboutButton}
          className="tb-icon"
          aria-label={aboutLabel}
          aria-haspopup="dialog"
          aria-expanded={aboutOpen}
          title={aboutLabel}
          onClick={() => setAboutOpen((o) => !o)}
        >
          <Info />
        </button>
        {aboutOpen && (
          <div className="about-popover" role="dialog" aria-label={aboutLabel}>
            <div className="about-head">
              <img src="./icon-64.png" alt="" width={32} height={32} />
              <div>
                <strong>{appName}</strong>
                <div className="muted">{t("tb.version", { v: version })}</div>
              </div>
            </div>
            <div className="about-links">
              <button className="link-button" onClick={() => openLink("releases")}>{t("tb.releases")}</button>
              <button className="link-button" onClick={() => openLink("source")}>{t("tb.source")}</button>
            </div>
            <details className="about-license">
              <summary>{t("tb.licenseText")}</summary>
              <div>Copyright © 2026 slashmad</div>
              <pre tabIndex={0} aria-label={t("tb.licenseText")}>{licenseText}</pre>
            </details>
            <label className="about-check">
              <input type="checkbox" checked={showSponsor} onChange={(e) => onShowSponsor(e.target.checked)} />
              {t("tb.showSponsor")}
            </label>
          </div>
        )}
      </div>
      <span className="titlebar-version" title={`${appName} ${version}`}>v{version}</span>
    </header>
  );
}
