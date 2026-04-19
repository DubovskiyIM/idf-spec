# Ontology

## Источник

Манифест v2 §8 (entities, roles, invariants, rules, scheduler, fieldRoles). В v0.1 нормированы только §8.1 (entities) и §8.2 без base-таксономии и `role.scope` (roles с `visibleFields` + `canExecute`). Прочие подразделы (§8.3 invariants, §8.4 rules, §8.5 scheduler, §8.6 fieldRoles нормативный список) — Reserved L4.

## Структура (нормативно)

JSON Schema: [`schemas/ontology.schema.json`](../schemas/ontology.schema.json).

Ontology — JSON-объект с двумя обязательными ключами:

- `entities` — типы данных домена
- `roles` — viewer-типы

И двумя зарезервированными:

- `invariants` (Reserved L4, opaque array)
- `rules` (Reserved L4, opaque array)

## Entities

### Структура entity

Каждая entity именуется `PascalCase`-строкой. Имеет `fields` обязательно, `kind` опционально (default `internal`), `ownerField` опционально.

```
ontology.entities.User = {
  kind: "internal",          // optional, default "internal"
  ownerField: "id",          // optional
  fields: { ... }            // required
}
```

### entity.kind

В v0.1 нормированы два значения:

- **`internal`** (default) — обычная сущность; row-filter применяется по `ownerField`. Сущность без `ownerField` и с `kind: "internal"` — privacy by default: невидима ни одной роли (даже если упомянута в `visibleFields` — column-filter без row-filter не пропускает записи).
- **`reference`** — справочная сущность без owner'а; видна всем ролям, у которых она упомянута в `visibleFields`. Используется для доменно-разделяемых каталогов (Book в библиотеке, Country в адресной книге).

Значения `mirror` и `assignment` приняты схемой (для совместимости с будущими версиями), но в v0.1 не нормируются и не участвуют в `filterWorldForRole`. Парсер MUST принимать их без ошибок; реализация SHOULD трактовать `mirror` как `internal` и `assignment` как `internal` для целей L1+L2.

### entity.ownerField

Имя поля сущности, значение которого — id владельца (foreign key). Используется в `filterWorldForRole` приоритет 2 (см. [`04-algebra/filter-world.md`](../04-algebra/filter-world.md)). Для `kind: "reference"` игнорируется. Self-owned сущности (например, `User`) могут иметь `ownerField: "id"` — viewer видит запись, где `record.id === viewer.id`.

### entity.fields

Ключи — `camelCase` имена полей; значения — field descriptors. Каждый field обязан иметь `type`; опционально `values` (для enum), `fieldRole`, `references`, `required`.

Допустимые `type`:

- `string` — Unicode строка
- `number` — JSON number (целое или дробное)
- `boolean` — true/false
- `datetime` — строка формата ISO 8601 (например, `2026-04-19T10:00:00.000Z`)
- `enum` — одно из значений `field.values` (массив строк)

### field.fieldRole

Семантическая роль (`money`, `coordinate`, `percentage`, ...) — advisory hint для читателей формата (материализаций). v0.1 принимает opaque-string без нормативного списка значений. Implementer MAY использовать для специализированного рендера (например, форматирование валюты в pixel-материализации L3); MUST принимать любую строку без отказа парсера.

### field.references

Foreign key — имя другой сущности, на которую ссылается поле. Если задано — значение поля при `create`/`replace` SHOULD быть либо отсутствующим/null либо валидным id целевой сущности. Validation требований (referential integrity) — Reserved L4 (referential invariant); v0.1 принимает поле декларативно без runtime-проверки.

### field.required

Default `false`. Если `true` — `effect.fields[name]` MUST присутствовать при `α: create`. Validator проверяет это при confirm; v0.1 на L1+L2 проверка обязательная.

## Roles

### Структура role

Каждая роль именуется `lower_snake_case` строкой. Имеет два обязательных поля: `visibleFields` и `canExecute`.

```
ontology.roles.reader = {
  visibleFields: { ... },    // required
  canExecute: [ ... ]        // required
}
```

