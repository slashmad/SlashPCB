// Regression test for starting agent CLIs through a Windows .cmd/.bat shim that the app cannot
// resolve to the real program (the cmd.exe fallback in src/main/agents/binaries.ts). On Windows it
// runs a real shim and checks that every argument arrives unchanged and that cmd.exe
// metacharacters never start another command. Elsewhere it checks the platform-independent parts.
// Run from the repository root:  node scripts/test-spawn.mjs
import { execFile, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
const require = createRequire(join(repo, "package.json"));
const { build } = require("esbuild");
const scratch = mkdtempSync(join(tmpdir(), "spawn test & co "));
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  -- ${detail}` : ""}`);
  if (!ok) failures++;
};

try {
  await build({ entryPoints: [join(repo, "src/main/agents/binaries.ts")], outfile: join(scratch, "b.cjs"), bundle: true, platform: "node", format: "cjs", logLevel: "error" });
  const b = require(join(scratch, "b.cjs"));

  const direct = b.spawnSpec("/usr/bin/codex", ["-c", 'x="y"']);
  check("W01 a real program is started directly, without a shell", direct.command === "/usr/bin/codex" && !direct.verbatim && direct.args[1] === 'x="y"');
  const line = b.cmdShellArgs("C:\\a b\\x.cmd", ["R&D", 'q"'])[3];
  check("W01 the cmd.exe line escapes &, quotes and spaces", line.includes("R^^^&D") && line.includes("C:\\a^ b\\x.cmd") && !/[^^]&/.test(line), line);

  if (process.platform === "win32") {
    const marker = join(scratch, "INJECTED.txt");
    const argv = join(scratch, "argv.js");
    writeFileSync(argv, "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n");
    // A shim the resolver cannot map to a program (no %~dp0% target), so the cmd.exe fallback runs.
    const shimDir = join(scratch, "shim dir (x86) & more");
    mkdirSync(shimDir);
    const shim = join(shimDir, "agent.cmd");
    writeFileSync(shim, '@"%SPAWN_TEST_NODE%" "%SPAWN_TEST_SCRIPT%" %*\r\n');
    const spec = b.spawnSpec(shim, []);
    check("W02 an unresolvable shim uses the cmd.exe fallback", spec.verbatim === true && /cmd\.exe$/i.test(spec.command), JSON.stringify(spec));

    const args = [
      "plain", "two words", "", 'quote " inside', "R&D | more > out.txt", "%PATH%", "%~dp0", "caret ^ bang !x!",
      "trailing backslash\\", 'back\\"slash', "(paren) [b] {c} ;,=", "C:\\Projects\\R&D Box\\main.py",
      'mcp_servers.x.args=["C:\\\\p q\\\\r&d", "--flag"]', `x & echo INJECTED> "${marker}"`, '" & echo INJECTED2 & "',
    ];
    const s = b.spawnSpec(shim, args);
    const env = { ...process.env, SPAWN_TEST_NODE: process.execPath, SPAWN_TEST_SCRIPT: argv };
    // execFile is how the login check runs, spawn how sessions and the version check run.
    const viaExec = await new Promise((done) => execFile(s.command, s.args, { encoding: "utf8", env, windowsHide: true, windowsVerbatimArguments: s.verbatim, timeout: 30000 },
      (e, stdout, stderr) => done({ out: stdout, err: e ? `${e.message} ${stderr}` : "" })));
    check("W03 every argument arrives unchanged through the shim", viaExec.out === JSON.stringify(args), viaExec.err || viaExec.out);
    check("W03 metacharacters never run another command", !existsSync(marker) && !viaExec.out.includes('"INJECTED2'));
    const r = spawnSync(s.command, s.args, { encoding: "utf8", env, windowsHide: true, windowsVerbatimArguments: s.verbatim, timeout: 30000 });
    check("W03 spawn behaves the same", r.status === 0 && r.stdout === JSON.stringify(args), r.stderr);
  } else {
    console.log("SKIP  W02/W03 run a real .cmd shim: Windows only (CI runs them on windows-2025)");
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`\n${failures ? `${failures} failed` : "all passed"}`);
process.exit(failures ? 1 : 0);
