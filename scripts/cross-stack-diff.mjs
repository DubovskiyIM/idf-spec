#!/usr/bin/env node
/**
 * cross-stack-diff: differential conformance harness across идентичных stack-impl'ов IDF.
 *
 * Что делает:
 *   1. Для каждого stack'а (go, rust, swift) и каждого домена (library, events)
 *      запускает `conformance <fixtures-dir> --emit <tmp>` — каждый stack пишет
 *      world / viewer-world / artifact / document как JSON.
 *   2. Берёт первый присутствующий stack как «золотой» reference и pair-wise
 *      semantic-сравнивает остальные с ним по каждому файлу.
 *   3. Печатает матрицу прохождений и список drift'ов (если есть).
 *
 * Stack считается доступным, если есть собранный бинарник:
 *   - go    : `go run ./cmd/conformance` в idf-go или idf-go/.worktrees/emit-mode
 *   - rust  : target/release/conformance в idf-rust(/.worktrees/emit-mode)
 *   - swift : .build/release/conformance в idf-swift(/.worktrees/emit-mode)
 *
 * Stack пропускается, если бинарник не найден — harness продолжает с остальными.
 *
 * Usage:
 *   node scripts/cross-stack-diff.mjs                       # все stacks × все домены
 *   node scripts/cross-stack-diff.mjs --domain library      # один домен
 *   node scripts/cross-stack-diff.mjs --stacks go,rust      # подмножество stacks
 *   node scripts/cross-stack-diff.mjs --json                # машиночитаемый отчёт
 *
 * Exit code: 0 если все pair'ы совпали, 1 если есть drift, 2 если ни один stack недоступен.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// SPEC_ROOT — это либо main checkout idf-spec, либо worktree внутри `.worktrees/`.
// REPOS_ROOT — общий родитель idf-spec и stack-репозиториев (idf-go / idf-rust / idf-swift),
// независимо от того, запускаемся ли мы из main checkout или worktree.
const SCRIPT_PARENT = resolve(__dirname, "..");
const SPEC_ROOT = SCRIPT_PARENT;
function findReposRoot(start) {
  let cur = start;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(cur, "..");
    if (existsSync(join(candidate, "idf-go")) && existsSync(join(candidate, "idf-rust"))) {
      return candidate;
    }
    if (candidate === cur) break;
    cur = candidate;
  }
  return resolve(start, "..");
}
// Env override для CI: REPOS_ROOT=/path/to/checkouts (где лежат idf-go, idf-rust, idf-swift).
const REPOS_ROOT = process.env.REPOS_ROOT
  ? resolve(process.env.REPOS_ROOT)
  : findReposRoot(SPEC_ROOT);

// --- args -------------------------------------------------------------------

const args = process.argv.slice(2);
let onlyDomains = null;
let onlyStacks = null;
let asJSON = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--domain" || a === "--domains") {
    onlyDomains = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
  } else if (a === "--stack" || a === "--stacks") {
    onlyStacks = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
  } else if (a === "--json") {
    asJSON = true;
  } else if (a === "--help" || a === "-h") {
    console.log(readFileSync(import.meta.url.replace("file://", ""), "utf8").split("\n").filter((l) => l.startsWith(" *") || l.startsWith("/**") || l.startsWith(" */")).join("\n"));
    process.exit(0);
  } else {
    console.error(`unknown arg: ${a}`);
    process.exit(2);
  }
}

// --- stacks -----------------------------------------------------------------

/**
 * Каждый stack описывает: id, как найти бинарник (или способ запустить),
 * и как вызывать. Для случаев когда есть и .worktrees/emit-mode/ и main checkout,
 * предпочитаем worktree (там --emit может быть только что добавлен и ещё не merged).
 */
