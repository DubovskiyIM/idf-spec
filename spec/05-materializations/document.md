# Document materialization (нормативно с v0.2.0)

## Источник

Манифест v2 §18.

## Назначение

Document materialization превращает projection в structured document-граф — статический pre-rendered артефакт для чтения, печати, индексации, экспорта.

Document — четвёртая равноправная материализация наряду с pixel/voice/agent API. Все читают один artifact + viewerWorld через единый `filterWorldForRole`.

## Сигнатура (нормативно)

```
materializeAsDocument(artifact, viewerWorld, ontology) → DocumentGraph
```

- **`artifact`** — output `crystallize` (см. [`03-objects/artifact.md`](../03-objects/artifact.md))
- **`viewerWorld`** — output `filterWorldForRole` (для catalog/feed body.items, detail body.fields)
- **`ontology`** — для типизации полей (badges на enum-полях, форматирование datetime)
- **`DocumentGraph`** — JSON-объект с фиксированной структурой (см. ниже)

## Структура DocumentGraph (нормативно)

```json
{
  "_meta": { "specVersion": "...", "manifestSha256": "..." },
  "kind": "document",
  "projectionId": "<projection.id>",
  "archetype": "<artifact.archetype>",
  "viewer": "<artifact.viewer>",
  "title": "<document title>",
  "sections": [Section, ...]
}
```

### Section

```json
{
  "kind": "header" | "table" | "fields" | "actions" | "steps",
  "title": "<optional>",
  "content": [...]   // shape зависит от kind
}
```

### content per section.kind

| `kind` | `content` | Когда |
|---|---|---|
| `header` | `{title: string}` | первая секция, повторяет document.title |
| `table` | `{columns: [string], rows: [[scalar]]}` | catalog/feed (table из items) |
| `fields` | `[{name, value, type?, badge?}]` | detail body.fields |
| `actions` | `[{intentId, label, confirmation, badge?}]` | footer.actions / toolbar.create / toolbar.actions |
| `steps` | `[{intentId, label, isCommit, badge?}]` | wizard body.steps |

## Правила формирования (нормативно)

### document.title

- catalog: `"<entity> catalog"` (capitalize entity)
- detail: `<header.title>` (primary field value)
- form: `<header.title>` (intent.id или projection.id)
- dashboard: `<header.title>` (projection.id)
- feed: `"<entity> feed"`
- wizard: `"<header.title>"` (или projection.id если нет)
- canvas: `"<header.title>"` (или projection.id)

### sections порядок

1. `header` (всегда первая) — `{kind: "header", content: {title: document.title}}`
2. Per archetype:
   - **catalog**: `header` → `table` (items как таблица) → `actions` (footer.actions если non-empty) → `actions` (toolbar.create как single-element actions если есть, label = `"+ <intentId>"`)
   - **detail**: `header` → `fields` (body.fields) → `actions` (footer.actions если non-empty)
   - **form**: `header` → `fields` (body.fields со spec, type from required) → `actions` (footer.submit как single-element actions, label = `"submit: <intentId>"`)
   - **dashboard**: `header` → `actions` (toolbar.actions если non-empty)
   - **feed**: `header` → `table` (entries как таблица)
   - **wizard**: `header` → `steps` (body.steps с isCommit badges)
   - **canvas**: `header` → `fields` (single-element: name="canvasRef", value=projection.id)

### badges (опционально, semantic)

Badges — маркеры status/role/irreversibility. В v0.2.0:
- На action с `confirmation == "destructive"`: `{badge: "destructive"}`
- На step с `isCommit == true`: `{badge: "commit"}`
- На enum field в detail: `{badge: <field-value>}` (например, `"draft"`, `"active"`)

## Aксиома viewer-scoping (cross-ref аксиома 2)

`materializeAsDocument` MUST читать `viewerWorld` и `artifact.viewer`, не raw `world`. Документ viewer-специфичен — два viewer'а для одной projection дают разные documents.

## Table формирование (для catalog/feed)

`columns` — `[primaryField, secondaryField]` если оба определены и доступны; иначе `[primaryField]` если только primary; иначе `["id"]`.

`rows` — для каждого item в `body.items` (catalog) или `body.entries` (feed): `[[item[col1], item[col2], ...]]`. Скалярные values; если поле отсутствует — пустая строка `""`.

## Cross-references

- [`spec/02-axioms.md`](../02-axioms.md) — аксиома 2 (viewer-scoping)
- [`spec/03-objects/artifact.md`](../03-objects/artifact.md) — input
- [`spec/01-conformance.md`](../01-conformance.md) — L3 conformance class

## Open questions

### Q-28: HTML rendering

**v0.2.0 нормативная позиция:** DocumentGraph — JSON-структура; HTML-рендеринг (если нужен) — отдельный реалзитор-выбор. Спека нормирует только графовый output. Implementer MAY предоставить HTML wrapper as convenience.

### Q-29: Composite badges

**v0.2.0:** одна badge на element. Multiple badges (например field is destructive AND commit) — Reserved для v0.3+.
