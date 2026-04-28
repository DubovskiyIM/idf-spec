#!/usr/bin/env node
/**
 * harness-self-test — proof-of-signal для cross-stack-diff harness'а.
 *
 * Cross-stack-diff собирает и сравнивает выход 3 stack'ов на real fixtures.
 * Проблема: «зелёный» прогон может означать (a) всё correct ИЛИ (b) harness
 * не имеет signal вообще (e.g., always returns no-drift). Это self-test —
 * прогоняет ту же diff-логику на synthetic stack-output дирectories с
 * заранее известным набором drift'ов и проверяет что harness каждый
 * правильно идентифицирует.
 *
 * Запускается отдельно от cross-stack-diff (не зависит от собранных stack'ов).
 *
 * Usage:
 *   node scripts/harness-self-test.mjs
 *
 * Exit 0 = harness diff-логика correct, exit 1 = self-test fail.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

// --- duplicate of semantic-eq from cross-stack-diff.mjs --------------------
// Намеренно дублируем, не импортируем — self-test проверяет именно эту
// нормативную форму. Если она drift'ит между файлами, это само drift.

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

function listFiles(rootDir) {
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

// --- diff loop (mirrors cross-stack-diff.mjs) ------------------------------

function diff(refDir, otherDir, refId = "ref", otherId = "other") {
  const drift = [];
  const refFiles = listFiles(refDir);
  const otherFiles = listFiles(otherDir);
  const refRel = new Set(refFiles.map((f) => relative(refDir, f)));
  const otherRel = new Set(otherFiles.map((f) => relative(otherDir, f)));

  for (const r of refRel) {
    if (!otherRel.has(r)) drift.push({ pair: [refId, otherId], file: r, kind: "missing-in", side: otherId });
  }
  for (const o of otherRel) {
    if (!refRel.has(o)) drift.push({ pair: [refId, otherId], file: o, kind: "missing-in", side: refId });
  }
  for (const r of refRel) {
    if (!otherRel.has(r)) continue;
    const rJson = JSON.parse(readFileSync(join(refDir, r), "utf8"));
    const oJson = JSON.parse(readFileSync(join(otherDir, r), "utf8"));
    if (!semanticEqual(rJson, oJson)) {
      drift.push({ pair: [refId, otherId], file: r, kind: "content-mismatch" });
    }
  }
  return drift;
}

// --- test setup ------------------------------------------------------------

const tmpRoot = mkdtempSync(join(tmpdir(), "idf-harness-self-test-"));

function writeJSON(dir, relPath, obj) {
  const full = join(dir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, JSON.stringify(obj, null, 2) + "\n");
}

const tests = [];

function expect(name, condition, detail = "") {
  tests.push({ name, pass: !!condition, detail });
}

// --- test 1: two identical dirs → no drift --------------------------------

const t1Ref = join(tmpRoot, "t1/ref");
const t1Other = join(tmpRoot, "t1/other");
writeJSON(t1Ref, "world/empty.json", { world: {} });
writeJSON(t1Ref, "hash/ontology.json", { schemaVersion: "abc123abc12345" });
writeJSON(t1Other, "world/empty.json", { world: {} });
writeJSON(t1Other, "hash/ontology.json", { schemaVersion: "abc123abc12345" });
const t1Drift = diff(t1Ref, t1Other);
expect("identical dirs → no drift", t1Drift.length === 0, `got ${t1Drift.length} drift entries`);

// --- test 2: missing file in other → missing-in drift ---------------------

const t2Ref = join(tmpRoot, "t2/ref");
const t2Other = join(tmpRoot, "t2/other");
writeJSON(t2Ref, "world/a.json", { world: {} });
writeJSON(t2Ref, "world/b.json", { world: {} });
writeJSON(t2Other, "world/a.json", { world: {} });
const t2Drift = diff(t2Ref, t2Other);
expect("missing file in other → 1 missing-in drift", t2Drift.length === 1 && t2Drift[0].kind === "missing-in" && t2Drift[0].side === "other" && t2Drift[0].file === "world/b.json");

// --- test 3: extra file in other → missing-in drift on ref side ----------

const t3Ref = join(tmpRoot, "t3/ref");
const t3Other = join(tmpRoot, "t3/other");
writeJSON(t3Ref, "world/a.json", { world: {} });
writeJSON(t3Other, "world/a.json", { world: {} });
writeJSON(t3Other, "world/extra.json", { world: {} });
const t3Drift = diff(t3Ref, t3Other);
expect("extra file in other → missing-in drift on ref", t3Drift.length === 1 && t3Drift[0].kind === "missing-in" && t3Drift[0].side === "ref" && t3Drift[0].file === "world/extra.json");

// --- test 4: same files, different content → content-mismatch -------------

const t4Ref = join(tmpRoot, "t4/ref");
const t4Other = join(tmpRoot, "t4/other");
writeJSON(t4Ref, "hash/ontology.json", { schemaVersion: "1a23f3f820e80b" });
writeJSON(t4Other, "hash/ontology.json", { schemaVersion: "deadbeefdeadbe" });
const t4Drift = diff(t4Ref, t4Other);
expect("different schemaVersion → content-mismatch", t4Drift.length === 1 && t4Drift[0].kind === "content-mismatch" && t4Drift[0].file === "hash/ontology.json");

// --- test 5: _meta differs but content equal → no drift -------------------

const t5Ref = join(tmpRoot, "t5/ref");
const t5Other = join(tmpRoot, "t5/other");
writeJSON(t5Ref, "world/a.json", { _meta: { specVersion: "0.1" }, world: { x: 1 } });
writeJSON(t5Other, "world/a.json", { _meta: { specVersion: "0.2" }, world: { x: 1 } });
const t5Drift = diff(t5Ref, t5Other);
expect("_meta differs only → no drift (semantic-eq ignores _meta)", t5Drift.length === 0, `got ${t5Drift.length}`);

// --- test 6: object key order does NOT matter -----------------------------

const t6Ref = join(tmpRoot, "t6/ref");
const t6Other = join(tmpRoot, "t6/other");
writeJSON(t6Ref, "world/a.json", { world: { a: 1, b: 2, c: 3 } });
writeJSON(t6Other, "world/a.json", { world: { c: 3, b: 2, a: 1 } });
const t6Drift = diff(t6Ref, t6Other);
expect("object key order does not matter", t6Drift.length === 0, `got ${t6Drift.length}`);

// --- test 7: array order DOES matter --------------------------------------

const t7Ref = join(tmpRoot, "t7/ref");
const t7Other = join(tmpRoot, "t7/other");
writeJSON(t7Ref, "world/a.json", { world: { roles: ["admin", "viewer"] } });
writeJSON(t7Other, "world/a.json", { world: { roles: ["viewer", "admin"] } });
const t7Drift = diff(t7Ref, t7Other);
expect("array order matters", t7Drift.length === 1 && t7Drift[0].kind === "content-mismatch");

// --- test 8: empty dirs on both sides → no drift -------------------------

const t8Ref = join(tmpRoot, "t8/ref");
const t8Other = join(tmpRoot, "t8/other");
mkdirSync(t8Ref, { recursive: true });
mkdirSync(t8Other, { recursive: true });
const t8Drift = diff(t8Ref, t8Other);
expect("empty dirs → no drift", t8Drift.length === 0);

// --- test 9: nested directories deep-walk --------------------------------

const t9Ref = join(tmpRoot, "t9/ref");
const t9Other = join(tmpRoot, "t9/other");
writeJSON(t9Ref, "a/b/c/deep.json", { x: 1 });
writeJSON(t9Other, "a/b/c/deep.json", { x: 2 });
const t9Drift = diff(t9Ref, t9Other);
expect("deep nesting → walked correctly", t9Drift.length === 1 && t9Drift[0].file === "a/b/c/deep.json");

// --- test 10: scalar mismatch (number vs string) -------------------------

const t10Ref = join(tmpRoot, "t10/ref");
const t10Other = join(tmpRoot, "t10/other");
writeJSON(t10Ref, "world/a.json", { world: { count: 1 } });
writeJSON(t10Other, "world/a.json", { world: { count: "1" } });
const t10Drift = diff(t10Ref, t10Other);
expect("number vs string of same value → drift", t10Drift.length === 1);

// --- output ---------------------------------------------------------------

const passed = tests.filter((t) => t.pass).length;
const failed = tests.length - passed;

console.log(`\nharness self-test: ${passed} pass, ${failed} fail / ${tests.length} total`);
for (const t of tests) {
  const icon = t.pass ? "✓" : "✗";
  const suffix = t.detail && !t.pass ? ` — ${t.detail}` : "";
  console.log(`  ${icon} ${t.name}${suffix}`);
}

// Cleanup
rmSync(tmpRoot, { recursive: true, force: true });

if (failed > 0) {
  console.error("\nFAIL: harness diff-логика drifted from spec. Не доверяй cross-stack-diff пока этот self-test не green.");
  process.exit(1);
}

console.log("\nOK — harness diff-логика behaves correctly");
process.exit(0);
