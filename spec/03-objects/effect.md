# Effect

## Источник

Манифест v2 §7 (`source/manifesto-v2.snapshot.md`).

## Назначение

Эффект — атом изменения мира. Все изменения мира в IDF происходят через confirmed effects, складываемые в append-only лог Φ. Мир не редактируется in-place; он перевычисляется через `fold(Φ, ontology) → world` (см. [`04-algebra/fold.md`](../04-algebra/fold.md)).

## Структура (нормативно)

JSON Schema: [`schemas/effect.schema.json`](../schemas/effect.schema.json).

| Поле      | Тип    | Обязательно | Описание |
|-----------|--------|-------------|----------|
| `kind`    | enum   | MUST        | Вид изменения: один из `create`, `replace`, `remove`, `transition`, `commit`. Соответствует символу α в манифесте §7. |
| `entity`  | string | MUST        | Имя сущности из `ontology.entities`. |
| `fields`  | object | SHOULD      | Полезная нагрузка эффекта; для `remove` минимум `{id: ...}`. |
| `context` | object | MUST        | Метаданные. v0.1 нормирует обязательное поле `context.at` (ISO 8601 timestamp). Остальные поля opaque. |

### Почему `kind` вместо `α`

Манифест использует греческую букву α; в JSON это либо `"alpha"`, либо `"a"`, либо имя по существу. Нормативно выбрано `"kind"`: ASCII, читаемо, согласуется с `entity.kind` в онтологии. Греческая буква α в манифесте остаётся как референс на математическую традицию; в формате — `kind`.

### Пять видов изменения

- **`create`** — добавить новую сущность. `fields` MUST содержать `id` целевой сущности и обязательные поля согласно `ontology.entities[entity].fields`. Если сущность с этим `id` уже существует — fold MUST поднять ошибку (см. [`04-algebra/fold.md`](../04-algebra/fold.md)).
  Пример: `{kind: "create", entity: "Book", fields: {id: "b1", title: "...", author: "..."}}`.

- **`replace`** — заменить поля существующей сущности. `fields` MUST содержать `id`; остальные поля shallow-merge'атся в существующую запись. Если сущности с этим `id` нет — fold MUST поднять ошибку.
  Пример: `{kind: "replace", entity: "Book", fields: {id: "b1", author: "новый автор"}}`.

- **`remove`** — удалить сущность. `fields` MUST содержать минимум `id`. Если сущности нет — fold no-op (см. Q-1).
  Пример: `{kind: "remove", entity: "Book", fields: {id: "b1"}}`.

- **`transition`** — изменить состояние workflow (state machine). В v0.1 на L1+L2 `transition` структурно эквивалентен `replace` (shallow-merge `fields`). Различие проявится в L4 — invariant'ы вида `transition` будут проверять допустимость state-перехода.
  Пример: `{kind: "transition", entity: "Loan", fields: {id: "l1", status: "returned", returnedAt: "..."}}`.

- **`commit`** — зафиксировать завершение сложной частицы (wizard, batch). На L1+L2 — no-op в fold (`commit` не модифицирует мир; используется как маркер конца workflow для L4). Lightly-tested в v0.1: implementer SHOULD поддерживать `commit` в парсере; fixture-вектор не покрывает.

## Lifecycle

`proposed → { confirmed | rejected }`

Эффект сначала имеет статус `proposed` — он находится в Δ (черновики, session-scoped). Validator проверяет инварианты и условия намерения; на успехе → `confirmed`, попадает в Φ; на провале → `rejected`, не попадает в Φ, но MAY сохраняться в отдельной зоне для audit'а. Δ session-scoped: исчезает при cancel или истечении сессии.

В v0.1 нормируется только статус `confirmed` (то есть Φ — массив confirmed effects). Δ-storage и rejected-зона — host-level concerns, информативно. Implementer L1+L2 MUST принимать Φ как массив confirmed effects; обработка Δ — out of scope conformance check'а v0.1.

## Упорядочивание Φ

Φ упорядочена по `context.at` (timestamp confirm'а) ASC. Если два эффекта имеют одинаковый `at` (теоретически возможно при batch-confirm), tie-breaker — позиция в массиве: первый в массиве считается более ранним. Это нормирует ordering для детерминизма fold (см. [`04-algebra/fold.md`](../04-algebra/fold.md)).

## Validation

Validator MUST проверить эффект на:
- Валидность `kind` (один из пяти enum-значений)
- Валидность `entity` (entity существует в ontology.entities)
- Валидность `context.at` (ISO 8601 date-time)

Дополнительные проверки — Reserved L4:
- 5 видов invariant'ов (role-capability, referential, transition, cardinality, aggregate)
- Irreversibility integrity rule (`__irr` блокирует `α: remove`)

## Cross-references

- [`spec/02-axioms.md`](../02-axioms.md) — аксиома 4 (audit trail через Φ)
- [`spec/03-objects/intent.md`](intent.md) — intents эмитят эффекты при подтверждении
- [`spec/03-objects/ontology.md`](ontology.md) — `entity.fields` определяет допустимый shape `effect.fields`
- [`spec/04-algebra/fold.md`](../04-algebra/fold.md) — как `fold(Φ)` применяет эффекты

## Open questions

### Q-1: Tie-breaker при одинаковых timestamps

**Манифест говорит:** §11 — «эффекты в Φ упорядочены по времени, и fold применяет их строго в этом порядке».

**Ambiguity:** что делать, если два эффекта имеют идентичный `context.at`?

**v0.1 нормативная позиция:** порядок определяется позицией в массиве Φ — первый в массиве считается более ранним. Implementer MUST сохранять стабильный порядок при сериализации/десериализации Φ.

**Reserved for resolution in:** манифест v2.1 (явное правило ordering или требование sub-millisecond timestamps).

### Q-2: `__irr` shape

**Манифест говорит:** §7 — `__irr: { point, at, reason }`.

**Ambiguity:** v0.1 не нормирует `__irr` (Reserved L4 — irreversibility integrity rule).

**v0.1 нормативная позиция:** поле зарезервировано как opaque object; парсер MUST принимать его без ошибок, но не обязан интерпретировать.

**Reserved for resolution in:** v0.2+ (integrity-правило для irreversibility).

### Q-X: `α: remove` на отсутствующей сущности

**v0.1 нормативная позиция:** fold no-op (без ошибки). Это позволяет идемпотентность remove-эффектов. См. [`04-algebra/fold.md`](../04-algebra/fold.md).

**Reserved for resolution in:** v0.2+ (если invariant'ы потребуют strict semantics).
