# Backlog ambiguities манифеста v2 (выявлены при написании spec-v0.1)

Этот файл — **не часть спеки**. Это feedback автору манифеста: места, где манифест v2 (`source/manifesto-v2.snapshot.md`, SHA-256 `6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb`) не даёт однозначного ответа на нормативный вопрос. Спека v0.1 в каждом случае заняла conservative-минимальную позицию (см. Open questions внутри `spec/`-файлов); этот файл — единый список для рассмотрения при работе над манифестом v2.1.

## Категории

### A. Малые уточнения (одна строка в манифесте)

Места, где манифест может разрешить ambiguity явной фразой без структурного изменения.

- **Q-1 / Q-14:** Tie-breaker при одинаковых `effect.context.at` timestamps. Манифест §11 говорит «упорядочены по времени», но не специфицирует поведение при равенстве. Спека v0.1 принимает: stable sort по позиции во входном массиве. Манифест мог бы добавить одну строку: «При совпадении at — стабильно сохранять порядок Φ-array».

- **Q-3:** `entity.kind: "reference"` требует явного упоминания в `role.visibleFields`? Манифест §14 говорит «видны всем с правильным role.visibleFields» — двусмысленно. Спека v0.1 принимает: MUST упомянута в visibleFields (column-уровневая видимость на entity-уровне). Манифест мог бы уточнить.

- **Q-15:** Идемпотентность `α: remove` на отсутствующей сущности. Манифест прямо не говорит. Спека v0.1: no-op (без ошибки). Манифест мог бы зафиксировать.

- **Q-18 / Q-19:** Self-id поле всегда видимо? Mutation-safety filterWorldForRole? Спека v0.1: SHOULD. Манифест мог бы повысить до MUST.

### B. Нормативные дополнения (структурные)

Места, требующие явного нормативного правила, отсутствующего в манифесте.