### role.visibleFields

Объект `{EntityName: '*' | [field, ...]}`:

- Сущность, не упомянутая в visibleFields, — невидима роли (даже как пустой namespace в `viewerWorld`).
- Значение `'*'` — все поля сущности видны.
- Массив строк — пересечение: только перечисленные поля.

**Важная нота:** `visibleFields` не достаточно для видимости сущности. Видимость записей определяется row-filter в `filterWorldForRole` (reference > ownerField > none); `visibleFields` определяет column-filter (какие поля внутри видимых записей).

### role.canExecute

Список intent.id, которые роль авторизована инициировать. Может содержать единственный элемент `"*"` — означает «все intent'ы домена». Используется crystallize для фильтрации intent'ов в проекции (footer.actions, toolbar.create, footer.submit).

### role.base

В v0.1 нормировано **частично**: значение `"admin"` имеет нормативную семантику (см. [`04-algebra/filter-world.md`](../04-algebra/filter-world.md) priority 0 — admin-override row-filter). Прочие значения (`owner | viewer | agent | observer`) — accepted как opaque, без поведенческих эффектов на L1+L2.

**Spec-extension:** манифест v2 §8.2 перечисляет четыре базы (`owner | viewer | agent | observer`); `"admin"` — пятое значение, добавленное спецификацией для нормировки admin-pattern (роль видит все записи без owner-проверки). Resolution в манифесте v2.1 — см. [`feedback/manifesto-v2.md`](../../feedback/manifesto-v2.md).

Парсер MUST принимать любую строку в `role.base`. Спека гарантирует поведенческую семантику только для `"admin"`; прочие — Reserved L4 (вместе с preapproval guard для `agent`, observer-invariant и т.д.).

### role.scope

Reserved для v0.2+. Парсер MUST принимать поле как opaque object без интерпретации. v0.1 не использует в `filterWorldForRole` (3-приоритетный фильтр без scope; см. [`04-algebra/filter-world.md`](../04-algebra/filter-world.md)).

## Invariants и rules

Reserved для v0.2+ (см. [`01-conformance.md`](../01-conformance.md)). v0.1 не валидирует содержимое массивов `invariants` и `rules`; они MAY присутствовать в ontology.json без эффекта на L1+L2.

## Cross-references

- [`spec/02-axioms.md`](../02-axioms.md) — аксиома 2 (viewer-scoping)
- [`spec/03-objects/effect.md`](effect.md) — `effect.entity` ссылается на `ontology.entities`
- [`spec/03-objects/intent.md`](intent.md) — `intent.ownerRole` ссылается на `ontology.roles`
- [`spec/04-algebra/filter-world.md`](../04-algebra/filter-world.md) — как `visibleFields` + `ownerField` + `kind` работают вместе

## Open questions

### Q-3: visibleFields требуется для reference-сущностей?

**Манифест говорит:** §14 — «entity.kind:'reference' — справочные сущности видны всем с правильным role.visibleFields, без ownership-проверки».

**Ambiguity:** что значит «правильным» — должна ли entity быть упомянута в visibleFields, или достаточно `kind: "reference"`?

**v0.1 нормативная позиция:** entity MUST быть упомянута в `role.visibleFields` — иначе невидима даже при `kind: "reference"`. visibleFields контролирует cross-section (какие entity вообще видны); kind/ownerField — row-filter (какие записи внутри entity).

**Reserved for resolution in:** манифест v2.1 (явное правило).

### Q-4: Referential consistency самой ontology

**v0.1 нормативная позиция:** validator MUST отклонять ontology, где `role.visibleFields` ссылается на entity, отсутствующую в `entities`. Это referential consistency на уровне самой ontology, не зависит от Reserved L4 invariant'ов мира.

### Q-5: Self-id поле как `ownerField`

**v0.1 нормативная позиция:** разрешено и нормировано. Например, `User.ownerField = "id"` означает «viewer видит запись User, где `record.id === viewer.id`». Это покрывает self-owned semantics («каждый видит только свой User-профиль»).
