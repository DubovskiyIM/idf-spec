# Artifact

## Источник

Манифест v2 §10.

## Назначение

Artifact — output `crystallize`. **Тип данных**, не результат рендеринга. Один artifact читается разными материализациями (pixel, voice, agent API, document). В v0.1 материализации Reserved L3 — artifact определяется как тип, без нормативных читателей.

Artifact viewer-специфичен: для одной проекции и разных ролей кристаллизация даёт разные artifact'ы. Это структурное свойство формата (см. аксиома 2 в [`02-axioms.md`](../02-axioms.md)).

## Структура (нормативно)

JSON Schema: [`schemas/artifact.schema.json`](../schemas/artifact.schema.json).

| Поле                 | Тип    | Обязательно | Описание |
|----------------------|--------|-------------|----------|
| `projectionId`       | string | MUST | ID исходной проекции. |
| `archetype`          | enum   | MUST | Финальный архетип (не `auto`). |
| `viewer`             | string | MUST | Имя роли, для которой кристаллизован. |
| `slots`              | object | MUST | Именованные контейнеры содержимого. |
| `witnesses`          | array  | MAY  | Reserved L4. |
| `shape`              | string | MAY  | Reserved L4. |
| `patternAnnotations` | array  | MAY  | Reserved L4. |

## Слоты по архетипам (нормативно)

Минимальный набор слотов и их назначение для каждого из семи архетипов. Полное правило заполнения слотов — в [`04-algebra/crystallize.md`](../04-algebra/crystallize.md) фаза 3.

### catalog

| Слот | Содержимое |
|------|-----------|
| `slots.header.title` | Имя коллекции (`projection.entity` или fallback `projection.id`). |
| `slots.body.items` | Массив записей entity (упорядочен по `id` ASC). |
| `slots.body.itemDisplay` | `{primary: <fieldName>, secondary: <fieldName>}` — heuristic-выбор первичного и вторичного отображаемого поля. |
| `slots.footer.actions` | Массив `{intentId, label, confirmation}` для не-create intent'ов проекции, доступных viewer'у. |
| `slots.toolbar.create` | Опциональный `{intentId, label, confirmation}` для intent'а с `effects[0].kind === "create"` (если есть в проекции и доступен viewer'у). |

### detail

| Слот | Содержимое |
|------|-----------|
| `slots.header.title` | `record[primaryField]` (значение primary поля сущности; см. crystallize фаза 3). |
| `slots.body.fields` | Массив `{name, value}` для каждого видимого поля сущности. |
| `slots.footer.actions` | Массив `{intentId, label, confirmation}` доступных intent'ов. |

### form

| Слот | Содержимое |
|------|-----------|
| `slots.header.title` | `intent.id` или `projection.id`. |
| `slots.body.fields` | Массив `{name, type, required}` из `intent.requiredFields`. |
| `slots.footer.submit` | `{intentId, label, confirmation}` подтверждающего intent'а. |

### dashboard

| Слот | Содержимое |
|------|-----------|
| `slots.header.title` | `projection.id`. |
| `slots.body.sections` | Массив `{projectionId}` references на другие проекции (композиция sub-artifact'ов — Reserved L4; в v0.1 sections — пустой массив или explicit references). |
| `slots.toolbar.actions` | Массив `{intentId, label, confirmation}` глобальных действий. |

### feed, canvas, wizard (Lightly-tested)

Минимальная нормативная структура:

- **feed**: `slots.body.entries` — массив записей (структура entries — opaque в v0.1).
- **canvas**: `slots.body.canvasRef` — opaque reference на host-rendered canvas (string).
- **wizard**: `slots.body.steps` — массив step-описаний (структура — opaque в v0.1).

Implementer MUST поддерживать минимальную структуру в crystallize; conformance проверяется только fixture-векторами для catalog/detail/form/dashboard.

## Composition (Reserved L4)

Embedding sub-artifact'ов inline в `dashboard.body.sections` — Reserved L4. v0.1 нормирует только references по `projectionId`. Host реализации вправе делать второй проход кристаллизации для получения sub-artifact'ов; формат это не предписывает в v0.1.

## Cross-references

- [`spec/02-axioms.md`](../02-axioms.md) — аксиома 1 (детерминизм), аксиома 2 (viewer-scoping)
- [`spec/03-objects/projection.md`](projection.md) — projection — input crystallize
- [`spec/04-algebra/crystallize.md`](../04-algebra/crystallize.md) — алгоритм формирования artifact

## Open questions

### Q-11: Embedded vs reference в dashboard.body.sections

**v0.1 нормативная позиция:** sections — массив `{projectionId}` references. Embedding (полные artifact-объекты как inline-вложение) — Reserved L4.

**Reserved for resolution in:** v0.2+.

### Q-12: Primary field для detail

**v0.1 нормативная позиция:** primary field выбирается heuristic'ом (см. crystallize фаза 3): первое поле в `ontology.entities[entity].fields`, не помеченное как `id`/foreign key. Конфигурируемый primary — Reserved L4.

### Q-13: itemDisplay heuristic для catalog

**v0.1 нормативная позиция:** primary = первое не-id поле; secondary = второе не-id поле (или null). Конфигурация — Reserved L4.