- **Q-25 (✅ resolved):** admin pattern в base-таксономии. Манифест §8.2 теперь включает `admin` как пятый класс (sync через [DubovskiyIM/idf#45](https://github.com/DubovskiyIM/idf/pull/45) merged). Спека v0.1.2 — реализует поведенческую семантику. Spec-extension закрыт.

- **Q-23:** Сигнатура `crystallize` в манифесте §12 — `crystallize(intents, ontology, projection, patternBank, features) → artifact`. Не упомянут viewer/viewerWorld. Спека v0.1 расширила сигнатуру до `(intents, ontology, projection, viewer, viewerWorld) → artifact`, потому что viewer-scoping artifact'а требует обоих параметров. Манифест должен либо явно зафиксировать расширение, либо описать механизм передачи viewer'а через context.

- **Q-7:** Templating language для `intent.effects[].fields` плейсхолдеров. Манифест §6 описывает proto-effects, но не нормирует формат плейсхолдеров. Спека v0.1: opaque, implementer выбирает конвенцию. Это блокирует реальную интероперабельность; v2.1 SHOULD выбрать конвенцию (например, `$viewer.id`, `{name}`).

- **Q-22:** Control-archetype mapping (§16) — манифест перечисляет `composerEntry`, `formModal`, `confirmDialog`, `clickForm`, `customCapture`, etc., но не даёт нормативной таблицы соответствия (какой control-archetype для какого intent.effects[0].kind). Спека v0.1: упрощённая destructive/standard эвристика. Полная таблица — открытая работа.

- **Q-12 / Q-13 / Q-24:** primaryField для detail и itemDisplay для catalog. Манифест §10 не специфицирует heuristic выбора первичного поля. Спека v0.1: первое не-id не-FK поле. Конфигурируемый primary — будущая работа.

- **Q-21:** Composition в dashboard.body.sections. Манифест говорит про hub-absorption (R8) и shape-layer, но не нормирует, как dashboard композирует sub-projections. Спека v0.1: `[]` пустой массив или references. Embedding sub-artifact'ов inline — открытая работа.

### C. Декомпозиция scope

Места, где манифест смешивает разные уровни (формат / реализация).

- **Q-9 / Q-20:** deriveProjections heuristic полная decision tree. Манифест §12 описывает фазу 1 как «выводит скелеты проекций по правилам R1–R8», но R1–R8 не перечислены в манифесте полностью с нормативными triggers. Это смесь нормативной (что фаза существует) и информативной (как именно она работает) информации. v2.1 SHOULD либо нормировать R1–R8, либо явно перенести в `Reserved L4`.

- **Q-10:** `projection.patterns` (Pattern Bank preference) — манифест в §9 упоминает как «preference, модификатор входа», но Pattern Bank сам по себе Reserved L4. Спека v0.1 принимает поле как opaque. v2.1 должен консистентно решить — нормирована ли Pattern Bank в L3 или только L4.

- **Q-17:** `role.scope` (m2m через assignment-bridge) — манифест §14 относит к нормативной части viewer-scoping (приоритет 0 row-filter), но также упоминает `entity.kind: "assignment"` как Reserved расширение. Спека v0.1 поместила scope в L4 Reserved. v2.1 должен либо нормировать в L3, либо явно перенести в L4.

## Полный список Open questions спеки v0.1

Копия для удобства; каждый вопрос содержит cross-reference на исходный файл.

| ID | Файл | Тема |
|---|---|---|
| Q-1  | [03-objects/effect.md](../spec/03-objects/effect.md) | Tie-breaker при одинаковых timestamps |
| Q-2  | [03-objects/effect.md](../spec/03-objects/effect.md) | `__irr` shape |
| Q-3  | [03-objects/ontology.md](../spec/03-objects/ontology.md) | visibleFields для reference-сущностей |
| Q-4  | [03-objects/ontology.md](../spec/03-objects/ontology.md) | Referential consistency самой ontology |
| Q-5  | [03-objects/ontology.md](../spec/03-objects/ontology.md) | Self-id поле как `ownerField` |
| Q-6  | [03-objects/intent.md](../spec/03-objects/intent.md) | Условный язык conditions |
| Q-7  | [03-objects/intent.md](../spec/03-objects/intent.md) | Templating fields в proto-effects |
| Q-8  | [03-objects/intent.md](../spec/03-objects/intent.md) | ownerRole consistency |
| Q-9  | [03-objects/projection.md](../spec/03-objects/projection.md) | Как deriveProjections выводит архетип |
| Q-10 | [03-objects/projection.md](../spec/03-objects/projection.md) | Author preference (`projection.patterns`) |
| Q-11 | [03-objects/artifact.md](../spec/03-objects/artifact.md) | Embedded vs reference в dashboard.body.sections |
| Q-12 | [03-objects/artifact.md](../spec/03-objects/artifact.md) | Primary field для detail |
| Q-13 | [03-objects/artifact.md](../spec/03-objects/artifact.md) | itemDisplay heuristic для catalog |
| Q-14 | [04-algebra/fold.md](../spec/04-algebra/fold.md) | Tie-breaker при одинаковых timestamps (дубликат Q-1) |
| Q-15 | [04-algebra/fold.md](../spec/04-algebra/fold.md) | Идемпотентность remove |
| Q-16 | [04-algebra/fold.md](../spec/04-algebra/fold.md) | Создание namespace'ов для отсутствующих entities |
| Q-17 | [04-algebra/filter-world.md](../spec/04-algebra/filter-world.md) | role.scope (m2m через assignment-bridge) |
| Q-18 | [04-algebra/filter-world.md](../spec/04-algebra/filter-world.md) | Self-id поле в visibleFields |
| Q-19 | [04-algebra/filter-world.md](../spec/04-algebra/filter-world.md) | Mutation-safety |
| Q-20 | [04-algebra/crystallize.md](../spec/04-algebra/crystallize.md) | deriveProjections heuristic полнота |
| Q-21 | [04-algebra/crystallize.md](../spec/04-algebra/crystallize.md) | dashboard composition |
| Q-22 | [04-algebra/crystallize.md](../spec/04-algebra/crystallize.md) | control-archetype mapping |
| Q-23 | [04-algebra/crystallize.md](../spec/04-algebra/crystallize.md) | detail recordId как параметр crystallize |
| Q-24 | [04-algebra/crystallize.md](../spec/04-algebra/crystallize.md) | primaryField для detail/itemDisplay |

## Заметка о доказательной силе backlog'а

Этот backlog — **сторонний эффект** написания спеки. Он не валидирован вторичной реализацией. Когда вторая реализация будет написана по `spec-v0.1`, она MAY обнаружить дополнительные ambiguities, не упомянутые здесь. Этот файл — стартовая точка для v2.1 работы, не финальный список.

## Дублирующиеся вопросы

- **Q-14** дублирует **Q-1** (tie-breaker timestamps) — присутствует в двух файлах для cross-reference. При резолюции в v2.1 — решить однажды, обновить оба.
- **Q-X** в [03-objects/effect.md](../spec/03-objects/effect.md) (idempotency remove) дублирует **Q-15** в fold.md. То же.
