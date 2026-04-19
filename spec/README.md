# spec-v0.1

Нормативная спецификация формата **Intent-Driven Frontend** (IDF), версия **v0.1**.

**Conformance classes:** L1 (parser + Φ + fold + filterWorldForRole), L2 (crystallize + 7 архетипов + mergeProjections).

**Reserved для v0.2+:** L3 (4 материализации), L4 (Pattern Bank apply, темпоральный scheduler, irreversibility integrity rule, 5 видов invariant'ов).

## Содержание

### Cross-cutting

- [`00-introduction.md`](00-introduction.md) — статус, RFC 2119, граница нормативного / информативного, конвенции
- [`01-conformance.md`](01-conformance.md) — L1/L2 нормативно, L3/L4 Reserved, процедура self-validation
- [`02-axioms.md`](02-axioms.md) — 4 нормативные аксиомы формата

### Объекты ([`03-objects/`](03-objects/))

- [`effect.md`](03-objects/effect.md) — атомы изменения мира (`{kind, entity, fields, context}`)
- [`ontology.md`](03-objects/ontology.md) — тип данных домена (entities, fields, roles)
- [`intent.md`](03-objects/intent.md) — декларативные частицы изменения
- [`projection.md`](03-objects/projection.md) — авторский контракт на view
- [`artifact.md`](03-objects/artifact.md) — output crystallize (тип данных, не render)

### Алгебра ([`04-algebra/`](04-algebra/))

- [`fold.md`](04-algebra/fold.md) — `fold(Φ, ontology) → world`
- [`filter-world.md`](04-algebra/filter-world.md) — `filterWorldForRole(world, viewer, ontology) → viewerWorld`
- [`crystallize.md`](04-algebra/crystallize.md) — 6-фазный pipeline `(intents, ontology, projection, viewer, viewerWorld) → artifact`

### JSON Schemas ([`schemas/`](schemas/), draft-07)

**Core (нормативно):**

- [`ontology.schema.json`](schemas/ontology.schema.json)
- [`intent.schema.json`](schemas/intent.schema.json)
- [`effect.schema.json`](schemas/effect.schema.json)
- [`projection.schema.json`](schemas/projection.schema.json)
- [`artifact.schema.json`](schemas/artifact.schema.json)

**Wrapper-схемы (для fixture-файлов):**

- [`phi.schema.json`](schemas/phi.schema.json) — `{_meta, effects[]}`
- [`intents-collection.schema.json`](schemas/intents-collection.schema.json) — `{_meta, intents[]}`
- [`projections-collection.schema.json`](schemas/projections-collection.schema.json) — `{_meta, projections[]}`

### Fixtures ([`fixtures/library/`](fixtures/library/))

Эталонный синтетический домен `library` (User, Book, Loan; reader/librarian; 7 intents; 5 проекций; 7 Φ-сценариев; 18 viewer-world expected; 8 artifact expected). См. [`fixtures/library/README.md`](fixtures/library/README.md) для полного описания и conformance check procedure.

## Self-validation (для авторов спеки)

```bash
npm install
./validate.sh
```

Запускает AJV draft-07 на все schemas + валидирует fixtures против соответствующих схем. Tooling в `idf-spec/` — infrastructure, не часть нормативного формата (implementer выбирает свой validator).

Conformance check для implementer'а — отдельная процедура, описанная в [`01-conformance.md`](01-conformance.md).

## Обратная связь

Ambiguities манифеста v2, обнаруженные при написании спеки, собраны в [`../feedback/manifesto-v2.md`](../feedback/manifesto-v2.md) — backlog для манифеста v2.1.

## Лицензия

BSL 1.1 (см. родительский каталог).
