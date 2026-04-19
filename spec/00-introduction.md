# Введение

## Статус

`spec-v0.1` — нормативная спецификация формата IDF, conformance classes **L1** и **L2**. Версия 0.1 покрывает минимум, достаточный для парсинга онтологии, фолдинга Φ, viewer-scoping мира и кристаллизации артефактов.

**L3** (4 материализации: pixel, voice, agent API, document) и **L4** (Pattern Bank apply, темпоральный scheduler, irreversibility integrity rule, 5 видов invariant'ов) — Reserved для v0.2+ (см. [`01-conformance.md`](01-conformance.md)).

## Связь с манифестом

Спека — нормативная проекция мотивационного документа `idf-spec/source/manifesto-v2.snapshot.md` (SHA-256 в `idf-spec/source/manifesto-v2.snapshot.sha256`). Манифест объясняет, **почему** формат устроен так; спека — **что** реализация обязана уметь.

Спека не вносит новых аксиом, не упомянутых в манифесте. Где манифест не даёт однозначного ответа — спека занимает conservative-минимальную позицию и фиксирует это как Open question (секция в конце каждого нормативного `.md` файла).

## Как читать спеку

Рекомендуемый порядок:

1. [`00-introduction.md`](00-introduction.md) — этот файл
2. [`01-conformance.md`](01-conformance.md) — классы L1/L2 и процедура self-validation
3. [`02-axioms.md`](02-axioms.md) — четыре аксиомы формата
4. **Объекты** ([`03-objects/`](03-objects/)) в порядке: [`effect.md`](03-objects/effect.md) → [`ontology.md`](03-objects/ontology.md) → [`intent.md`](03-objects/intent.md) → [`projection.md`](03-objects/projection.md) → [`artifact.md`](03-objects/artifact.md)
5. **Алгебра** ([`04-algebra/`](04-algebra/)) в порядке: [`fold.md`](04-algebra/fold.md) → [`filter-world.md`](04-algebra/filter-world.md) → [`crystallize.md`](04-algebra/crystallize.md)
6. **JSON Schemas** ([`schemas/`](schemas/)) — формальные определения структур
7. **Fixtures** ([`fixtures/library/`](fixtures/library/)) — эталонный домен и self-validation

## Терминология (RFC 2119)

Нормативные ключевые слова используются в строгом соответствии с [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt) и [RFC 8174](https://www.ietf.org/rfc/rfc8174.txt). В русскоязычной прозе используются переводы:

| English  | Русский (нормативно) |
|----------|---------------------|
| MUST     | обязан / должен |
| MUST NOT | не обязан / не должен |
| SHOULD   | следует |
| SHOULD NOT | не следует |
| MAY      | может / вправе |

Любое утверждение без RFC 2119 ключевого слова — **информативно**.

## Граница нормативного и информативного

### Нормативно (MUST)

- **Структуры данных:** JSON Schema для пяти core-объектов в [`schemas/`](schemas/) — `ontology`, `intent`, `effect`, `projection`, `artifact`.
- **Интерфейсные функции:** `fold`, `filterWorldForRole`, `crystallize` — заявленные сигнатуры, контракты, детерминизм (см. [`04-algebra/`](04-algebra/) и [`02-axioms.md`](02-axioms.md)).
- **Effects API:** lifecycle `proposed → confirmed | rejected`, append-only Φ.
- **4 аксиомы** ([`02-axioms.md`](02-axioms.md)).
- **Test fixtures** на эталонном домене `library` ([`fixtures/library/`](fixtures/library/)).

### Информативно (SHOULD / MAY / описание)

- **Host-архитектура:** transport (HTTP / WebSocket / IPC / in-process), persistence (SQLite / Postgres / in-memory / append-only files), runtime (Node / Go / BEAM / browser-only). Спека описывает **интерфейсы**, не реализацию.
- **UI-адаптер и pixel-материализация:** в скоупе v0.1 только `artifact` как тип данных; pixel-рендеринг — L3, out of scope.
- **Validation tooling:** конкретный JSON Schema validator (`ajv`, `jsonschema`, `gojsonschema`, ...) — выбор implementer'а.
- **CLI / authoring environment** (Studio): не часть формата (манифест §21).

### Критерий conformance L1+L2

Implementer пишет: `parse(input) + apply L1+L2 functions + emit output`. Прогоняет через fixtures из [`fixtures/library/`](fixtures/library/). Pass всех fixture-векторов = L1+L2 conformance. Архитектурные решения (организация кода, язык, transport, persistence) — out of scope conformance check'а.

## Конвенции

### `kind` вместо `α`

Поле эффекта называется `kind` (не греческая `α`, не `alpha`): ASCII, читаемо, согласуется с `entity.kind` в онтологии. См. [`03-objects/effect.md`](03-objects/effect.md).

### Сравнение fixtures (semantic equality)

- **Объекты:** deep-equal с игнорированием порядка ключей.
- **Массивы:** порядок MUST совпадать (массивы в expected — нормативный порядок; правила сортировки — в [`04-algebra/crystallize.md`](04-algebra/crystallize.md) фаза 3).
- **`_meta`** в expected-файлах — informative, не учитывается при сравнении.

### Версионирование fixtures

Каждый fixture-файл имеет top-level `_meta: {specVersion, manifestSha256, description}`:

- **`specVersion`** — версия спеки, для которой fixture написан (`"0.1"` для v0.1).
- **`manifestSha256`** — SHA-256 манифеста, к которому fixture анкерирован. Если SHA-256 манифеста изменился — fixture может устареть; implementer SHOULD проверять совпадение перед использованием.
- **`description`** — человеко-читаемое описание сценария.

Поле `_meta` принимается схемами как opaque object без эффекта на content validation.

### Имена и регистры

| Тип       | Регистр       | Пример |
|-----------|---------------|--------|
| entity names | `PascalCase` | `User`, `Book`, `Loan` |
| field names  | `camelCase` | `userId`, `borrowedAt` |
| intent ids   | `snake_case` | `borrow_book`, `add_book` |
| role names   | `snake_case` | `reader`, `librarian` |
| projection ids | `kebab-case` | `book-catalog`, `borrow-form` |
| `.md` файлы в `spec/` | `kebab-case` | `filter-world.md` |

## Cross-references

- [`01-conformance.md`](01-conformance.md) — L1 / L2 классы, Reserved, процедура self-validation
- [`02-axioms.md`](02-axioms.md) — 4 нормативные аксиомы
- [`03-objects/`](03-objects/) — структуры core-объектов
- [`04-algebra/`](04-algebra/) — определения функций
- [`schemas/`](schemas/) — JSON Schema (draft-07)
- [`fixtures/library/`](fixtures/library/) — эталонный домен
