# Conformance

## Классы

Спека v0.1 нормирует **L1** и **L2**. **L3** и **L4** описаны как Reserved; реализация их в v0.1 — out of scope conformance check'а.

### L1 — Minimum (нормировано)

Реализация обязана:

- Парсить ontology согласно [`schemas/ontology.schema.json`](schemas/ontology.schema.json) (entities, fields, roles)
- Парсить intents согласно [`schemas/intent.schema.json`](schemas/intent.schema.json)
- Парсить projections согласно [`schemas/projection.schema.json`](schemas/projection.schema.json)
- Парсить effects согласно [`schemas/effect.schema.json`](schemas/effect.schema.json)
- Парсить Φ как массив confirmed effects (wrapper-схема [`schemas/phi.schema.json`](schemas/phi.schema.json) для fixture-файлов)
- Складывать Φ как append-only лог
- Реализовать `fold(Φ, ontology) → world` согласно [`04-algebra/fold.md`](04-algebra/fold.md)
- Реализовать `filterWorldForRole(world, viewer, ontology) → viewerWorld` согласно [`04-algebra/filter-world.md`](04-algebra/filter-world.md)

L1-conformance проверяется fixture-векторами [`fixtures/library/expected/world/`](fixtures/library/expected/world/) и [`fixtures/library/expected/viewer-world/`](fixtures/library/expected/viewer-world/).

### L2 — Crystallize (нормировано)

L1 плюс:

- Реализовать `crystallize(intents, ontology, projection, viewer, viewerWorld) → artifact` согласно [`04-algebra/crystallize.md`](04-algebra/crystallize.md) (6 фаз; фазы 4–5 — `noop`)
- Поддерживать структуру всех семи архетипов в `assignToSlots` (см. [`03-objects/artifact.md`](03-objects/artifact.md))
- Реализовать `mergeProjections` (фаза 2) для `projection.slots`
- Возвращать artifact согласно [`schemas/artifact.schema.json`](schemas/artifact.schema.json)

L2-conformance проверяется fixture-векторами [`fixtures/library/expected/artifact/`](fixtures/library/expected/artifact/).

### L3 — Four materializations (Reserved для v0.2+)

L2 плюс четыре равноправных читателя artifact'а: pixel, voice, agent API, document. Все используют единый `filterWorldForRole`. v0.1 не нормирует.

### L4 — Full (Reserved для v0.2+)

L3 плюс:

- Pattern Bank `structure.apply` (фаза 5 кристаллизации)
- 5 видов invariant'ов с handler'ами (role-capability, referential, transition, cardinality, aggregate)
- Темпоральный scheduler с системными intents `schedule_timer` / `revoke_timer`
- Irreversibility integrity rule (`__irr` блокирует `α: remove`)
- Семантические `fieldRoles` с нормативным списком значений
- Custom canvas / primitive extension points
- Base-таксономия ролей (`owner | viewer | agent | observer`), `role.scope` для m2m, preapproval guard для agent

## Lightly-tested в v0.1

Implementer SHOULD реализовать всю поверхность L1+L2 (включая lightly-tested элементы), но conformance MUST проверяется только fixture-векторами:

- **Архетипы `feed`, `canvas`, `wizard`** — нормирована минимальная структура слотов в [`03-objects/artifact.md`](03-objects/artifact.md), но не покрыты fixture-вектором на library-домене.
- **Effect `kind: "commit"`** — нормирован в схеме, но не возникает в library-Φ.
- **`entity.kind: "mirror"` и `"assignment"`** — приняты схемой, но в v0.1 трактуются как `internal` для L1+L2.
- **`role.scope` и `role.base`** — приняты схемой как opaque, не используются в `filterWorldForRole` v0.1.

## Процедура self-validation для implementer'а

Independent implementer должен пройти следующие шаги, имея доступ только к содержимому `idf-spec/`:

### Шаг 1: Парсер

Реализовать парсер для пяти схем + wrapper-схема phi. Каждый файл из [`fixtures/library/`](fixtures/library/) MUST валидироваться против соответствующей схемы.

Проверка: `cd idf-spec && ./validate.sh` (использует AJV draft-07 — для авторов спеки; implementer пишет аналог на своём стеке).

### Шаг 2: fold

Для каждого `phi/<scenario>.json` (7 файлов):

1. Применить `fold(phi.effects, ontology) → world`.
2. Сравнить `world` с `expected/world/<scenario>.json` `world`-полем (semantic equality — см. [`00-introduction.md`](00-introduction.md)).

### Шаг 3: filterWorldForRole

Для каждого `(scenario, viewer)` пары (18 пар):

1. Получить world (шаг 2).
2. Применить `filterWorldForRole(world, viewer, ontology) → viewerWorld`.
3. Сравнить с `expected/viewer-world/<scenario>-as-<role>-<viewerId>.json` `viewerWorld`-полем.

### Шаг 4: crystallize

Для каждого `(scenario, projection, viewer)` (8 файлов в `expected/artifact/`):

1. Получить viewerWorld (шаг 3).
2. Применить `crystallize(intents, ontology, projection, viewer, viewerWorld) → artifact`.
3. Сравнить с `expected/artifact/<scenario>-<projection>-as-<role>-<viewerId>.json` (без `_meta`).

### Pass/fail

- Все шаги 1–3 pass → **L1 conformant**.
- Все шаги 1–4 pass → **L2 conformant**.

При несовпадении — implementer проверяет либо свою реализацию, либо приходит с feedback'ом для уточнения спеки (через issue или предложение правки в [`feedback/manifesto-v2.md`](../feedback/manifesto-v2.md) если ambiguity манифеста).

## Cross-references

- [`00-introduction.md`](00-introduction.md) — конвенции и критерии
- [`02-axioms.md`](02-axioms.md) — аксиомы, выходящие за классы
- [`04-algebra/`](04-algebra/) — нормативные алгоритмы
- [`fixtures/library/README.md`](fixtures/library/README.md) — описание эталонного домена
