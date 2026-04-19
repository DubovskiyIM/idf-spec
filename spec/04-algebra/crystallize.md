# crystallize

## Источник

Манифест v2 §12.

## Сигнатура (нормативно)

```
crystallize(intents, ontology, projection, viewer, viewerWorld) → artifact
```

В v0.1 сигнатура упрощена против манифестной (`crystallize(intents, ontology, projection, patternBank, features) → artifact`) исключением `patternBank` и `features` (Reserved L4). Добавлены `viewer` и `viewerWorld` явно — манифест предполагает их доступными через context, спека делает параметры явными для нормативной ясности.

- **`intents`** — массив всех intent'ов домена (см. [`03-objects/intent.md`](../03-objects/intent.md))
- **`ontology`** — domain ontology (см. [`03-objects/ontology.md`](../03-objects/ontology.md))
- **`projection`** — projection для кристаллизации (см. [`03-objects/projection.md`](../03-objects/projection.md))
- **`viewer`** — `{role: <roleName>, id: <viewerId>}` (для viewer-scoping artifact'а)
- **`viewerWorld`** — output `filterWorldForRole` (нужен для catalog/detail/dashboard слотов с конкретными данными)

Output — artifact (см. [`03-objects/artifact.md`](../03-objects/artifact.md)).

## Аксиома детерминизма (cross-ref аксиома 1)

Один и тот же `(intents, ontology, projection, viewer, viewerWorld)` MUST возвращать identically equal artifact (semantic equality).

См. [`02-axioms.md`](../02-axioms.md) аксиома 1.

## 6 фаз pipeline (нормативно)

### Фаза 1: deriveProjections

Если `projection.archetype === "auto"` — вывести архетип эвристически. Полный decision tree — Reserved L4. В v0.1 нормирована минимальная heuristic, достаточная для покрытия эталонного домена:

1. `projection.archetype !== "auto"` → использовать как есть.
2. `projection.archetype === "auto"` && `projection.intents` все имеют один и тот же `effects[0].kind === "create"` && все имеют одну entity → `form`.
3. `projection.archetype === "auto"` && `projection.entity` задан → `detail`.
4. иначе → fallback `catalog`.

В library все проекции имеют explicit archetype, фаза 1 — no-op.

### Фаза 2: mergeProjections

Если `projection.slots` задано — применить deep-merge поверх slot-результатов фаз 3+: значения из `projection.slots` имеют приоритет над derived-значениями.

**Семантика merge:**
- На уровне slot-ключей (`header`, `body`, `footer`, `toolbar`, ...) — recursive deep-merge.
- На уровне свойств внутри slot-объектов — recursive deep-merge.
- **Массивы заменяются целиком**, не конкатенируются (стандартная JSON-merge семантика). Если authored задаёт `body.fields = ["bookId"]`, derived `body.fields = [{name:"bookId", ...}]` затирается полностью.
- Скалярные значения (string, number, boolean) — заменяются на authored.

Поле `_authored: true` в любом slot-объекте — маркер «зафиксировано автором» для forward-compatibility с фазами 4-5 (Reserved L4). В v0.1 фаз 4-5 нет; mergeProjections применяется на artifact после фазы 3. Маркер `_authored` сохраняется в финальном artifact.

### Фаза 3: assignToSlots

Распределить intents и данные по слотам согласно archetype:

#### catalog

```
slots.header.title          ← projection.entity (или fallback projection.id)
slots.body.items            ← Object.values(viewerWorld[projection.entity]) упорядоченный по id ASC
slots.body.itemDisplay      ← {primary: <первое не-id поле сущности>, secondary: <второе не-id поле>}
slots.footer.actions        ← массив {intentId, label, confirmation} для не-create intent'ов
                              из projection.intents, доступных viewer'у (role.canExecute ∋ intent.id),
                              упорядочен по intent.id ASC
slots.toolbar.create        ← {intentId, label, confirmation} для intent'а из projection.intents,
                              у которого effects[0].kind === "create" и доступен viewer'у;
                              если таких нет — slots.toolbar = {} (без create-ключа)
```

`label` в v0.1 — `intent.id` буквально (без localization).
`confirmation` — см. фазу 6.

#### detail

```
slots.header.title          ← record[primaryField] (см. ниже)
slots.body.fields           ← массив {name, value} для каждого поля сущности из record,
                              упорядоченный согласно ontology.entities[entity].fields key order
slots.footer.actions        ← массив {intentId, label, confirmation} для всех доступных intent'ов
                              проекции, упорядочен по intent.id ASC
```

**Выбор записи для detail:** в v0.1 detail-проекция кристаллизуется в контексте конкретной записи. Implementer L2 SHOULD передавать `recordId` как параметр crystallize (расширение сигнатуры) или — для упрощения fixture'ов — брать первую запись по id ASC из `viewerWorld[entity]`. **В fixtures library используется первая запись по id ASC** (b1 для Book detail).

**primaryField:** первое поле в `ontology.entities[entity].fields`, имя которого не равно `id` и не является foreign key (`references` not set). Для Book — `title`. Для User — `name`. Для Loan — `userId`... wait — userId IS foreign key. Heuristic: первое поле без `id` и без `references` field. Для Loan: `status` (после userId, bookId, которые имеют references).

Конфигурируемый primary — Reserved L4.

#### form

```
slots.header.title          ← projection.id (или intent.id если projection.intents.length === 1)
slots.body.fields           ← массив {name, type, required: true} из intent.requiredFields
                              (intent — projection.intents[0], предполагается единственный для form)
slots.footer.submit         ← {intentId: intent.id, label: intent.id, confirmation}
```

Если `projection.slots.body._authored === true` — значения из `projection.slots.body` mergeProjections'ом перетирают derived; в library borrow-form.slots.body.fields = ["bookId"] (массив имён) override'ит derived.

#### dashboard

```
slots.header.title          ← projection.id
slots.body.sections         ← [] в v0.1 (composition references — Reserved L4; Лучше пустой массив,
                              чем placeholder без определённой семантики)
slots.toolbar.actions       ← массив {intentId, label, confirmation} для intent'ов проекции,
                              доступных viewer'у, упорядочен по intent.id ASC
```

#### feed (нормативно с v0.1.5)

```
slots.body.entries  ← Object.values(viewerWorld[projection.entity]) упорядоченный
                       по первому datetime-полю в Entity.FieldsOrder DESC
                       (если такого поля нет — по id ASC); column-filter как catalog
slots.footer        ← опускается если intents=[] (read-only feed)
slots.toolbar       ← опускается если intents=[]
```

Если `intents.length > 0` — `footer.actions` и `toolbar.create` заполняются как у catalog (см. выше).

#### canvas, wizard (Lightly-tested)

Минимальная нормативная структура слотов (см. [`03-objects/artifact.md`](../03-objects/artifact.md)).
- **canvas**: `slots.body.canvasRef` ← `projection.id` (opaque host hint)
- **wizard**: `slots.body.steps` ← массив `{intentId, label, confirmation, isCommit}` для каждого `projection.intents[i]` в исходном порядке (не sorted), где `isCommit: true` если intent имеет effect с `kind: "commit"`

Heuristic заполнения остальных слотов canvas/wizard в v0.1 не специфицирована — implementer SHOULD использовать analog patterns из catalog/detail/form/dashboard. Conformance проверяется fixture-вектором только для wizard (через events-домен v0.1.5+).

### Read-only проекции (v0.1.4)

Если `projection.intents = []` — проекция read-only. Crystallize MUST производить артефакт без `footer.actions`/`toolbar.create`/`footer.submit` (либо отсутствие ключа, либо пустой массив). Slot-структура определяется только архетипом и `viewerWorld`. Применимо к feed-timeline'ам, dashboards без global actions, audit-views.

### Фаза 4: matchPatterns (no-op в L2)

Pattern Bank — Reserved L4. Implementer L2 MUST вызывать фазу как noop-функцию для сохранения структуры pipeline. Никаких witnesses с `basis: "pattern-bank"` в artifact в v0.1.

### Фаза 5: applyStructuralPatterns (no-op в L2)

Pattern Bank apply — Reserved L4. То же самое; no-op в L2.

### Фаза 6: wrapByConfirmation

Для каждого intent reference в `slots.footer.actions`, `slots.toolbar.create`, `slots.toolbar.actions`, `slots.footer.submit` добавить мета-поле `confirmation`:

- Если `intent.effects[0].kind === "remove"` → `confirmation: "destructive"`
- Иначе → `confirmation: "standard"`

Это минимальная эвристика. Полный control-archetype mapping манифеста §16 (composerEntry, formModal, confirmDialog, clickForm, customCapture, ...) — Reserved L4.

## Финальная форма artifact

`artifact = { projectionId, archetype, viewer (имя роли), slots }` — без `witnesses` (Reserved L4), без `shape` (Reserved L4), без `patternAnnotations` (Reserved L4).

## Cross-references

- [`spec/02-axioms.md`](../02-axioms.md) — аксиома 1 (детерминизм)
- [`spec/03-objects/projection.md`](../03-objects/projection.md) — input
- [`spec/03-objects/artifact.md`](../03-objects/artifact.md) — output
- [`spec/fixtures/library/expected/artifact/*.json`](../fixtures/library/expected/artifact/) — expected output

## Open questions

### Q-20: deriveProjections heuristic полнота

**v0.1 нормативная позиция:** минимальная heuristic покрывает library; для произвольных доменов SHOULD задавать explicit `archetype`.

**Reserved for resolution in:** v0.2+.

### Q-21: dashboard composition

**v0.1 нормативная позиция:** `dashboard.body.sections` — пустой массив или массив `{projectionId}` references. Embedding sub-artifact'ов inline — Reserved L4.

### Q-22: control-archetype mapping

**v0.1 нормативная позиция:** `wrapByConfirmation` использует упрощённую destructive/standard эвристику. Полная таблица из манифеста §16 — Reserved L4.

### Q-23: detail recordId как параметр crystallize

**v0.1 нормативная позиция:** для упрощения fixture'ов — первая запись по id ASC из `viewerWorld[projection.entity]`. Implementer SHOULD расширять сигнатуру (передавать `recordId`) для production.

**Reserved for resolution in:** v0.2+ (нормативное расширение сигнатуры).

### Q-24: primaryField для detail/itemDisplay

**v0.1 нормативная позиция:** первое поле в `ontology.entities[entity].fields` (по key order JSON-объекта), не равное `id` и без `references`. Конфигурируемый primary — Reserved L4.