const STACKS = [
  {
    id: "go",
    findRunner() {
      const wt = join(REPOS_ROOT, "idf-go/.worktrees/emit-mode");
      const main = join(REPOS_ROOT, "idf-go");
      for (const root of [wt, main]) {
        if (existsSync(join(root, "cmd/conformance/main.go"))) {
          return { kind: "go-run", cwd: root };
        }
      }
      return null;
    },
    invoke(runner, fixturesDir, emitDir) {
      return spawnSync("go", ["run", "./cmd/conformance", fixturesDir, "--emit", emitDir], {
        cwd: runner.cwd,
        encoding: "utf8",
      });
    },
  },
  {
    id: "rust",
    findRunner() {
      const wt = join(REPOS_ROOT, "idf-rust/.worktrees/emit-mode/target/release/conformance");
      const main = join(REPOS_ROOT, "idf-rust/target/release/conformance");
      for (const bin of [wt, main]) {
        if (existsSync(bin)) return { kind: "binary", bin };
      }
      return null;
    },
    invoke(runner, fixturesDir, emitDir) {
      return spawnSync(runner.bin, [fixturesDir, "--emit", emitDir], { encoding: "utf8" });
    },
  },
  {
    id: "swift",
    findRunner() {
      const wt = join(REPOS_ROOT, "idf-swift/.worktrees/emit-mode/.build/release/conformance");
      const main = join(REPOS_ROOT, "idf-swift/.build/release/conformance");
      for (const bin of [wt, main]) {
        if (existsSync(bin)) return { kind: "binary", bin };
      }
      return null;
    },
    invoke(runner, fixturesDir, emitDir) {
      return spawnSync(runner.bin, [fixturesDir, "--emit", emitDir], { encoding: "utf8" });
    },
  },
];

// --- domains ----------------------------------------------------------------

const FIXTURES_ROOT = join(SPEC_ROOT, "spec/fixtures");
const allDomains = readdirSync(FIXTURES_ROOT).filter((name) =>
  statSync(join(FIXTURES_ROOT, name)).isDirectory()
);

const domainsToRun = onlyDomains ? allDomains.filter((d) => onlyDomains.includes(d)) : allDomains;

// --- semantic eq (mirrors idf-go/jsonutil) ---------------------------------

function semanticEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!semanticEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === "object") {
    const ak = Object.keys(a).filter((k) => k !== "_meta");
    const bk = Object.keys(b).filter((k) => k !== "_meta");
    if (ak.length !== bk.length) return false;
    const setB = new Set(bk);
    for (const k of ak) {
      if (!setB.has(k)) return false;
      if (!semanticEqual(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
}

// --- harness ---------------------------------------------------------------

function listEmittedFiles(rootDir) {
  const out = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".json")) out.push(p);
    }
  }
  walk(rootDir);
  return out.sort();
}

const availableStacks = [];
for (const s of STACKS) {
  if (onlyStacks && !onlyStacks.includes(s.id)) continue;
  const runner = s.findRunner();
  if (runner) availableStacks.push({ ...s, runner });
}

if (availableStacks.length === 0) {
  console.error("no stacks available — build at least one of (go, rust, swift) conformance binary first.");
  process.exit(2);
}

if (availableStacks.length === 1) {
  console.error(`only one stack available (${availableStacks[0].id}) — нужно ≥2 для cross-stack diff.`);
  process.exit(2);
}

const tmpRoot = mkdtempSync(join(tmpdir(), "idf-cross-stack-"));
const report = {
  stacks: availableStacks.map((s) => s.id),
  domains: domainsToRun,
  reference: availableStacks[0].id,
  results: {},
  drift: [],
};

for (const domain of domainsToRun) {
  const domainDir = join(FIXTURES_ROOT, domain);
  if (!existsSync(domainDir)) {
    console.warn(`SKIP domain ${domain}: not found`);
    continue;
  }
  report.results[domain] = {};
  for (const stack of availableStacks) {
    const out = join(tmpRoot, domain, stack.id);
    const r = stack.invoke(stack.runner, domainDir, out);
    if (r.status !== 0) {
      report.results[domain][stack.id] = { ok: false, error: (r.stderr || r.stdout || "").trim().split("\n").pop() };
      continue;
    }
    report.results[domain][stack.id] = { ok: true, dir: out, files: listEmittedFiles(out).length };
  }
}

