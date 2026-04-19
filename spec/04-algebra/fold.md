# fold

## Источник

Манифест v2 §11.

## Сигнатура (нормативно)

```
fold(Φ, ontology) → world
```

- **`Φ`** — массив confirmed эффектов (см. [`03-objects/effect.md`](../03-objects/effect.md)), упорядоченный по `effect.context.at` ASC; tie-breaker — позиция в массиве.
- **`ontology`** — ontology-объект (см. [`03-objects/ontology.md`](../03-objects/ontology.md)). Используется для инициализации пустых namespace'ов entity.
- **`world`** — JSON-объект `{EntityName: {entityId: entityRecord, ...}, ...}`. Каждая entity из `ontology.entities` присутствует как ключ верхнего уровня (даже пустая).

## Аксиома детерминизма

`fold` — чистая функция. Один и тот же `(Φ, ontology)` MUST возвращать identically equal world (semantic equality: deep-equal с игнорированием порядка ключей объектов; для массивов — порядок MUST совпадать).

См. аксиому 1 в [`02-axioms.md`](../02-axioms.md).

## Алгоритм (нормативно)

1. Инициализировать `world = {}`.
2. Для каждого `entityName` из `ontology.entities`: `world[entityName] = {}`. Это даёт стабильный набор ключей верхнего уровня в `world`.
3. Отсортировать `Φ` по `effect.context.at` ASC; для эффектов с одинаковым `at` — сохранить относительный порядок входного массива (stable sort).
4. Для каждого `effect` в отсортированном Φ:
   - Применить `effect` к `world` согласно `effect.kind`:

### `kind: "create"`

`world[effect.entity][effect.fields.id] = effect.fields`

- `effect.fields.id` MUST присутствовать (требование на L1+L2).
- Если `world[effect.entity][effect.fields.id]` уже существует — fold MUST поднять ошибку (нарушение «create on existing»). Это единственная встроенная invariant-проверка L1 (5 видов invariant'ов — Reserved L4).

### `kind: "replace"`

`world[effect.entity][effect.fields.id] = {...world[effect.entity][effect.fields.id], ...effect.fields}`

- `effect.fields.id` MUST присутствовать.
- Если `world[effect.entity][effect.fields.id]` отсутствует — fold MUST поднять ошибку («replace on missing»).
- Shallow-merge: поля, отсутствующие в `effect.fields`, остаются прежними.

### `kind: "remove"`

Удалить `world[effect.entity][effect.fields.id]`.

- `effect.fields.id` MUST присутствовать.
- Если `world[effect.entity][effect.fields.id]` отсутствует — no-op (без ошибки). Это позволяет идемпотентность remove-эффектов.

### `kind: "transition"`

`world[effect.entity][effect.fields.id] = {...world[effect.entity][effect.fields.id], ...effect.fields}`

- На L1+L2 структурно эквивалентен `replace` (shallow-merge).
- Различие в L4: invariant'ы вида `transition` будут проверять допустимость state-перехода (Reserved).
- Если `world[effect.entity][effect.fields.id]` отсутствует — fold MUST поднять ошибку.

### `kind: "commit"`

No-op в v0.1 (мир не модифицируется). `commit` — маркер конца workflow для L4 (wizard-архетип); используется при composition с темпоральным scheduler'ом и Pattern Bank.

5. Вернуть `world`.

## Производные функции

Манифест §11 упоминает производные:

- `foldFiltered(Φ, predicate)` — пересчёт мира только по релевантным эффектам (для оптимизации больших журналов)
- `foldView(Φ, viewer, ontology)` — композиция fold и viewer-scoping, эквивалентна `filterWorldForRole(fold(Φ, ontology), viewer, ontology)`

В v0.1 определены информативно (см. cross-references); реализация L1 не обязана их предоставлять отдельно. `foldView` достижим композицией fold и filterWorldForRole.

## Cross-references

- [`spec/02-axioms.md`](../02-axioms.md) — аксиома 1 (детерминизм fold), аксиома 4 (audit trail через Φ)
- [`spec/04-algebra/filter-world.md`](filter-world.md) — `filterWorldForRole(world, viewer, ontology)` композируется поверх fold
- [`spec/fixtures/library/expected/world/*.json`](../fixtures/library/expected/world/) — expected output на каждом Φ-сценарии

## Open questions

### Q-14: Tie-breaker при одинаковых timestamps

См. Q-1 в [`spec/03-objects/effect.md`](../03-objects/effect.md). v0.1 нормативная позиция: stable sort по позиции во входном массиве.

### Q-15: Idempotency remove

**v0.1 нормативная позиция:** `α: remove` на отсутствующей сущности — no-op (без ошибки). Это нарушает симметрию с create-on-existing (ошибка) и replace-on-missing (ошибка), но соответствует ментальной модели «удалить отсутствующее — то же что удалить дважды».

**Reserved for resolution in:** v0.2+ (если invariant'ы потребуют strict semantics).

### Q-16: Создание namespace'ов для отсутствующих entities

**v0.1 нормативная позиция:** `world` MUST содержать все ключи `ontology.entities` как top-level keys, даже если соответствующих эффектов в Φ нет. Это даёт implementer'у предсказуемую структуру world (не нужно проверять существование ключа перед итерацией).
