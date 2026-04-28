#!/usr/bin/env node
/**
 * default-conformance — runs each stack's conformance binary in default mode
 * (без --emit, сравнивает с expected/*) на каждом домене из spec/fixtures/.
 *
 * Дополняет cross-stack-diff: тот сравнивает stack'и попарно между собой и
 * пройдёт зелёным даже если все 3 стэка одинаково drift'ят от expected/*.
 * Default-mode conformance ловит такой случай — каждый stack independently
 * валидирует против expected.
 *
 * Stack пропускается если бинарник не найден. Домен пропускается если
 * каталог отсутствует. Exit 0 если все доступные (stack × domain) пары
 * passed; exit 1 если хоть одна failed.
 *
 * Usage:
 *   node scripts/default-conformance.mjs
 *   REPOS_ROOT=... node scripts/default-conformance.mjs   # CI
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_ROOT = resolve(__dirname, "..");

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
const REPOS_ROOT = process.env.REPOS_ROOT ? resolve(process.env.REPOS_ROOT) : findReposRoot(SPEC_ROOT);

// --- stacks (mirror cross-stack-diff.mjs structure) -----------------------

const STACKS = [
  {
    id: "go",
    findRunner() {
      const candidates = [
        join(REPOS_ROOT, "idf-go/cmd/conformance/conformance"), // CI: pre-built
        join(REPOS_ROOT, "idf-go/.worktrees/hash-emit"),
        join(REPOS_ROOT, "idf-go/.worktrees/emit-mode"),
        join(REPOS_ROOT, "idf-go"),
      ];
      // Prefer pre-built binary in CI; fall back to go run для локального dev.
      if (existsSync(candidates[0])) return { kind: "binary", bin: candidates[0] };
      for (const root of candidates.slice(1)) {
        if (existsSync(join(root, "cmd/conformance/main.go"))) {
          return { kind: "go-run", cwd: root };
        }
      }
      return null;
    },
    invoke(runner, fixturesDir) {
      if (runner.kind === "binary") {
        return spawnSync(runner.bin, [fixturesDir], { encoding: "utf8" });
      }
      return spawnSync("go", ["run", "./cmd/conformance", fixturesDir], { cwd: runner.cwd, encoding: "utf8" });
    },
  },
  {
    id: "rust",
    findRunner() {
      const candidates = [
        join(REPOS_ROOT, "idf-rust/target/release/conformance"),
      ];
      for (const bin of candidates) {
        if (existsSync(bin)) return { kind: "binary", bin };
      }
      return null;
    },
    invoke(runner, fixturesDir) {
      return spawnSync(runner.bin, [fixturesDir], { encoding: "utf8" });
    },
  },
  {
    id: "swift",
    findRunner() {
      const candidates = [
        join(REPOS_ROOT, "idf-swift/.build/release/conformance"),
      ];
      for (const bin of candidates) {
        if (existsSync(bin)) return { kind: "binary", bin };
      }
      return null;
    },
    invoke(runner, fixturesDir) {
      return spawnSync(runner.bin, [fixturesDir], { encoding: "utf8" });
    },
  },
];

// --- discover domains ------------------------------------------------------

const FIXTURES_ROOT = join(SPEC_ROOT, "spec/fixtures");
const domains = readdirSync(FIXTURES_ROOT).filter((name) =>
  statSync(join(FIXTURES_ROOT, name)).isDirectory()
);

// --- discover available stacks --------------------------------------------

const availableStacks = [];
for (const s of STACKS) {
  const runner = s.findRunner();
  if (runner) availableStacks.push({ ...s, runner });
}

if (availableStacks.length === 0) {
  console.error("no stacks available — build at least one of (go, rust, swift) conformance binary first.");
  process.exit(2);
}

// --- run matrix ------------------------------------------------------------

console.log(`Default-conformance matrix`);
console.log(`  Stacks:  ${availableStacks.map((s) => s.id).join(", ")}`);
console.log(`  Domains: ${domains.join(", ")}`);
console.log("");

const results = [];

for (const domain of domains) {
  const fixturesDir = join(FIXTURES_ROOT, domain);
  for (const stack of availableStacks) {
    process.stdout.write(`  ${stack.id} × ${domain.padEnd(12)}`);
    const r = stack.invoke(stack.runner, fixturesDir);
    const ok = r.status === 0;
    results.push({ stack: stack.id, domain, ok, output: (r.stdout || "") + (r.stderr || "") });
    if (ok) {
      // Извлечь last conformance line (e.g. "L1+L2+L3(document) CONFORMANT")
      const m = (r.stdout || "").match(/== OVERALL: (.+) ==/);
      console.log(`  ${m ? m[1] : "OK"}`);
    } else {
      console.log(`  FAIL`);
    }
  }
}

const failed = results.filter((r) => !r.ok);
console.log("");
console.log(`${results.length - failed.length}/${results.length} (stack × domain) passed`);

if (failed.length > 0) {
  console.log("");
  console.log("=== Failures ===");
  for (const f of failed) {
    console.log(`\n--- ${f.stack} × ${f.domain} ---`);
    // Print only the FAIL lines + OVERALL для краткости
    const lines = f.output.split("\n").filter((l) => l.includes("FAIL") || l.includes("OVERALL"));
    for (const l of lines) console.log(`  ${l}`);
  }
  process.exit(1);
}

console.log("== ALL CONFORMANT ==");
process.exit(0);
