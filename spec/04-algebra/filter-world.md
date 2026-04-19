# filterWorldForRole

## Источник

Манифест v2 §14.

## Сигнатура (нормативно)

```
filterWorldForRole(world, viewer, ontology) → viewerWorld
```

- **`world`** — output `fold(Φ, ontology)` (см. [`04-algebra/fold.md`](fold.md)).
- **`viewer`** — `{role: <roleName>, id: <viewerId>}`. `id` — id viewer-сущности (используется row-filter по `ownerField`).
- **`ontology`** — определяет правила scoping (`entity.kind`, `ownerField`, `role.visibleFields`).
- **`viewerWorld`** — `{EntityName: {entityId: entityRecord, ...}}`, тот же тип что world. Содержит только видимые сущности с видимыми полями.

## Аксиома viewer-scoping (cross-ref аксиома 2)

`viewerWorld` — **тип данных** для конкретного viewer'а, не post-фильтр render'а. Любая материализация (в v0.1 — только artifact-генерация через crystallize; L3+ материализации — Reserved) MUST читать `viewerWorld`, не `world`.

См. [`02-axioms.md`](../02-axioms.md) аксиома 2.

## Row-filter (3-приоритетный, нормативно)

Для каждой entity `E` из `ontology.entities`:

### Приоритет 1: visibleFields gate

Если `E` **не упомянута** в `viewer.role.visibleFields` — `viewerWorld[E]` отсутствует целиком (даже как пустой namespace). Это column-уровневая видимость на уровне entity.

### Приоритет 2: kind === 'reference'

Если `E.kind === "reference"` — все записи `world[E]` видны (без owner-проверки). Применить column-filter (см. ниже).

### Приоритет 3: ownerField

Если `E.ownerField` задан — видны записи, где `record[E.ownerField] === viewer.id`. Применить column-filter.

### Приоритет 4: none (privacy by default)

Иначе — entity видна структурно (как пустой namespace `viewerWorld[E] = {}`), но row-filter не пропускает ни одну запись.

### Reserved L4: role.scope

Манифест §14 описывает четвёртый приоритет 0 — `role.scope` для m2m через assignment-bridge. **В v0.1 Reserved**: row-filter — 3-приоритетный (без scope). См. Open question Q-17.

## Column-filter

Для каждой видимой записи (после row-filter):

- Если `viewer.role.visibleFields[E] === "*"` — все поля сохраняются.
- Если `viewer.role.visibleFields[E]` — массив строк — оставить только перечисленные поля.

### Self-id поле

Поле `id` (или поле, помеченное как `ownerField` для self-owned сущностей) SHOULD всегда оставаться видимым, даже если оно не перечислено в `visibleFields[E]`. Иначе viewerWorld становится ambiguous-keyed (ключ `viewerWorld[E][entityId]` есть, но `record.id` отсутствует). Это implementer-рекомендация; формально в v0.1 не enforce'ится.

В fixture-векторах library `visibleFields["User"] = ["id", "name"]` для reader — `id` явно перечислен.

## Алгоритм (нормативно, ссылка)

```
viewerWorld = {}
for each entityName in ontology.entities:
  if entityName not in viewer.role.visibleFields:
    continue                              // priority 1
  E = ontology.entities[entityName]
  fieldsAllowed = viewer.role.visibleFields[entityName]   // "*" или array
  candidates = world[entityName]
  filtered = {}
  if E.kind == "reference":               // priority 2
    for each (id, record) in candidates:
      filtered[id] = projectFields(record, fieldsAllowed)
  else if E.ownerField defined:           // priority 3
    for each (id, record) in candidates:
      if record[E.ownerField] == viewer.id:
        filtered[id] = projectFields(record, fieldsAllowed)
  // priority 4 (none) — filtered остаётся пустым
  viewerWorld[entityName] = filtered
return viewerWorld
```

`projectFields(record, allowed)`: если `allowed === "*"` — вернуть копию record; иначе — оставить только ключи из `allowed`.

## Cross-references

- [`spec/02-axioms.md`](../02-axioms.md) — аксиома 2 (viewer-scoping)
- [`spec/03-objects/ontology.md`](../03-objects/ontology.md) — `entity.kind`, `ownerField`, `visibleFields`
- [`spec/fixtures/library/expected/viewer-world/*.json`](../fixtures/library/expected/viewer-world/) — expected viewerWorld для каждого (сценарий, viewer)

## Open questions

### Q-17: role.scope (m2m через assignment-bridge)

**Манифест говорит:** §14 — приоритет 0: «`role.scope` — m2m через bridge-сущность».

**v0.1 нормативная позиция:** Reserved L4. Row-filter — 3-приоритетный (без scope). Парсер MUST принимать `role.scope` как opaque object; `filterWorldForRole` MUST игнорировать.

**Reserved for resolution in:** v0.2+ (вместе с base-таксономией ролей).

### Q-18: Self-id поле в visibleFields

**v0.1 нормативная позиция:** SHOULD всегда оставаться видимым. Не enforce'ится в v0.1; implementer выбирает рекомендацию.

**Reserved for resolution in:** v0.2+ (вероятно, MUST через invariant).

### Q-19: Mutation-safety

**v0.1 нормативная позиция:** `filterWorldForRole` MUST возвращать **новый** viewerWorld объект; не мутировать входной `world`. `record`-уровневые объекты в viewerWorld SHOULD быть копиями (deep clone не обязателен; shallow copy allowed для performance — implementer гарантирует, что write на viewerWorld[E][id] не затрагивает world[E][id]).
