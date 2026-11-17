// New-project dialog: a name and a parent folder (default "~/<App> Projects"). The main process
// validates both, creates the folder and its starter files, and opens the new project.
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useT } from "../i18n";

const sep = (p: string) => (p.includes("\\") && !p.includes("/") ? "\\" : "/");

export function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api.project.newDefaults(t("new.defaultName")).then((d) => {
      setParent(d.parent);
      setName(d.name);
      requestAnimationFrame(() => input.current?.select());
    });
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await api.project.create(name.trim(), parent);
    setBusy(false);
    if (r.ok) onClose();
    else setError(r.error === "io" ? t("new.err.io", { detail: r.detail ?? "" }) : t(`new.err.${r.error}`));
  };

  const target = parent && name.trim() ? `${parent.replace(/[\\/]+$/, "")}${sep(parent)}${name.trim()}` : "";
  return (
    <div className="modal-back" onClick={onClose}>
      <form className="modal new-project" role="dialog" aria-label={t("new.title")} onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); void create(); }}>
        <h3>{t("new.title")}</h3>
        <p className="muted small">{t("new.note")}</p>
        <label>
          {t("new.name")}
          <input ref={input} autoFocus value={name} maxLength={64} spellCheck={false} onChange={(e) => { setName(e.target.value); setError(null); }} />
        </label>
        <label>
          {t("new.location")}
          <span className="modal-row">
            <input className="grow" value={parent} spellCheck={false} onChange={(e) => { setParent(e.target.value); setError(null); }} />
            <button type="button" onClick={async () => { const p = await api.project.chooseFolder(parent); if (p) { setParent(p); setError(null); } }}>{t("new.browse")}</button>
          </span>
        </label>
        {target && <p className="muted small new-target">{t("new.creates", { path: target })}</p>}
        {error && <p className="err-msg">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>{t("new.cancel")}</button>
          <button type="submit" className="primary" disabled={busy || !name.trim() || !parent}>{t("new.create")}</button>
        </div>
      </form>
    </div>
  );
}
