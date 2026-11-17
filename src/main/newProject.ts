// New projects: an empty KiCad 10 project (project, schematic and board) in a new folder.
// The board and schematic headers match what KiCad 10.0 itself writes for an empty design
// (pcbnew.NewBoard + SaveBoard, kicad-cli sch upgrade; checked 2026-11-17). KiCad completes the
// project file with its defaults on first open.
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

/** Error keys the renderer translates (i18n `new.err.*`). */
export type NewProjectError = "name" | "parent" | "exists";

/**
 * A project name becomes a folder and file name on every platform: no path separators, no
 * characters Windows refuses, no leading/trailing dots or spaces, at most 64 characters.
 */
export function projectNameValid(name: string): boolean {
  return name.length > 0 && name.length <= 64 && name === name.trim() && !/[<>:"/\\|?*\u0000-\u001f]/.test(name)
    && !/^\.|\.$/.test(name) && !/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(name);
}

/** Validates a new project location; returns the folder to create or an error key. */
export function newProjectDir(parent: string, name: string): { dir: string } | { error: NewProjectError } {
  if (!projectNameValid(name)) return { error: "name" };
  if (!parent || !isAbsolute(parent) || (existsSync(parent) && !statSync(parent).isDirectory())) return { error: "parent" };
  const dir = join(parent, name);
  if (existsSync(dir) && (!statSync(dir).isDirectory() || readdirSync(dir).length > 0)) return { error: "exists" };
  return { dir };
}

/** First free "<base>", "<base> 2", … under parent. */
export function freeProjectName(parent: string, base: string): string {
  for (let i = 1; i < 1000; i++) {
    const name = i === 1 ? base : `${base} ${i}`;
    if (!existsSync(join(parent, name))) return name;
  }
  return base;
}

const sexprString = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

function projectFile(name: string): string {
  return JSON.stringify({
    board: { design_settings: { defaults: {}, diff_pair_dimensions: [], drc_exclusions: [], rules: {}, track_widths: [], via_dimensions: [] } },
    boards: [],
    libraries: { pinned_footprint_libs: [], pinned_symbol_libs: [] },
    meta: { filename: `${name}.kicad_pro`, version: 1 },
    net_settings: { classes: [], meta: { version: 0 } },
    pcbnew: { page_layout_descr_file: "" },
    sheets: [],
    text_variables: {},
  }, null, 2) + "\n";
}

function schematicFile(name: string): string {
  return `(kicad_sch
\t(version 20260306)
\t(generator "slashpcb")
\t(generator_version "1.0")
\t(uuid "${randomUUID()}")
\t(paper "A4")
\t(title_block
\t\t(title ${sexprString(name)})
\t)
\t(lib_symbols)
\t(sheet_instances
\t\t(path "/"
\t\t\t(page "1")
\t\t)
\t)
\t(embedded_fonts no)
)
`;
}

const LAYERS = [
  [0, "F.Cu", "signal"], [2, "B.Cu", "signal"], [9, "F.Adhes", "user", "F.Adhesive"], [11, "B.Adhes", "user", "B.Adhesive"],
  [13, "F.Paste", "user"], [15, "B.Paste", "user"], [5, "F.SilkS", "user", "F.Silkscreen"], [7, "B.SilkS", "user", "B.Silkscreen"],
  [1, "F.Mask", "user"], [3, "B.Mask", "user"], [17, "Dwgs.User", "user", "User.Drawings"], [19, "Cmts.User", "user", "User.Comments"],
  [21, "Eco1.User", "user", "User.Eco1"], [23, "Eco2.User", "user", "User.Eco2"], [25, "Edge.Cuts", "user"], [27, "Margin", "user"],
  [31, "F.CrtYd", "user", "F.Courtyard"], [29, "B.CrtYd", "user", "B.Courtyard"], [35, "F.Fab", "user"], [33, "B.Fab", "user"],
  [39, "User.1", "user"], [41, "User.2", "user"], [43, "User.3", "user"], [45, "User.4", "user"],
] as const;

function boardFile(name: string): string {
  const layers = LAYERS.map(([n, id, type, alias]) => `\t\t(${n} "${id}" ${type}${alias ? ` "${alias}"` : ""})`).join("\n");
  return `(kicad_pcb
\t(version 20260206)
\t(generator "slashpcb")
\t(generator_version "1.0")
\t(general
\t\t(thickness 1.6)
\t\t(legacy_teardrops no)
\t)
\t(paper "A4")
\t(title_block
\t\t(title ${sexprString(name)})
\t)
\t(layers
${layers}
\t)
\t(setup
\t\t(pad_to_mask_clearance 0)
\t\t(allow_soldermask_bridges_in_footprints no)
\t\t(tenting
\t\t\t(front yes)
\t\t\t(back yes)
\t\t)
\t)
\t(embedded_fonts no)
)
`;
}

/** Creates the folder and the three KiCad files; returns the .kicad_pro path. Never overwrites. */
export function createKicadProject(parent: string, name: string): { pro: string } | { error: NewProjectError } {
  const r = newProjectDir(parent, name);
  if ("error" in r) return r;
  mkdirSync(r.dir, { recursive: true });
  const files: [string, string][] = [
    [`${name}.kicad_pro`, projectFile(name)],
    [`${name}.kicad_sch`, schematicFile(name)],
    [`${name}.kicad_pcb`, boardFile(name)],
  ];
  for (const [file, text] of files) writeFileSync(join(r.dir, file), text, { flag: "wx" });
  return { pro: join(r.dir, `${name}.kicad_pro`) };
}
