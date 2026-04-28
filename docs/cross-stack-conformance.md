# Cross-stack conformance harness

Differential test, который запускает референс-имплементации формата IDF на одних и тех же fixtures и pair-wise сравнивает их выход.

## Что это даёт

Каждая stack-имплементация (idf-go / idf-rust / idf-swift) уже сравнивает свой выход с `expected/*` — но только со «своей стороны». Если реализация и эталонная фикстура расходятся одинаково (например, обе пишут лишнее поле `_meta`), conformance check этого не поймает. Cross-stack diff делает другой срез: «выходы stack'ов A и B изоморфны на одной и той же тройке (scenario × viewer × projection)».

Это runtime-проверка §1 манифеста v2 (Часть IV: четыре читателя формата) и слабая форма §23 axiom 5 (reader-equivalence) — в той форме, в какой её можно проверить сейчас, до Layer 3 detector'а из drift-protection-spec.

## Что сравнивается

Для каждой пары (stack_A, stack_B) и каждого домена `<fixtures>/`:

| Уровень | Файлы | Источник |
|---|---|---|
| L1 fold | `world/<scenario>.json` | каждый scenario из `phi/` |
| L1 filter | `viewer-world/<scenario>-as-<role>-<id>.json` | каждый файл из `expected/viewer-world/` |
| L2 crystallize | `artifact/<scenario>-<projection>-as-<role>-<id>.json` | каждый файл из `expected/artifact/` |
| L3 document | `document/<scenario>-<projection>-as-<role>-<id>.json` | каждый файл из `expected/document/` |
| L3-evolution | `hash/ontology.json` | **один** файл per домен — `{"schemaVersion": hashOntology(raw_ontology)}` |

Имена файлов идентичны для всех 3 stack'ов и совпадают с конвенцией `expected/*` — это упрощает идентификацию drift'а.

Сравнение **semantic-eq**: рекурсивная сортировка ключей объектов, массивы упорядочены, поле `_meta` игнорируется на любом уровне. Совпадает с логикой в `idf-go/internal/jsonutil`, `idf-rust/src/jsonutil.rs`, `idf-swift/Sources/IDFSpec/JSONUtil.swift`.

## Требования к stack-CLI

Каждая stack-имплементация **MUST** реализовать `--emit <out-dir>` режим в своём `conformance` бинарнике:

```
conformance <fixtures-dir> --emit <out-dir>
```

Поведение:

1. Не сравнивать с `expected/*` — вычислить и записать.
2. Итерировать те же тройки, что conformance в default-режиме (scenarios из `phi/`, viewer-role/id из имён файлов в `expected/viewer-world/` и `expected/artifact/`).
3. Записать каждый артефакт в `<out>/{world,viewer-world,artifact,document}/<basename>.json`.
4. Для `world` и `viewer-world` — обернуть в `{"world": ...}` / `{"viewerWorld": ...}` (так же как expected/).
5. Для `artifact` и `document` — корневой объект напрямую.
6. **L3-evolution hash** (с 2026-04-28): записать `<out>/hash/ontology.json` = `{"schemaVersion": hashOntology(raw_ontology)}`. Хэш считается на raw JSON-bytes из `ontology.json` (через `JSON.parse → hashOntology`), не на распарсенном struct'е — для cross-stack reproducibility (struct может быть lossy на extra-полях). Алгоритм нормирован в [`spec/schemas/hash-function.md`](../schemas/hash-function.md).
7. Создать недостающие директории. Использовать pretty-print JSON.

Реализации emit-mode на 2026-04-28: idf-go / idf-rust / idf-swift main (post-merge `feat/emit-mode` + `feat/hash-emit`).

## Запуск harness'а

```bash
# из idf-spec/
node scripts/cross-stack-diff.mjs

# подмножество stacks/доменов
node scripts/cross-stack-diff.mjs --stacks go,rust
node scripts/cross-stack-diff.mjs --domain library

# машиночитаемый отчёт
node scripts/cross-stack-diff.mjs --json
```

Harness ищет сборки в этом порядке:

| stack | путь |
|---|---|
| go | `<repos>/idf-go/.worktrees/emit-mode/cmd/conformance/main.go` (`go run`), затем `<repos>/idf-go/cmd/conformance/main.go` |
| rust | `<repos>/idf-rust/.worktrees/emit-mode/target/release/conformance`, затем `<repos>/idf-rust/target/release/conformance` |
| swift | `<repos>/idf-swift/.worktrees/emit-mode/.build/release/conformance`, затем `<repos>/idf-swift/.build/release/conformance` |

`<repos>` — общий родитель idf-spec и stack-репо (определяется автоматически).

Если бинарника нет — stack пропускается. Harness требует ≥2 доступных stack'а; иначе exit code 2.

## Reference stack

Первый из доступных stack'ов берётся как «золотой»: остальные сравниваются с ним. Сейчас это idf-go (самая зрелая реализация — v0.1.3, единственная прошедшая v0.1.4 feed/wizard fill rules).

Это **не** означает, что idf-go нормативный. Нормативной остаётся спецификация. Reference — просто фиксированная точка в pair-wise диффе: drift между stack'ом X и reference == drift в одной из двух точек, harness не различает.

## Формат отчёта

```
Cross-stack conformance diff
  Stacks:    go, rust, swift
  Reference: go
  Domains:   events, library

== Per-stack run status ==
  events       go: 32 files  |  rust: 32 files  |  swift: 32 files
  library      go: 41 files  |  rust: 41 files  |  swift: 41 files

== OVERALL: NO CROSS-STACK DRIFT ==
```

Если есть drift:

```
== DRIFT (3) ==
  [library] go ↔ swift: artifact/borrow-cycle-... content drift
  [library] go ↔ swift: world/empty.json content drift
  [events]  go ↔ rust: viewer-world/...as-attendee... missing in rust
```

`--json` выдаёт structured отчёт (`{stacks, domains, reference, results, drift}`) для CI.

## Что НЕ покрывается

- Триплеты (scenario × viewer × projection) без `expected/*` файлов. Если у домена есть `expected/world/empty.json`, harness прогонит fold для `empty`. Но если phi-сценарий `bootstrap` не имеет `expected/world/bootstrap.json` (admin-tier scenarios), он будет проигнорирован для виду совпадения с conformance-режимом.
- L4 (Pattern Bank apply, scheduler, irreversibility integrity, invariants) — пока ни одна реализация не поддерживает.
- Воспроизводимые фикстуры между запусками — fixtures дискретны, harness читает то, что есть.

## Расширения

**Добавить новый stack** (например, idf-typescript или idf-kotlin):

1. Реализовать `conformance <dir> --emit <out>` с конвенцией выше.
2. Добавить запись в `STACKS` массив в `scripts/cross-stack-diff.mjs` с `findRunner` / `invoke`.
3. Запустить `node scripts/cross-stack-diff.mjs` — он подхватит автоматически.

**Добавить новый домен** — fixtures-каталог в `spec/fixtures/<name>/` с `phi/` + `expected/*`. Harness итерирует по `readdirSync(spec/fixtures)` без явного списка.

**CI integration** — `--json` режим + парсинг exit code (0 / 1 / 2).
