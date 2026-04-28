# L3-evolution: Schema evolution & reader gap policy

**Conformance class.** Дополняет L3 (см. [`01-conformance.md`](01-conformance.md)). Реализация L3-evolution conformant ↔ выполняет требования §1–§7 этой главы.

**Источник.** Manifest v2.1 глава «Эволюция онтологии» — описывает мотивацию, доказательства композициональности, архитектурные пункты. Эта глава — нормативная (требования к реализации).

**Reference impl.** `@intent-driven/core@0.107.0+` и `@intent-driven/engine@0.4.0+` в [`idf-sdk`](https://github.com/DubovskiyIM/idf-sdk).

---

## §1. effect.context.schemaVersion

Каждый effect, добавляемый в Φ, **MUST** содержать `effect.context.schemaVersion: string`.

```jsonc
{
  "id": "e1",
  "alpha": "add",
  "target": "Task",
  "context": {
    "id": "t1",
    "schemaVersion": "a3f9c8e1742b6d"
  }
}
```

### Sentinel

Реализация **MUST** интерпретировать отсутствие поля `schemaVersion` как sentinel `"unknown"`. Эффекты с `unknown` обрабатываются upcast pipeline как «применять полную цепочку upcaster'ов от root до target».

### Hash function

`schemaVersion` **MUST** быть результатом `hashOntology(ontology_at_confirm_time)`, где `hashOntology` — детерминированная функция:

1. **Canonicalize**: рекурсивная сортировка ключей объектов; массивы сохраняют порядок (он семантичен).
2. **Serialize**: `JSON.stringify` канонизированной формы.
3. **Hash**: cyrb53 (53-bit pure-JS hash, см. [`schemas/hash-function.md`](schemas/hash-function.md)) поверх serialized строки.
4. **Format**: hex zero-pad до 14 символов.

**Cross-stack импл'ы MUST соблюдать тот же алгоритм.** Замена hash-функции (например на SHA-256) — отдельный versioning-event самой функции, требующий координации всех stack'ов.

---

## §2. ontology.evolution[]

Онтология **MAY** содержать поле `evolution: OntologyVersion[]` — append-only лог эволюции. Реализация L3-evolution conformant **MUST** парсить этот лог по нормативной схеме.

```jsonc
{
  "entities": { /* ... */ },
  "evolution": [
    { "hash": "h1", "parentHash": null, "timestamp": "2026-01-01T00:00:00Z", "authorId": "alice", "diff": { "addedFields": [], /*...*/ }, "upcasters": [] },
    { "hash": "h2", "parentHash": "h1", "timestamp": "2026-04-15T00:00:00Z", "authorId": "alice", "diff": { /*...*/ }, "upcasters": [ /*...*/ ] }
  ]
}
```

### Инварианты

- `entry.parentHash` **MUST** совпадать с `hash` предыдущего entry (или `null` для root).
- `entry.hash` **MUST** быть уникален в пределах лога.
- `entry.hash` **SHOULD** совпадать с `hashOntology(ontology_at_that_time)` — implementer **MAY** валидировать через independent re-hash.
- Цепочка от root до любой версии **MUST** быть достижима через `parentHash` без циклов.

### Diff shape

`entry.diff: EvolutionDiff` — информационное описание изменений от parent до этой версии. Реализация **MUST** парсить:

```ts
EvolutionDiff = {
  addedFields:    Array<{ entity, field, default? }>,
  removedFields:  Array<{ entity, field }>,
  renamedFields:  Array<{ entity, from, to }>,
  enumChanges:    Array<{ entity, field, mapping: Record<string, string|null> }>,
  splitEntities:  Array<{ from, into[], discriminator }>,
  roleChanges:    Array<{ role, diff }>,
  invariantsAdded:    string[],
  invariantsRemoved:  string[]
}
```

Все массивы **MAY** быть пустыми или отсутствовать (трактуется как пустой).

---

## §3. Upcasters

`entry.upcasters` **MAY** быть пустым (root entry) или содержать массив `Upcaster`-объектов, каждый описывает шаг трансформации `fromHash → toHash`.

```ts
Upcaster = {
  fromHash: string,
  toHash: string,
  declarative?: {
    rename?:             Array<{ entity, from, to }>,
    splitDiscriminator?: Array<{ from, field, mapping }>,
    setDefault?:         Array<{ entity, field, value }>,
    enumMap?:            Array<{ entity, field, mapping }>
  },
  fn?: (effect, world) => Effect | Effect[] | null
}
```

### §3.1 Declarative steps — фиксированный порядок (НОРМАТИВНО)

Реализация **MUST** применять declarative-шаги в строго фиксированном порядке:

1. `rename`
2. `splitDiscriminator`
3. `setDefault` (only for `α === "add"`)
4. `enumMap`

**Изменение порядка = breaking change самого upcast-протокола.** Cross-stack импл'ы, отступившие от порядка, не conformant.

### §3.2 Functional fn — design-time only (НОРМАТИВНО)

`fn` **MUST** быть design-time JS-кодом, написанным человеком (опц. сгенерированным LLM, но **зафиксированным в репо** и протестированным). Реализация **MUST NOT** выполнять runtime-LLM вызовы из `fn`.

**Reviewer обязан отвергнуть PR**, в котором `fn` тянет наружу к LLM API. Это размывает детерминизм формата — главный аргумент против «LLM в рантайме».

### §3.3 fn return values

`fn(effect, world)` **MUST** возвращать одно из:

- `Effect` — single-effect трансформация
- `Effect[]` — split (один эффект в несколько производных)
- `null` — drop эффекта

Реализация **MUST** интерпретировать `null` как drop, `[]` как drop, фильтровать falsy values из массива.

### §3.4 fn-throw safe fallback

Если `fn` бросает исключение, реализация **MUST** trapнуть его и вернуть результат declarative-шагов (если они были) или unchanged effect. Реализация **SHOULD** залогировать warning. Реализация **MUST NOT** rejectнуть эффект из-за fn-throw — Layer 4 detector (§7) поймает дисперсию через reader-equivalence.

### §3.5 Композиция (НОРМАТИВНО)

Реализация **MUST** обеспечивать композициональность:

```
upcast(upcast(Φ, A→B), B→C) ≡ upcast(Φ, A→C)
```

Это даёт implementer'у право кэшировать промежуточные результаты, batch'ить применение цепочки, итд — без изменения semantic'и.

---

## §4. fold(upcast(Φ, target))

Реализация **MUST** предоставлять API эквивалентный `foldWithUpcast(effects, ontology, opts)` со следующей семантикой:

```
fold(upcast(Φ_confirmed, currentSchema)) → world
```

Где:
- `currentSchema` по умолчанию = `getCurrentVersionHash(ontology)` (последний hash в evolution log).
- Caller **MAY** передать `targetHash` override (например, для time-travel reads).
- Если `ontology.evolution[]` пуст или отсутствует — поведение **MUST** совпадать с обычным `fold` (zero behavior change для legacy ontologies).

---

## §5. Reader gap policy (НОРМАТИВНО)

Реализация L3-evolution conformant **MUST** декларировать gap policy для каждого из 4 reader'ов и придерживаться её при обработке legacy data.

### §5.1 Три типа gap

- **`missingField`** — поле отсутствует в данных эффекта.
- **`unknownEnumValue`** — значение не входит в текущий enum (упразднено или переименовано без upcaster'а).
- **`removedEntityRef`** — ref-поле указывает на сущность, которой нет в world.

### §5.2 Шесть стратегий разрешения

| Action | Семантика |
|---|---|
| `hidden` | скрыть в UI, отметить в a11y / debug |
| `omit` | не упоминать вовсе |
| `placeholder` | показать «—» / customizable |
| `passthrough` | показать original value as-is |
| `broken-link` | для refs: показать с отметкой broken |
| `error` | strict mode — surface как ошибку |

### §5.3 Дефолтные policies (НОРМАТИВНО)

Реализация **MUST** использовать следующие дефолты:

```
pixels:   { missingField: hidden,      unknownEnumValue: passthrough, removedEntityRef: broken-link }
voice:    { missingField: omit,        unknownEnumValue: omit,        removedEntityRef: omit }
agent:    { missingField: omit,        unknownEnumValue: passthrough, removedEntityRef: broken-link }
document: { missingField: placeholder, unknownEnumValue: placeholder, removedEntityRef: broken-link }
```

Реализация **MAY** предоставить per-tenant override, но дефолт **MUST** совпадать с этой таблицей.

---

## §6. Reader-equivalence (обновление axiom 5)

Аксиома 5 манифеста v2 §23 формулируется в L3-evolution как:

> **Equivalent information content under the same gap policy.**

То есть: 4 reader'а **MUST** быть согласованы по **gap-presence** (где-то поле missing → у всех или ни у кого), но **action MAY разниться** по policy. Это контракт, не нарушение.

---

## §7. Layer 4 drift detector

Реализация L3-evolution conformant **MUST** предоставлять runtime API эквивалентный `detectReaderEquivalenceDrift(world, ontology, observations)`:

1. Принимает `world`, `ontology`, и массив `ReaderObservation[]`.
2. Вычисляет canonical gap-set по core-логике.
3. Для каждой gap-cell, попадающей в scope ≥ 2 reader'ов, проверяет: либо все reader'ы видят gap, либо никто.
4. Дивергенция → `DriftEvent` в `EquivalenceReport`.

Detector **MUST NOT** сравнивать rendered output (HTML vs SSML vs JSON — incomparable shapes). Detector **MUST NOT** проверять equivalence actions (action может разниться по policy — это контракт).

---

## §8. Conformance проверка

L3-evolution conformance проверяется fixture-векторами в [`fixtures/evolution/`](fixtures/evolution/) (TBD — добавятся в follow-up):

- `evolution/scenarios/<n>/ontology.json` — онтология с evolution log
- `evolution/scenarios/<n>/phi-legacy.json` — legacy Φ с разными `schemaVersion`
- `evolution/expected/world-after-upcast.json` — ожидаемый результат `foldWithUpcast`
- `evolution/expected/gap-set.json` — ожидаемый canonical gap-set
- `evolution/expected/drift-events.json` — ожидаемые DriftEvent'ы при заданных observations

### Pass/fail

Все шаги pass + L1+L2+L3-document → **L3-evolution conformant**.

---

## §9. Cross-references

- Manifest v2.1: глава «Эволюция онтологии» (мотивация, доказательства композициональности)
- [`01-conformance.md`](01-conformance.md) — L1/L2/L3-document conformance
- [`05-materializations/document.md`](05-materializations/document.md) — L3-document, нормирован в v0.2.0
- Reference impl: [`@intent-driven/core@0.107.0+`](https://www.npmjs.com/package/@intent-driven/core), [`@intent-driven/engine@0.4.0+`](https://www.npmjs.com/package/@intent-driven/engine)

---

## §10. История

- **v0.3.0-draft (2026-04-28):** L3-evolution предложена как conformance class. Reference impl shipped в idf-sdk PR #443/#445/#447/#449/#451/#453.
- **v0.4.0+:** fixtures + L3-evolution test runner добавятся как follow-up. Cross-stack импл'ы (idf-go / idf-rust / idf-swift) валидируют hash-compat и declarative-шаги.