// pair-wise diff: reference vs others
for (const domain of domainsToRun) {
  const domainResults = report.results[domain];
  if (!domainResults) continue;
  const ref = availableStacks[0];
  const refResult = domainResults[ref.id];
  if (!refResult || !refResult.ok) continue;
  const refFiles = listEmittedFiles(refResult.dir);

  for (const other of availableStacks.slice(1)) {
    const otherResult = domainResults[other.id];
    if (!otherResult || !otherResult.ok) continue;
    const otherFiles = listEmittedFiles(otherResult.dir);
    const refRel = new Set(refFiles.map((f) => relative(refResult.dir, f)));
    const otherRel = new Set(otherFiles.map((f) => relative(otherResult.dir, f)));

    // file-set divergence
    for (const r of refRel) {
      if (!otherRel.has(r)) {
        report.drift.push({ domain, pair: [ref.id, other.id], file: r, kind: "missing-in", side: other.id });
      }
    }
    for (const o of otherRel) {
      if (!refRel.has(o)) {
        report.drift.push({ domain, pair: [ref.id, other.id], file: o, kind: "missing-in", side: ref.id });
      }
    }

    // content divergence
    for (const r of refRel) {
      if (!otherRel.has(r)) continue;
      const rPath = join(refResult.dir, r);
      const oPath = join(otherResult.dir, r);
      let rJson, oJson;
      try {
        rJson = JSON.parse(readFileSync(rPath, "utf8"));
        oJson = JSON.parse(readFileSync(oPath, "utf8"));
      } catch (e) {
        report.drift.push({ domain, pair: [ref.id, other.id], file: r, kind: "parse-error", error: String(e) });
        continue;
      }
      if (!semanticEqual(rJson, oJson)) {
        report.drift.push({ domain, pair: [ref.id, other.id], file: r, kind: "content-mismatch" });
      }
    }
  }
}

// --- output -----------------------------------------------------------------

if (asJSON) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.drift.length === 0 ? 0 : 1);
}

console.log("Cross-stack conformance diff");
console.log(`  Stacks:    ${report.stacks.join(", ")}`);
console.log(`  Reference: ${report.reference}`);
console.log(`  Domains:   ${report.domains.join(", ")}`);
console.log("");

console.log("== Per-stack run status ==");
for (const domain of domainsToRun) {
  const domainResults = report.results[domain] ?? {};
  const cells = availableStacks.map((s) => {
    const r = domainResults[s.id];
    if (!r) return `${s.id}: (skipped)`;
    if (!r.ok) return `${s.id}: FAIL — ${r.error || "?"}`;
    return `${s.id}: ${r.files} files`;
  });
  console.log(`  ${domain.padEnd(12)} ${cells.join("  |  ")}`);
}
console.log("");

if (report.drift.length === 0) {
  console.log("== OVERALL: NO CROSS-STACK DRIFT ==");
  process.exit(0);
}

console.log(`== DRIFT (${report.drift.length}) ==`);
for (const d of report.drift) {
  if (d.kind === "missing-in") {
    console.log(`  [${d.domain}] ${d.pair[0]} ↔ ${d.pair[1]}: file ${d.file} missing in ${d.side}`);
  } else if (d.kind === "content-mismatch") {
    console.log(`  [${d.domain}] ${d.pair[0]} ↔ ${d.pair[1]}: ${d.file} content drift`);
  } else if (d.kind === "parse-error") {
    console.log(`  [${d.domain}] ${d.pair[0]} ↔ ${d.pair[1]}: ${d.file} parse error — ${d.error}`);
  }
}
process.exit(1);
