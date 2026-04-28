# Projection

## Источник

Манифест v2 §9.

## Назначение

Projection — декларация автора о том, какие intent'ы и сущности образуют один «экран», «диалог», «страницу». Это **input** для `crystallize`; artifact — **output**.

Автор влияет на crystallize-результат двумя ортогональными механизмами:

- **Preference** (input modifier): `projection.patterns` — модифицирует вход кристаллизации. Артефакт остаётся чистой функцией входа: `(intents, ontology, projection + preference, patternBank, features) → artifact`. **Reserved L4** в v0.1.
- **Slot-override** (output freeze): `projection.slots` — авторская фиксация конкретных слотов. Применяется в crystallize фазе 2 (`mergeProjections`), bypass'я последующие фазы для override'нутых слотов. **Нормативно в v0.1.**

## Структура (нормативно)

JSON Schema: [`schemas/projection.schema.json`](../schemas/projection.schema.json).

| Поле        | Тип    | Обязательно | Описание |
|-------------|--------|-------------|----------|
| `id`        | string | MUST        | Стабильный ID, `kebab-case`. |
| `archetype` | enum   | SHOULD      | Один из семи + `auto`. Default `auto`. |
| `intents`   | array  | MUST        | Список `intent.id`. **Может быть пустым** для read-only проекций (например, feed-timeline без actions). v0.1.4 снял ограничение minItems=1.|
| `entity`    | string | MAY         | Основная сущность (для catalog/detail/form). |
| `slots`     | object | MAY         | Slot-override (см. ниже). |
| `patterns`  | object | MAY         | Reserved L4. |

## Семь архетипов

Архетип — структурный «скелет» артефакта: какие слоты есть, как они организованы. Перпендикулярно архетипу формат вводит behavioral patterns (`monitoring`, `triage`, `execution`, `exploration`, `configuration`) — **Reserved L4** в v0.1.

- **`feed`** — лента новейших; временно-упорядоченные элементы. Слоты: `body.entries`. *Lightly-tested в v0.1.*
- **`catalog`** — обзор коллекции с навигацией; equal-rank items. Слоты: `header`, `body.items`, `footer.actions`, `toolbar.create`.
- **`detail`** — фокус на одну сущность с её полями и доступными действиями. Слоты: `header`, `body.fields`, `footer.actions`.
- **`form`** — заполнение полей для confirm одного intent. Слоты: `header`, `body.fields`, `footer.submit`.
- **`canvas`** — host-rendered область (charts, maps, custom UI). Слоты: `body.canvasRef`. *Lightly-tested в v0.1.*
- **`dashboard`** — композиция references на другие проекции + global actions. Слоты: `header`, `body.sections`, `toolbar.actions`.
- **`wizard`** — multi-step process с явным commit на финальном шаге. Слоты: `body.steps`. *Lightly-tested в v0.1.*

В v0.1 fixture-вектором покрыты `catalog`, `detail`, `form`, `dashboard`. Архетипы `feed`, `canvas`, `wizard` нормированы (структура слотов определена в [`artifact.md`](artifact.md) и [`04-algebra/crystallize.md`](../04-algebra/crystallize.md)), но Lightly-tested — implementer MUST поддерживать их в crystallize, но conformance проверяется только по покрытым архетипам.

## archetype: 'auto'

Если автор не уверен в выборе архетипа — `archetype: "auto"` запускает фазу 1 кристаллизации (`deriveProjections`), которая выводит архетип эвристически из `projection.intents` + `projection.entity`. Полный decision tree — Reserved L4; в v0.1 нормирована минимальная heuristic, достаточная для покрытия эталонного домена (см. [`04-algebra/crystallize.md`](../04-algebra/crystallize.md) фаза 1).

Рекомендация: для предсказуемости результата SHOULD задавать `archetype` явно, особенно в production.

## Slot-override (нормативно в v0.1)

`projection.slots` — объект, повторяющий структуру `artifact.slots`. Когда задан, `crystallize` фаза 2 (`mergeProjections`) выполняет deep-merge: значения из `projection.slots` имеют приоритет над derived-значениями фаз 3+.

Маркер `_authored: true` в любом slot-объекте — сигнал «этот слот зафиксирован автором, не trogать в последующих фазах». В v0.1 фаз 4-5 нет (Reserved L4), так что маркер информативен, но реализация SHOULD его уважать для forward-compatibility.

**Слом инварианта `artifact = f(input)`:** slot-override — output freeze. Артефакт после mergeProjections для override'нутых слотов больше не является чистой функцией от `(intents, ontology, projection_без_override)` — он зависит от authored snapshot. Это сознательный escape hatch формата; preference-механизм (Reserved L4) — предпочтительный путь, сохраняющий инвариант.

## Cross-references

- [`spec/03-objects/intent.md`](intent.md) — `projection.intents` ссылается на `intent.id`
- [`spec/03-objects/artifact.md`](artifact.md) — output crystallize
- [`spec/04-algebra/crystallize.md`](../04-algebra/crystallize.md) — projection как input

## Open questions

### Q-9: Как deriveProjections выводит архетип

**v0.1 нормативная позиция:** минимальная heuristic, описана в [`04-algebra/crystallize.md`](../04-algebra/crystallize.md) фаза 1. Покрывает library; для произвольных доменов SHOULD задавать `archetype` explicit.

**Reserved for resolution in:** v0.2+ (полная decision tree).

### Q-10: Author preference (`projection.patterns`)

**Манифест говорит:** §9, §13 — `projection.patterns: { enabled: [...], disabled: [...] }` как input modifier для Pattern Bank.

**v0.1 нормативная позиция:** Reserved L4 (зависит от Pattern Bank). Парсер MUST принимать поле как opaque object; crystallize MUST игнорировать.

**Reserved for resolution in:** v0.2+.
